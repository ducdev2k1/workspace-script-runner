import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { resolvePackageManager } from "../config";
import { detectPackageManager } from "../packageManager";
import { IScriptItem, IWorkspaceProject } from "../types";

/**
 * Parse package.json và lấy scripts
 * @param packageJsonPath - Đường dẫn đến file package.json
 */
export const parsePackageJson = (
  packageJsonPath: string,
): Record<string, string> => {
  try {
    const content = fs.readFileSync(packageJsonPath, "utf-8");
    const packageJson = JSON.parse(content);
    return packageJson.scripts || {};
  } catch {
    return {};
  }
};

/**
 * Scan một workspace folder và lấy thông tin project
 * @param folder - WorkspaceFolder cần scan
 */
export const scanWorkspaceFolder = (
  folder: vscode.WorkspaceFolder,
): IWorkspaceProject | null => {
  const packageJsonPath = path.join(folder.uri.fsPath, "package.json");

  // Kiểm tra package.json có tồn tại không
  if (!fs.existsSync(packageJsonPath)) {
    return null;
  }

  const folderPath = folder.uri.fsPath;
  const projectName = folder.name;

  // Detect package manager
  const detectedManager = detectPackageManager(folderPath);
  const packageManager = resolvePackageManager(projectName, detectedManager);

  // Parse scripts
  const scripts = parsePackageJson(packageJsonPath);

  // Tạo project object (chưa có scripts để tránh circular reference)
  const project: IWorkspaceProject = {
    name: projectName,
    path: folderPath,
    packageJsonPath,
    packageManager,
    scripts: [],
  };

  // Convert scripts thành IScriptItem array
  const scriptItems: IScriptItem[] = Object.entries(scripts).map(
    ([name, command]) => ({
      name,
      command,
      project,
    }),
  );

  project.scripts = scriptItems;

  return project;
};

/**
 * Scan tất cả workspace folders
 */
export const scanWorkspace = (): IWorkspaceProject[] => {
  const workspaceFolders = vscode.workspace.workspaceFolders;

  if (!workspaceFolders) {
    return [];
  }

  const projects: IWorkspaceProject[] = [];

  for (const folder of workspaceFolders) {
    const project = scanWorkspaceFolder(folder);
    if (project) {
      projects.push(project);
    }
  }

  return projects;
};

/**
 * Tạo FileSystemWatcher cho package.json files
 * @param onChanged - Callback khi có thay đổi
 */
export const watchPackageJson = (
  onChanged: () => void,
): vscode.FileSystemWatcher => {
  const watcher = vscode.workspace.createFileSystemWatcher(
    "**/package.json",
    false,
    false,
    false,
  );

  watcher.onDidChange(onChanged);
  watcher.onDidCreate(onChanged);
  watcher.onDidDelete(onChanged);

  return watcher;
};
