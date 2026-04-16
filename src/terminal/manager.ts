import * as vscode from "vscode";
import { getRunCommand } from "../packageManager";
import { IScriptItem, IWorkspaceProject } from "../types";

// Separator cho terminal key — dùng "||" thay ":" để tránh conflict với script name chứa ":"
const KEY_SEPARATOR = "||";

/**
 * Manager quản lý terminals cho từng project.
 * Sử dụng Shell Integration API (VS Code 1.93+) để detect khi command kết thúc.
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
    return `${project.name}${KEY_SEPARATOR}${scriptName}`;
  }

  /**
   * Parse key thành projectName và scriptName
   */
  parseTerminalKey(key: string): { projectName: string; scriptName: string } {
    const idx = key.indexOf(KEY_SEPARATOR);
    return {
      projectName: key.substring(0, idx),
      scriptName: key.substring(idx + KEY_SEPARATOR.length),
    };
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
   * Chạy script trong terminal.
   * Dùng shellIntegration.executeCommand() nếu available, fallback sendText().
   */
  async runScript(script: IScriptItem): Promise<vscode.Terminal> {
    const key = this.getTerminalKey(script.project, script.name);

    // Xóa khỏi map TRƯỚC khi dispose để tránh race condition với onDidCloseTerminal
    const existing = this.terminals.get(key);
    if (existing) {
      this.terminals.delete(key);
      existing.dispose();
    }

    // Tạo terminal mới
    const terminal = vscode.window.createTerminal({
      name: this.getTerminalName(script.project, script.name),
      cwd: script.project.path,
    });
    this.terminals.set(key, terminal);

    // Lấy command
    const command = getRunCommand(script.project.packageManager, script.name);

    // Thử dùng Shell Integration, fallback sendText
    let shellIntegration = terminal.shellIntegration;
    if (!shellIntegration) {
      // Wait cho shell integration sẵn sàng (timeout 3s)
      await this.waitForShellIntegration(terminal, 3000);
      shellIntegration = terminal.shellIntegration;
    }

    if (shellIntegration) {
      shellIntegration.executeCommand(command);
    } else {
      terminal.sendText(command);
    }

    terminal.show();
    return terminal;
  }

  /**
   * Chờ shellIntegration available trên terminal
   */
  private waitForShellIntegration(
    terminal: vscode.Terminal,
    timeoutMs: number,
  ): Promise<boolean> {
    return new Promise((resolve) => {
      if (terminal.shellIntegration) {
        resolve(true);
        return;
      }

      const timer = setTimeout(() => {
        disposable.dispose();
        resolve(false);
      }, timeoutMs);

      const disposable = vscode.window.onDidChangeTerminalShellIntegration(
        (e) => {
          if (e.terminal === terminal) {
            clearTimeout(timer);
            disposable.dispose();
            resolve(true);
          }
        },
      );
    });
  }

  /**
   * Stop script — send SIGINT (Ctrl+C) before disposing to ensure child process is killed
   */
  stopScript(script: IScriptItem): void {
    const key = this.getTerminalKey(script.project, script.name);
    const terminal = this.terminals.get(key);

    if (terminal) {
      // Send Ctrl+C to gracefully stop the child process (e.g. node server)
      terminal.sendText("\x03", false);
      this.terminals.delete(key);
      terminal.dispose();
    }
  }

  /**
   * Restart script — kill old process then start new one
   */
  async restartScript(script: IScriptItem): Promise<vscode.Terminal> {
    const key = this.getTerminalKey(script.project, script.name);
    const existing = this.terminals.get(key);

    if (existing) {
      existing.sendText("\x03", false);
      existing.dispose();
      this.terminals.delete(key);
    }

    return await this.runScript(script);
  }

  /**
   * Kiểm tra script có đang chạy không
   */
  isRunning(script: IScriptItem): boolean {
    const key = this.getTerminalKey(script.project, script.name);
    return this.terminals.has(key);
  }

  /**
   * Focus terminal của một script (dùng khi click từ Running Scripts view)
   */
  focusTerminal(script: IScriptItem): void {
    const key = this.getTerminalKey(script.project, script.name);
    const terminal = this.terminals.get(key);
    if (terminal) {
      terminal.show();
    }
  }

  /**
   * Dispose tất cả terminals
   */
  dispose(): void {
    for (const terminal of this.terminals.values()) {
      terminal.dispose();
    }
    this.terminals.clear();
  }

  /**
   * Tìm script info từ terminal object (không xóa khỏi map)
   */
  findScriptByTerminal(
    terminal: vscode.Terminal,
  ): { projectName: string; scriptName: string } | null {
    for (const [key, t] of this.terminals.entries()) {
      if (t === terminal) {
        return this.parseTerminalKey(key);
      }
    }
    return null;
  }

  /**
   * Xóa terminal khỏi map và trả về script info.
   * Dùng khi terminal bị đóng (onDidCloseTerminal).
   */
  removeTerminal(
    closedTerminal: vscode.Terminal,
  ): { projectName: string; scriptName: string } | null {
    for (const [key, terminal] of this.terminals.entries()) {
      if (terminal === closedTerminal) {
        this.terminals.delete(key);
        return this.parseTerminalKey(key);
      }
    }
    return null;
  }
}
