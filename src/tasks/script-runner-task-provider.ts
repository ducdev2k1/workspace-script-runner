import * as vscode from "vscode";
import { IScriptItem } from "../types";
import { TerminalManager } from "../terminal";

/** Task definition cho custom "script-runner" task type */
interface ScriptRunnerTaskDefinition extends vscode.TaskDefinition {
  type: "script-runner";
  /** Tên script trong package.json */
  script: string;
  /** Đường dẫn tuyệt đối tới project folder */
  folder: string;
}

/**
 * Tích hợp với VS Code Task system — cho phép scripts xuất hiện
 * trong "Tasks: Run Task" palette và hỗ trợ "Rerun Last Task"
 */
export class ScriptRunnerTaskProvider implements vscode.TaskProvider {
  static readonly taskType = "script-runner";

  constructor(
    private readonly getScripts: () => IScriptItem[],
    private readonly terminalManager: TerminalManager,
  ) {}

  provideTasks(): vscode.Task[] {
    return this.getScripts().map((script) => this.createTask(script));
  }

  resolveTask(task: vscode.Task): vscode.Task | undefined {
    const def = task.definition as ScriptRunnerTaskDefinition;
    if (def.type === ScriptRunnerTaskProvider.taskType && def.script && def.folder) {
      const match = this.getScripts().find(
        (s) => s.name === def.script && s.project.path === def.folder,
      );
      if (match) {
        return this.createTask(match);
      }
    }
    return undefined;
  }

  private createTask(script: IScriptItem): vscode.Task {
    const def: ScriptRunnerTaskDefinition = {
      type: ScriptRunnerTaskProvider.taskType,
      script: script.name,
      folder: script.project.path,
    };

    const terminalManager = this.terminalManager;
    const task = new vscode.Task(
      def,
      vscode.TaskScope.Workspace,
      `${script.project.name}: ${script.name}`,
      "Scripts Runner",
      new vscode.CustomExecution(async () => {
        terminalManager.runScript(script);
        // Pseudo-terminal minimal — output thực tế ở trong terminal của TerminalManager
        const writeEmitter = new vscode.EventEmitter<string>();
        return {
          onDidWrite: writeEmitter.event,
          open: () => writeEmitter.fire(`▶ Running ${script.project.name}: ${script.name}\r\n`),
          close: () => writeEmitter.dispose(),
        };
      }),
    );
    task.group = vscode.TaskGroup.Build;
    return task;
  }
}
