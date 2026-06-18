import * as vscode from "vscode";
import { getFrequentlyRunCount } from "../config";
import { ScriptsTreeDataProvider, ScriptTreeItem } from "./treeDataProvider";

/**
 * TreeDataProvider cho "Frequently Run" view — hiển thị top N script chạy
 * nhiều nhất trong một panel riêng (tách khỏi cây "All Scripts").
 *
 * Tái sử dụng run-count data + ScriptTreeItem của ScriptsTreeDataProvider nên
 * inline buttons (run/stop/restart/debug) hoạt động y hệt cây chính.
 */
export class FrequentlyRunProvider
  implements vscode.TreeDataProvider<ScriptTreeItem>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<
    ScriptTreeItem | undefined | null | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly source: ScriptsTreeDataProvider) {}

  /**
   * Refresh view (gọi khi run-counts hoặc running/debugging state thay đổi)
   */
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ScriptTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): ScriptTreeItem[] {
    return this.source
      .getTopRunScripts(getFrequentlyRunCount())
      .map((script) => this.source.makeScriptTreeItem(script, "focus"));
  }
}
