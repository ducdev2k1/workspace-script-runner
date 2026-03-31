import * as vscode from "vscode";
import { EnumPackageManager, IScriptItem } from "../types";

/** Map package manager tới executable tương ứng */
const PM_EXECUTABLES: Record<EnumPackageManager, string> = {
  [EnumPackageManager.Npm]: "npm",
  [EnumPackageManager.Yarn]: "yarn",
  [EnumPackageManager.Pnpm]: "pnpm",
  [EnumPackageManager.Bun]: "bun",
};

/**
 * Tạo VS Code debug configuration để chạy npm script trong debugger
 */
export function buildDebugConfig(script: IScriptItem): vscode.DebugConfiguration {
  const executable = PM_EXECUTABLES[script.project.packageManager];
  return {
    type: "node",
    request: "launch",
    name: `Debug: ${script.project.name}/${script.name}`,
    runtimeExecutable: executable,
    runtimeArgs: ["run", script.name],
    cwd: script.project.path,
    console: "integratedTerminal",
    skipFiles: ["<node_internals>/**"],
  };
}

/**
 * Khởi động debug session cho một script.
 * Trả về true nếu debug session bắt đầu thành công.
 */
export async function launchDebug(script: IScriptItem): Promise<boolean> {
  const folder = vscode.workspace.getWorkspaceFolder(
    vscode.Uri.file(script.project.path),
  );
  const config = buildDebugConfig(script);
  return vscode.debug.startDebugging(folder, config);
}
