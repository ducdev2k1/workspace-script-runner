import * as vscode from "vscode";
import { IScriptItem } from "../types";

/**
 * TreeItem đại diện cho một script đang chạy trong "Running Scripts" view
 */
export class RunningScriptItem extends vscode.TreeItem {
  constructor(public readonly script: IScriptItem) {
    super(
      `${script.project.name} › ${script.name}`,
      vscode.TreeItemCollapsibleState.None,
    );

    this.description = script.command;
    this.contextValue = "runningScript";
    this.iconPath = new vscode.ThemeIcon(
      "sync~spin",
      new vscode.ThemeColor("charts.green"),
    );
    this.tooltip = `${script.project.name}/${script.name}\n▶ ${script.command}`;

    // Click để focus terminal của script này
    this.command = {
      command: "scriptsRunner.focusTerminal",
      title: "Focus Terminal",
      arguments: [this.script],
    };
  }
}

/**
 * TreeDataProvider cho "Running Scripts" panel —
 * hiển thị tất cả scripts đang chạy trong workspace
 */
export class RunningScriptsProvider
  implements vscode.TreeDataProvider<RunningScriptItem>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<
    RunningScriptItem | undefined | null | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private runningScripts: IScriptItem[] = [];

  /**
   * Cập nhật danh sách running scripts và refresh view
   */
  update(scripts: IScriptItem[]): void {
    this.runningScripts = scripts;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: RunningScriptItem): vscode.TreeItem {
    return element;
  }

  getChildren(): RunningScriptItem[] {
    return this.runningScripts.map((script) => new RunningScriptItem(script));
  }
}
