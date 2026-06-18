import * as vscode from "vscode";
import { launchDebug } from "./debug";
import { getRunCommand } from "./packageManager";
import { ScriptRunnerTaskProvider } from "./tasks";
import { TerminalManager } from "./terminal";
import { IScriptItem } from "./types";
import {
  FrequentlyRunProvider,
  RunningScriptsProvider,
  ScriptsTreeDataProvider,
  ScriptTreeItem,
} from "./ui";
import { watchPackageJson } from "./workspace";

let treeDataProvider: ScriptsTreeDataProvider;
let runningScriptsProvider: RunningScriptsProvider;
let frequentlyRunProvider: FrequentlyRunProvider;
let terminalManager: TerminalManager;
let packageJsonWatcher: vscode.FileSystemWatcher;
/** Track debug sessions by name so we can stop the correct one */
const debugSessions = new Map<string, vscode.DebugSession>();

/**
 * Tạo TreeView an toàn: nếu view id chưa được đăng ký trong manifest (xảy ra
 * thoáng qua ngay sau khi update extension, trước khi reload window),
 * createTreeView sẽ throw — bắt lại để activate() không bị dừng giữa chừng.
 */
function registerTreeView(
  context: vscode.ExtensionContext,
  viewId: string,
  options: Parameters<typeof vscode.window.createTreeView>[1],
): void {
  try {
    context.subscriptions.push(vscode.window.createTreeView(viewId, options));
  } catch (error) {
    console.warn(
      `[Scripts Runner] View "${viewId}" chưa đăng ký (thường do cache sau khi update — reload window sẽ khắc phục):`,
      error,
    );
  }
}

/**
 * Extension được activate khi workspace có package.json
 */
export function activate(context: vscode.ExtensionContext): void {
  // Initialize providers
  treeDataProvider = new ScriptsTreeDataProvider(
    context.extensionPath,
    context.workspaceState,
  );
  runningScriptsProvider = new RunningScriptsProvider();
  frequentlyRunProvider = new FrequentlyRunProvider(treeDataProvider);
  terminalManager = new TerminalManager();

  // Register views. Wrap each in a guard: right after an extension update VS
  // Code may run the new code against the old (cached) manifest, where a newly
  // added view id isn't registered yet — createTreeView would throw and abort
  // activation (commands never register). The guard keeps the rest working;
  // the missing view appears after the next window reload.
  registerTreeView(context, "scriptsRunnerView", {
    treeDataProvider,
    showCollapseAll: true,
  });
  registerTreeView(context, "scriptsRunnerFrequentView", {
    treeDataProvider: frequentlyRunProvider,
  });
  registerTreeView(context, "scriptsRunnerRunningView", {
    treeDataProvider: runningScriptsProvider,
  });

  // Sync running scripts view khi state thay đổi
  const runningChangeListener = treeDataProvider.onRunningScriptsChange(
    (scripts: IScriptItem[]) => {
      runningScriptsProvider.update(scripts);
    },
  );
  context.subscriptions.push(runningChangeListener);

  // Đồng bộ Frequently Run view mỗi khi cây chính thay đổi (run-counts,
  // running/debugging state, refresh workspace, đổi setting count)
  const frequentlyRunChangeListener = treeDataProvider.onDidChangeTreeData(
    () => {
      frequentlyRunProvider.refresh();
    },
  );
  context.subscriptions.push(frequentlyRunChangeListener);

  // Watch package.json changes
  packageJsonWatcher = watchPackageJson(() => {
    treeDataProvider.refresh();
  });
  context.subscriptions.push(packageJsonWatcher);

  // Xử lý khi terminal đóng (trash icon, dispose) - update running state
  const terminalCloseListener = vscode.window.onDidCloseTerminal((terminal) => {
    const scriptInfo = terminalManager.removeTerminal(terminal);
    if (scriptInfo) {
      treeDataProvider.setScriptRunning(
        scriptInfo.projectName,
        scriptInfo.scriptName,
        false,
      );
    }
  });
  context.subscriptions.push(terminalCloseListener);

  // Detect khi command kết thúc trong terminal (Ctrl+C, process exit, script done)
  // Shell Integration API (VS Code 1.93+)
  const shellExecEndListener = vscode.window.onDidEndTerminalShellExecution(
    (event) => {
      const scriptInfo = terminalManager.findScriptByTerminal(event.terminal);
      if (scriptInfo) {
        treeDataProvider.setScriptRunning(
          scriptInfo.projectName,
          scriptInfo.scriptName,
          false,
        );
      }
    },
  );
  context.subscriptions.push(shellExecEndListener);

  // Register commands
  registerCommands(context);
}

/**
 * Register tất cả commands
 */
