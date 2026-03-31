import * as path from "path";
import * as vscode from "vscode";
import { EnumPackageManager, IScriptItem, IWorkspaceProject } from "../types";
import { scanWorkspace } from "../workspace";

type TypeTreeItem = ProjectTreeItem | ScriptTreeItem;

/** Map package manager với icon path */
const getPackageManagerIcon = (
  manager: EnumPackageManager,
  extensionPath: string,
): { light: vscode.Uri; dark: vscode.Uri } => {
  const iconName = manager.toLowerCase();
  const iconPath = path.join(
    extensionPath,
    "resources",
    "icons",
    `${iconName}.svg`,
  );
  return {
    light: vscode.Uri.file(iconPath),
    dark: vscode.Uri.file(iconPath),
  };
};

/**
 * TreeItem đại diện cho một project
 */
export class ProjectTreeItem extends vscode.TreeItem {
  constructor(
    public readonly project: IWorkspaceProject,
    extensionPath: string,
  ) {
    super(project.name, vscode.TreeItemCollapsibleState.Expanded);

    this.description = `(${project.packageManager})`;
    this.iconPath = getPackageManagerIcon(
      project.packageManager,
      extensionPath,
    );
    this.contextValue = "project";
    this.tooltip = `${project.name} - ${project.packageManager}\n📁 ${project.path}`;
  }
}

/**
 * TreeItem đại diện cho một script
 */
export class ScriptTreeItem extends vscode.TreeItem {
  public isRunning = false;
  public isDebugging = false;

  constructor(
    public readonly script: IScriptItem,
    extensionPath: string,
    running: boolean = false,
    debugging: boolean = false,
    favorite: boolean = false,
  ) {
    super(script.name, vscode.TreeItemCollapsibleState.None);

    this.isRunning = running;
    this.isDebugging = debugging;
    // Hiển thị ★ trước tên nếu là favorite
    this.description = favorite ? "★" : "";

    if (debugging) {
      this.contextValue = "scriptDebugging";
    } else if (running) {
      this.contextValue = "scriptRunning";
    } else {
      this.contextValue = "script";
    }

    this.tooltip = `${script.name}\n📋 ${script.command}`;

    // Icon: debug icon khi đang debug, pause khi running, play khi idle
    const iconName = debugging ? "debug" : running ? "pause" : "play";
    const iconPath = path.join(
      extensionPath,
      "resources",
      "icons",
      `${iconName}.svg`,
    );
    this.iconPath = {
      light: vscode.Uri.file(iconPath),
      dark: vscode.Uri.file(iconPath),
    };

    // Thêm suffix "Favorite" vào contextValue nếu được ghim
    if (favorite) {
      this.contextValue += "Favorite";
    }

    // Command khi click: stop nếu running/debugging, run nếu idle
    const isActive = running || debugging;
    this.command = {
      command: isActive ? "scriptsRunner.stopScript" : "scriptsRunner.runScript",
      title: isActive ? "Stop Script" : "Run Script",
      arguments: [this],
    };
  }
}

/**
 * TreeDataProvider cho Scripts Runner view
 */
