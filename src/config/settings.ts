import * as vscode from "vscode";
import { EnumPackageManager } from "../types";

/**
 * Lấy default package manager từ global settings
 */
export const getDefaultPackageManager = (): EnumPackageManager | "auto" => {
  const config = vscode.workspace.getConfiguration("scriptsRunner");
  return config.get<EnumPackageManager | "auto">(
    "defaultPackageManager",
    "auto",
  );
};

/**
 * Lấy workspace override cho một project cụ thể
 * @param projectName - Tên project cần check
 */
export const getWorkspaceOverride = (
  projectName: string,
): EnumPackageManager | undefined => {
  const config = vscode.workspace.getConfiguration("scriptsRunner");
  const overrides = config.get<Record<string, EnumPackageManager>>(
    "workspacePackageManager",
    {},
  );
  return overrides[projectName];
};

/**
 * Resolve package manager theo thứ tự ưu tiên:
 * 1. Workspace override
 * 2. User default (nếu không phải 'auto')
 * 3. Auto detect (từ parameter)
 * 4. npm (fallback)
 *
 * @param projectName - Tên project
 * @param detectedManager - Package manager được auto detect
 */
export const resolvePackageManager = (
  projectName: string,
  detectedManager: EnumPackageManager,
): EnumPackageManager => {
  // 1. Check workspace override
  const override = getWorkspaceOverride(projectName);
  if (override) {
    return override;
  }

  // 2. Check user default
  const defaultManager = getDefaultPackageManager();
  if (defaultManager !== "auto") {
    return defaultManager;
  }

  // 3. Use auto detected
  return detectedManager;
};
