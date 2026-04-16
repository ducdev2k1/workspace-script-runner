import { describe, it, expect } from "vitest";
import { EnumPackageManager, IScriptItem, IWorkspaceProject } from "../types";
import { RunningScriptsProvider, RunningScriptItem } from "./running-scripts-provider";

const makeScript = (name: string): IScriptItem => {
  const project: IWorkspaceProject = {
    name: "app",
    path: "/workspace/app",
    packageJsonPath: "/workspace/app/package.json",
    packageManager: EnumPackageManager.Npm,
    scripts: [],
  };
  return { name, command: `echo ${name}`, project };
};

describe("RunningScriptItem", () => {
  it("sets label as project > script", () => {
    const item = new RunningScriptItem(makeScript("dev"));
    expect(item.label).toBe("app › dev");
  });

  it("sets contextValue to 'runningScript'", () => {
    const item = new RunningScriptItem(makeScript("dev"));
    expect(item.contextValue).toBe("runningScript");
  });

  it("sets command to focusTerminal", () => {
    const item = new RunningScriptItem(makeScript("dev"));
    expect((item.command as { command: string }).command).toBe("scriptsRunner.focusTerminal");
  });
});

describe("RunningScriptsProvider", () => {
  it("getChildren returns empty initially", () => {
    const provider = new RunningScriptsProvider();
    expect(provider.getChildren()).toHaveLength(0);
  });

  it("getChildren returns RunningScriptItems after update", () => {
    const provider = new RunningScriptsProvider();
    provider.update([makeScript("dev"), makeScript("build")]);
    const children = provider.getChildren();
    expect(children).toHaveLength(2);
    expect(children[0]).toBeInstanceOf(RunningScriptItem);
  });

  it("fires onDidChangeTreeData on update", () => {
    const provider = new RunningScriptsProvider();
    let fired = false;
    provider.onDidChangeTreeData(() => { fired = true; });
    provider.update([makeScript("dev")]);
    expect(fired).toBe(true);
  });
});
