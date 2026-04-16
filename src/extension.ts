import * as vscode from "vscode";
import { launchDebug } from "./debug";
import { getRunCommand } from "./packageManager";
import { ScriptRunnerTaskProvider } from "./tasks";
import { TerminalManager } from "./terminal";
import { IScriptItem } from "./types";
import {
  RunningScriptsProvider,
  ScriptsTreeDataProvider,
  ScriptTreeItem,
} from "./ui";
import { watchPackageJson } from "./workspace";

let treeDataProvider: ScriptsTreeDataProvider;
let runningScriptsProvider: RunningScriptsProvider;
let terminalManager: TerminalManager;
let packageJsonWatcher: vscode.FileSystemWatcher;
/** Track debug sessions by name so we can stop the correct one */
const debugSessions = new Map<string, vscode.DebugSession>();

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
  terminalManager = new TerminalManager();

  // Register All Scripts TreeView
  const treeView = vscode.window.createTreeView("scriptsRunnerView", {
    treeDataProvider,
    showCollapseAll: true,
  });
  context.subscriptions.push(treeView);

  // Register Running Scripts TreeView
  const runningView = vscode.window.createTreeView("scriptsRunnerRunningView", {
    treeDataProvider: runningScriptsProvider,
  });
  context.subscriptions.push(runningView);

  // Sync running scripts view khi state thay đổi
  const runningChangeListener = treeDataProvider.onRunningScriptsChange(
    (scripts: IScriptItem[]) => {
      runningScriptsProvider.update(scripts);
    },
  );
  context.subscriptions.push(runningChangeListener);

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

  // Restart Script
  const restartScriptCommand = vscode.commands.registerCommand(
    "scriptsRunner.restartScript",
    async (item: ScriptTreeItem) => {
      if (item && item.script) {
        terminalManager.stopScript(item.script);
        await terminalManager.runScript(item.script);
        treeDataProvider.setScriptRunning(
          item.script.project.name,
          item.script.name,
          true,
        );
        vscode.window.showInformationMessage(
          `🔄 Restarted: ${item.script.project.name}/${item.script.name}`,
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
      vscode.window.showInformationMessage("Scripts Runner refreshed");
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
