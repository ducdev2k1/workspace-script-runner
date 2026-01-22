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

  constructor(
    public readonly script: IScriptItem,
    extensionPath: string,
    running: boolean = false,
  ) {
    super(script.name, vscode.TreeItemCollapsibleState.None);

    this.isRunning = running;
    this.description = script.command;
    this.contextValue = running ? "scriptRunning" : "script";
    this.tooltip = running
      ? `🔄 RUNNING: ${script.name}\n${script.command}`
      : `▶ ${script.name}: ${script.command}`;

    // Icon: loading~spin khi running, play khi idle
    if (running) {
      this.iconPath = new vscode.ThemeIcon(
        "loading~spin",
        new vscode.ThemeColor("charts.green"),
      );
    } else {
      // Sử dụng custom play icon
      const playIconPath = path.join(
        extensionPath,
        "resources",
        "icons",
        "play.svg",
      );
      this.iconPath = {
        light: vscode.Uri.file(playIconPath),
        dark: vscode.Uri.file(playIconPath),
      };
    }

    // Command khi click vào script
    this.command = {
      command: running ? "scriptsRunner.stopScript" : "scriptsRunner.runScript",
      title: running ? "Stop Script" : "Run Script",
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

  private projects: IWorkspaceProject[] = [];
  private runningScripts: Set<string> = new Set();
  private extensionPath: string;

  constructor(extensionPath: string) {
    this.extensionPath = extensionPath;
    this.refresh();
  }

  /**
   * Tạo unique key cho script
   */
  private getScriptKey(projectName: string, scriptName: string): string {
    return `${projectName}:${scriptName}`;
  }

  /**
   * Đánh dấu script đang chạy
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
  }

  /**
   * Kiểm tra script có đang chạy không
   */
  isScriptRunning(projectName: string, scriptName: string): boolean {
    const key = this.getScriptKey(projectName, scriptName);
    return this.runningScripts.has(key);
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
      // Project level -> return scripts
      return Promise.resolve(
        element.project.scripts.map((script) => {
          const isRunning = this.isScriptRunning(
            script.project.name,
            script.name,
          );
          return new ScriptTreeItem(script, this.extensionPath, isRunning);
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
}
