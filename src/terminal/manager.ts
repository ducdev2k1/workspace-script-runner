import * as vscode from "vscode";
import { getRunCommand } from "../packageManager";
import { IScriptItem, IWorkspaceProject } from "../types";

/**
 * Manager quản lý terminals cho từng project
 */
export class TerminalManager {
  private terminals: Map<string, vscode.Terminal> = new Map();

  /**
   * Tạo unique key cho terminal
   */
  private getTerminalKey(
    project: IWorkspaceProject,
    scriptName: string,
  ): string {
    return `${project.name}:${scriptName}`;
  }

  /**
   * Lấy tên terminal
   */
  private getTerminalName(
    project: IWorkspaceProject,
    scriptName: string,
  ): string {
    return `scripts: ${project.name}/${scriptName} (${project.packageManager})`;
  }

  /**
   * Chạy script trong terminal
   */
  runScript(script: IScriptItem): vscode.Terminal {
    const key = this.getTerminalKey(script.project, script.name);

    // Kiểm tra terminal đã tồn tại chưa
    let terminal = this.terminals.get(key);

    if (terminal) {
      // Dispose terminal cũ
      terminal.dispose();
    }

    // Tạo terminal mới
    terminal = vscode.window.createTerminal({
      name: this.getTerminalName(script.project, script.name),
      cwd: script.project.path,
    });

    this.terminals.set(key, terminal);

    // Lấy command và chạy
    const command = getRunCommand(script.project.packageManager, script.name);
    terminal.sendText(command);
    terminal.show();

    return terminal;
  }

  /**
   * Stop script (dispose terminal)
   */
  stopScript(script: IScriptItem): void {
    const key = this.getTerminalKey(script.project, script.name);
    const terminal = this.terminals.get(key);

    if (terminal) {
      terminal.dispose();
      this.terminals.delete(key);
    }
  }

  /**
   * Restart script
   */
  restartScript(script: IScriptItem): vscode.Terminal {
    this.stopScript(script);
    return this.runScript(script);
  }

  /**
   * Kiểm tra script có đang chạy không
   */
  isRunning(script: IScriptItem): boolean {
    const key = this.getTerminalKey(script.project, script.name);
    return this.terminals.has(key);
  }

  /**
   * Dispose tất cả terminals
   */
  dispose(): void {
    Array.from(this.terminals.values()).forEach((terminal) => {
      terminal.dispose();
    });
    this.terminals.clear();
  }

  /**
   * Xử lý khi terminal bị đóng
   * @returns Thông tin script nếu tìm thấy, null nếu không
   */
  handleTerminalClosed(
    closedTerminal: vscode.Terminal,
  ): { projectName: string; scriptName: string } | null {
    const entries = Array.from(this.terminals.entries());
    for (const [key, terminal] of entries) {
      if (terminal === closedTerminal) {
        this.terminals.delete(key);
        // Parse key để lấy projectName và scriptName
        const [projectName, scriptName] = key.split(":");
        return { projectName, scriptName };
      }
    }
    return null;
  }
}
