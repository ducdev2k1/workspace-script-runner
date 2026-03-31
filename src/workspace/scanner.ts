import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { resolvePackageManager } from "../config";
import { detectPackageManager } from "../packageManager";
import { IWorkspaceProject } from "../types";

/** Directories to skip when scanning sub-folders (common non-project dirs) */
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "out",
  "coverage",
  ".cache",
  ".vscode",
  ".idea",
  ".agent",
]);

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
 * Build IWorkspaceProject từ một folder path và tên project
 */
const buildProject = (
  folderPath: string,
  projectName: string,
  packageJsonPath: string,
): IWorkspaceProject => {
  const detectedManager = detectPackageManager(folderPath);
  const packageManager = resolvePackageManager(projectName, detectedManager);
  const scripts = parsePackageJson(packageJsonPath);

  const project: IWorkspaceProject = {
    name: projectName,
    path: folderPath,
    packageJsonPath,
    packageManager,
    scripts: [],
  };

  project.scripts = Object.entries(scripts).map(([name, command]) => ({
    name,
    command,
    project,
  }));

  return project;
};

/**
 * Scan root của một workspace folder và lấy thông tin project
 * @param folder - WorkspaceFolder cần scan
 */
export const scanWorkspaceFolder = (
  folder: vscode.WorkspaceFolder,
): IWorkspaceProject | null => {
  const packageJsonPath = path.join(folder.uri.fsPath, "package.json");

  if (!fs.existsSync(packageJsonPath)) {
    return null;
  }

  return buildProject(folder.uri.fsPath, folder.name, packageJsonPath);
};

/**
 * Scan immediate sub-directories của folderPath để tìm package.json.
 * Chỉ scan depth=1 (không đệ quy). Bỏ qua các thư mục trong SKIP_DIRS.
 * @param folderPath - Đường dẫn thư mục cha cần scan
 */
export const scanSubFolders = (folderPath: string): IWorkspaceProject[] => {
  const results: IWorkspaceProject[] = [];
  let entries: fs.Dirent[];

  try {
    entries = fs.readdirSync(folderPath, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || SKIP_DIRS.has(entry.name)) {
      continue;
    }

    const subPath = path.join(folderPath, entry.name);
    const pkgJsonPath = path.join(subPath, "package.json");

    if (!fs.existsSync(pkgJsonPath)) {
      continue;
    }

    results.push(buildProject(subPath, entry.name, pkgJsonPath));
  }

  return results;
};

/**
 * Scan tất cả workspace folders (root + immediate sub-dirs).
 * Hỗ trợ cả single-project và monorepo workspace.
 */
export const scanWorkspace = (): IWorkspaceProject[] => {
  const workspaceFolders = vscode.workspace.workspaceFolders;

  if (!workspaceFolders) {
    return [];
  }

  const projects: IWorkspaceProject[] = [];

  for (const folder of workspaceFolders) {
    // Scan root workspace folder
    const rootProject = scanWorkspaceFolder(folder);
    if (rootProject) {
      projects.push(rootProject);
    }

    // Scan immediate sub-folders (monorepo support)
    projects.push(...scanSubFolders(folder.uri.fsPath));
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