function registerCommands(context: vscode.ExtensionContext): void {
  // Run Script
  const runScriptCommand = vscode.commands.registerCommand(
    "scriptsRunner.runScript",
    async (item: ScriptTreeItem) => {
      if (item && item.script) {
        await terminalManager.runScript(item.script);
        treeDataProvider.setScriptRunning(
          item.script.project.name,
          item.script.name,
          true,
        );
        treeDataProvider.incrementRunCount(
          item.script.project.name,
          item.script.name,
        );
        vscode.window.showInformationMessage(
          `▶ Running: ${item.script.project.name}/${item.script.name}`,
        );
      }
    },
  );
  context.subscriptions.push(runScriptCommand);

  // Stop Script — handles both terminal-run and debug sessions
  const stopScriptCommand = vscode.commands.registerCommand(
    "scriptsRunner.stopScript",
    (item: ScriptTreeItem) => {
      if (item && item.script) {
        const { name: scriptName, project } = item.script;
        const projectName = project.name;

        if (treeDataProvider.isScriptDebugging(projectName, scriptName)) {
          // Look up tracked session first, fall back to active session
          const debugName = `Debug: ${projectName}/${scriptName}`;
          const tracked = debugSessions.get(debugName);
          vscode.debug.stopDebugging(tracked);
          treeDataProvider.setScriptDebugging(projectName, scriptName, false);
        } else {
          terminalManager.stopScript(item.script);
        }

        treeDataProvider.setScriptRunning(projectName, scriptName, false);
        vscode.window.showInformationMessage(
          `⏹ Stopped: ${projectName}/${scriptName}`,
        );
      }
    },
  );
  context.subscriptions.push(stopScriptCommand);

  // Restart Script — handles both terminal-run and debug sessions
  const restartScriptCommand = vscode.commands.registerCommand(
    "scriptsRunner.restartScript",
    async (item: ScriptTreeItem) => {
      if (item && item.script) {
        const { name: scriptName, project } = item.script;
        const projectName = project.name;

        if (treeDataProvider.isScriptDebugging(projectName, scriptName)) {
          // Stop the tracked debug session, then launch a fresh one for the
          // same script. Avoids `workbench.action.debug.restart` which only
          // restarts the active session (wrong when debugging multiple scripts).
          const debugName = `Debug: ${projectName}/${scriptName}`;
          const tracked = debugSessions.get(debugName);
          await vscode.debug.stopDebugging(tracked);
          const success = await launchDebug(item.script);
          if (success) {
            treeDataProvider.setScriptDebugging(projectName, scriptName, true);
          }
        } else {
          terminalManager.stopScript(item.script);
          await terminalManager.runScript(item.script);
          treeDataProvider.setScriptRunning(projectName, scriptName, true);
        }

        treeDataProvider.incrementRunCount(projectName, scriptName);
        vscode.window.showInformationMessage(
          `🔄 Restarted: ${projectName}/${scriptName}`,
        );
      }
    },
  );
  context.subscriptions.push(restartScriptCommand);

  // Change Package Manager
  const changePackageManagerCommand = vscode.commands.registerCommand(
    "scriptsRunner.changePackageManager",
    async () => {
      const projects = treeDataProvider.getProjects();
      if (projects.length === 0) {
        vscode.window.showWarningMessage("No projects found");
        return;
      }

      // Chọn project
      const projectItems = projects.map((p) => ({
        label: p.name,
        description: `Current: ${p.packageManager}`,
        project: p,
      }));

      const selectedProject = await vscode.window.showQuickPick(projectItems, {
        placeHolder: "Select project to change package manager",
      });

      if (!selectedProject) {
        return;
      }

      // Chọn package manager mới
      const managers = ["npm", "yarn", "pnpm", "bun"];
      const selectedManager = await vscode.window.showQuickPick(managers, {
        placeHolder: "Select package manager",
      });

      if (!selectedManager) {
        return;
      }

      // Update workspace settings
      const config = vscode.workspace.getConfiguration("scriptsRunner");
      const overrides = config.get<Record<string, string>>(
        "workspacePackageManager",
        {},
      );
      overrides[selectedProject.project.name] = selectedManager;

      await config.update(
        "workspacePackageManager",
        overrides,
        vscode.ConfigurationTarget.Workspace,
      );

      treeDataProvider.refresh();
      vscode.window.showInformationMessage(
        `Changed ${selectedProject.project.name} to ${selectedManager}`,
      );
    },
  );
  context.subscriptions.push(changePackageManagerCommand);

  // Refresh
  const refreshCommand = vscode.commands.registerCommand(
    "scriptsRunner.refresh",
    () => {
      treeDataProvider.refresh();
      vscode.window.showInformationMessage("Workspace Script Runner refreshed");
    },
  );
  context.subscriptions.push(refreshCommand);

  // Focus Terminal (từ Running Scripts view)
  const focusTerminalCommand = vscode.commands.registerCommand(
    "scriptsRunner.focusTerminal",
    (script: IScriptItem) => {
      if (script) {
        terminalManager.focusTerminal(script);
      }
    },
  );
  context.subscriptions.push(focusTerminalCommand);

  // Debug Script — launch VS Code debugger
  const debugScriptCommand = vscode.commands.registerCommand(
    "scriptsRunner.debugScript",
    async (item: ScriptTreeItem) => {
      if (item?.script) {
        const success = await launchDebug(item.script);
        if (success) {
          treeDataProvider.setScriptDebugging(
            item.script.project.name,
            item.script.name,
            true,
          );
          treeDataProvider.incrementRunCount(
            item.script.project.name,
            item.script.name,
          );
          vscode.window.showInformationMessage(
            `🐛 Debugging: ${item.script.project.name}/${item.script.name}`,
          );
        }
      }
    },
  );
  context.subscriptions.push(debugScriptCommand);

  // Track debug sessions by name for targeted stop
  const debugStartListener = vscode.debug.onDidStartDebugSession((session) => {
    if (session.name.startsWith("Debug: ")) {
      debugSessions.set(session.name, session);
    }
  });
  context.subscriptions.push(debugStartListener);

  // Clear debug state and tracked session on terminate
  const debugEndListener = vscode.debug.onDidTerminateDebugSession(
    (session) => {
      // Guard against a late terminate from an old session: a restart starts a
      // new session with the same name that already overwrote the map entry, so
      // the old session's terminate must not clear the new session's state.
      const tracked = debugSessions.get(session.name);
      if (tracked && tracked.id !== session.id) {
        return;
      }
      debugSessions.delete(session.name);
      const match = session.name.match(/^Debug: (.+?)\/(.+)$/);
      if (match) {
        treeDataProvider.setScriptDebugging(match[1], match[2], false);
      }
    },
  );
  context.subscriptions.push(debugEndListener);

  // Pin to Favorites
  const pinScriptCommand = vscode.commands.registerCommand(
    "scriptsRunner.pinScript",
    async (item: ScriptTreeItem) => {
      if (item?.script) {
        await treeDataProvider.toggleFavorite(
          item.script.project.name,
          item.script.name,
        );
        vscode.window.showInformationMessage(
          `★ Pinned: ${item.script.project.name}/${item.script.name}`,
        );
      }
    },
  );
  context.subscriptions.push(pinScriptCommand);

  // Unpin from Favorites
  const unpinScriptCommand = vscode.commands.registerCommand(
    "scriptsRunner.unpinScript",
    async (item: ScriptTreeItem) => {
      if (item?.script) {
        await treeDataProvider.toggleFavorite(
          item.script.project.name,
          item.script.name,
        );
        vscode.window.showInformationMessage(
          `☆ Unpinned: ${item.script.project.name}/${item.script.name}`,
        );
      }
    },
  );
  context.subscriptions.push(unpinScriptCommand);

  // Copy Command to clipboard
  const copyCommandCommand = vscode.commands.registerCommand(
    "scriptsRunner.copyCommand",
    (item: ScriptTreeItem) => {
      if (item?.script) {
        const fullCmd = getRunCommand(
          item.script.project.packageManager,
          item.script.name,
        );
        vscode.env.clipboard.writeText(fullCmd);
        vscode.window.showInformationMessage(`Copied: ${fullCmd}`);
      }
    },
  );
  context.subscriptions.push(copyCommandCommand);

  // Remove from Frequently Run — drops a single script from the run history
  const removeFromFrequentCommand = vscode.commands.registerCommand(
    "scriptsRunner.removeFromFrequent",
    async (item: ScriptTreeItem) => {
      if (item?.script) {
        await treeDataProvider.removeRunCount(
          item.script.project.name,
          item.script.name,
        );
        vscode.window.showInformationMessage(
          `Removed from Frequently Run: ${item.script.project.name}/${item.script.name}`,
        );
      }
    },
  );
  context.subscriptions.push(removeFromFrequentCommand);

  // Reset Run Counts — clears the Frequently Run history
  const resetRunCountsCommand = vscode.commands.registerCommand(
    "scriptsRunner.resetRunCounts",
    async () => {
      await treeDataProvider.resetRunCounts();
      vscode.window.showInformationMessage(
        "Workspace Script Runner: run counts reset",
      );
    },
  );
  context.subscriptions.push(resetRunCountsCommand);

  // Refresh tree when the Frequently Run count setting changes
  const configChangeListener = vscode.workspace.onDidChangeConfiguration(
    (e) => {
      if (e.affectsConfiguration("scriptsRunner.frequentlyRunCount")) {
        treeDataProvider.refresh();
      }
    },
  );
  context.subscriptions.push(configChangeListener);

  // VS Code Task Provider
  const taskProvider = new ScriptRunnerTaskProvider(
    () => treeDataProvider.getAllScripts(),
    terminalManager,
  );
  const taskProviderDisposable = vscode.tasks.registerTaskProvider(
    ScriptRunnerTaskProvider.taskType,
    taskProvider,
  );
  context.subscriptions.push(taskProviderDisposable);
}

/**
 * Extension được deactivate
 */
export function deactivate(): void {
  if (terminalManager) {
    terminalManager.dispose();
  }
}
