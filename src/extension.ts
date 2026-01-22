import * as vscode from "vscode";
import { TerminalManager } from "./terminal";
import { ScriptsTreeDataProvider, ScriptTreeItem } from "./ui";
import { watchPackageJson } from "./workspace";

let treeDataProvider: ScriptsTreeDataProvider;
let terminalManager: TerminalManager;
let packageJsonWatcher: vscode.FileSystemWatcher;

/**
 * Extension được activate khi workspace có package.json
 */
export function activate(context: vscode.ExtensionContext): void {
  console.log("Scripts Runner is now active!");

  // Initialize providers với extensionPath
  treeDataProvider = new ScriptsTreeDataProvider(context.extensionPath);
  terminalManager = new TerminalManager();

  // Register TreeView
  const treeView = vscode.window.createTreeView("scriptsRunnerView", {
    treeDataProvider,
    showCollapseAll: true,
  });
  context.subscriptions.push(treeView);

  // Watch package.json changes
  packageJsonWatcher = watchPackageJson(() => {
    treeDataProvider.refresh();
  });
  context.subscriptions.push(packageJsonWatcher);

  // Xử lý khi terminal đóng - update running state
  const terminalCloseListener = vscode.window.onDidCloseTerminal((terminal) => {
    const scriptInfo = terminalManager.handleTerminalClosed(terminal);
    if (scriptInfo) {
      treeDataProvider.setScriptRunning(
        scriptInfo.projectName,
        scriptInfo.scriptName,
        false,
      );
    }
  });
  context.subscriptions.push(terminalCloseListener);

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
    (item: ScriptTreeItem) => {
      if (item && item.script) {
        terminalManager.runScript(item.script);
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

  // Stop Script
  const stopScriptCommand = vscode.commands.registerCommand(
    "scriptsRunner.stopScript",
    (item: ScriptTreeItem) => {
      if (item && item.script) {
        terminalManager.stopScript(item.script);
        treeDataProvider.setScriptRunning(
          item.script.project.name,
          item.script.name,
          false,
        );
        vscode.window.showInformationMessage(
          `⏹ Stopped: ${item.script.project.name}/${item.script.name}`,
        );
      }
    },
  );
  context.subscriptions.push(stopScriptCommand);

  // Restart Script
  const restartScriptCommand = vscode.commands.registerCommand(
    "scriptsRunner.restartScript",
    (item: ScriptTreeItem) => {
      if (item && item.script) {
        terminalManager.restartScript(item.script);
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
}

/**
 * Extension được deactivate
 */
export function deactivate(): void {
  if (terminalManager) {
    terminalManager.dispose();
  }
}
