import { describe, it, expect } from "vitest";
import { EnumPackageManager, IScriptItem, IWorkspaceProject } from "../types";
import { TerminalManager } from "../terminal";
import { ScriptRunnerTaskProvider } from "./script-runner-task-provider";

const makeProject = (name = "app"): IWorkspaceProject => {
  const project: IWorkspaceProject = {
    name,
    path: `/workspace/${name}`,
    packageJsonPath: `/workspace/${name}/package.json`,
    packageManager: EnumPackageManager.Pnpm,
    scripts: [],
  };
  project.scripts = [
    { name: "dev", command: "vite", project },
    { name: "build", command: "tsc", project },
  ];
  return project;
};

describe("ScriptRunnerTaskProvider", () => {
  const project = makeProject();
  const scripts: IScriptItem[] = project.scripts;
  const terminalManager = new TerminalManager();

  it("provideTasks returns a Task for each script", () => {
    const provider = new ScriptRunnerTaskProvider(() => scripts, terminalManager);
    const tasks = provider.provideTasks();
    expect(tasks).toHaveLength(2);
    expect(tasks[0].name).toBe("app: dev");
    expect(tasks[1].name).toBe("app: build");
  });

  it("resolveTask matches by script name + folder", () => {
    const provider = new ScriptRunnerTaskProvider(() => scripts, terminalManager);
    const mockTask = {
      definition: {
        type: "script-runner",
        script: "dev",
        folder: "/workspace/app",
      },
    } as never;
    const resolved = provider.resolveTask(mockTask);
    expect(resolved).toBeDefined();
    expect(resolved!.name).toBe("app: dev");
  });

  it("resolveTask returns undefined for non-matching", () => {
    const provider = new ScriptRunnerTaskProvider(() => scripts, terminalManager);
    const mockTask = {
      definition: {
        type: "script-runner",
        script: "unknown",
        folder: "/workspace/app",
      },
    } as never;
    expect(provider.resolveTask(mockTask)).toBeUndefined();
  });

  it("resolveTask returns undefined for wrong type", () => {
    const provider = new ScriptRunnerTaskProvider(() => scripts, terminalManager);
    const mockTask = {
      definition: {
        type: "other-type",
        script: "dev",
        folder: "/workspace/app",
      },
    } as never;
    expect(provider.resolveTask(mockTask)).toBeUndefined();
  });

  it("taskType is 'script-runner'", () => {
    expect(ScriptRunnerTaskProvider.taskType).toBe("script-runner");
  });
});