export class ScriptsTreeDataProvider implements vscode.TreeDataProvider<TypeTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    TypeTreeItem | undefined | null | void
  > = new vscode.EventEmitter<TypeTreeItem | undefined | null | void>();

  readonly onDidChangeTreeData: vscode.Event<
    TypeTreeItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  /** Emits danh sách IScriptItem đang chạy mỗi khi running state thay đổi */
  private _onRunningScriptsChange = new vscode.EventEmitter<IScriptItem[]>();
  readonly onRunningScriptsChange = this._onRunningScriptsChange.event;

  private projects: IWorkspaceProject[] = [];
  private runningScripts: Set<string> = new Set();
  /** Scripts đang trong debug session */
  private debuggingScripts: Set<string> = new Set();
  private extensionPath: string;
  /** Persistent storage cho favorites (per-workspace) */
  private workspaceState: vscode.Memento;
  private static readonly FAVORITES_KEY = "scriptsRunner.favorites";

  constructor(extensionPath: string, workspaceState: vscode.Memento) {
    this.extensionPath = extensionPath;
    this.workspaceState = workspaceState;
    this.refresh();
  }

  /**
   * Tạo unique key cho script
   */
  private getScriptKey(projectName: string, scriptName: string): string {
    return `${projectName}:${scriptName}`;
  }

  /**
   * Đánh dấu script đang chạy và notify running scripts view
   */
  setScriptRunning(
    projectName: string,
    scriptName: string,
    running: boolean,
  ): void {
    const key = this.getScriptKey(projectName, scriptName);
    if (running) {
      this.runningScripts.add(key);
    } else {
      this.runningScripts.delete(key);
    }
    this._onDidChangeTreeData.fire();
    this._onRunningScriptsChange.fire(this.getRunningScriptItems());
  }

  /**
   * Lấy danh sách IScriptItem đang chạy
   */
  getRunningScriptItems(): IScriptItem[] {
    const result: IScriptItem[] = [];
    for (const project of this.projects) {
      for (const script of project.scripts) {
        if (this.isScriptRunning(project.name, script.name)) {
          result.push(script);
        }
      }
    }
    return result;
  }

  /**
   * Lấy flat list tất cả scripts trong workspace (dùng cho Task Provider)
   */
  getAllScripts(): IScriptItem[] {
    return this.projects.flatMap((project) => project.scripts);
  }

  /**
   * Kiểm tra script có đang chạy không
   */
  isScriptRunning(projectName: string, scriptName: string): boolean {
    const key = this.getScriptKey(projectName, scriptName);
    return this.runningScripts.has(key);
  }

  /**
   * Đánh dấu script đang trong debug session
   */
  setScriptDebugging(
    projectName: string,
    scriptName: string,
    debugging: boolean,
  ): void {
    const key = this.getScriptKey(projectName, scriptName);
    if (debugging) {
      this.debuggingScripts.add(key);
    } else {
      this.debuggingScripts.delete(key);
    }
    this._onDidChangeTreeData.fire();
  }

  /**
   * Kiểm tra script có đang debug không
   */
  isScriptDebugging(projectName: string, scriptName: string): boolean {
    const key = this.getScriptKey(projectName, scriptName);
    return this.debuggingScripts.has(key);
  }

  /**
   * Refresh data và notify view
   */
  refresh(): void {
    this.projects = scanWorkspace();
    this._onDidChangeTreeData.fire();
  }

  /**
   * Lấy TreeItem cho element
   */
  getTreeItem(element: TypeTreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * Lấy children của element
   */
  getChildren(element?: TypeTreeItem): Thenable<TypeTreeItem[]> {
    if (!element) {
      // Root level -> return projects
      return Promise.resolve(
        this.projects.map(
          (project) => new ProjectTreeItem(project, this.extensionPath),
        ),
      );
    }

    if (element instanceof ProjectTreeItem) {
      // Project level -> return scripts, favorites nổi lên đầu
      const scripts = [...element.project.scripts].sort((a, b) => {
        const aFav = this.isFavorite(a.project.name, a.name) ? 0 : 1;
        const bFav = this.isFavorite(b.project.name, b.name) ? 0 : 1;
        return aFav - bFav;
      });

      return Promise.resolve(
        scripts.map((script) => {
          const isRunning = this.isScriptRunning(script.project.name, script.name);
          const isDebugging = this.isScriptDebugging(script.project.name, script.name);
          const isFav = this.isFavorite(script.project.name, script.name);
          return new ScriptTreeItem(script, this.extensionPath, isRunning, isDebugging, isFav);
        }),
      );
    }

    // Script level -> no children
    return Promise.resolve([]);
  }

  /**
   * Lấy danh sách projects hiện tại
   */
  getProjects(): IWorkspaceProject[] {
    return this.projects;
  }

  // ── Favorites ────────────────────────────────────────────────────────────

  private getFavoritesSet(): Set<string> {
    const stored = this.workspaceState.get<string[]>(
      ScriptsTreeDataProvider.FAVORITES_KEY,
      [],
    );
    return new Set(stored);
  }

  isFavorite(projectName: string, scriptName: string): boolean {
    return this.getFavoritesSet().has(this.getScriptKey(projectName, scriptName));
  }

  async toggleFavorite(projectName: string, scriptName: string): Promise<void> {
    const favorites = this.getFavoritesSet();
    const key = this.getScriptKey(projectName, scriptName);
    if (favorites.has(key)) {
      favorites.delete(key);
    } else {
      favorites.add(key);
    }
    await this.workspaceState.update(
      ScriptsTreeDataProvider.FAVORITES_KEY,
      Array.from(favorites),
    );
    this._onDidChangeTreeData.fire();
  }
}
