import { describe, it, expect, vi, beforeEach } from "vitest";
import { EnumPackageManager, IScriptItem, IWorkspaceProject } from "../types";

/* Mock workspace scanner to return controlled data */
const mockProjects: IWorkspaceProject[] = [];
vi.mock("../workspace", () => ({
  scanWorkspace: () => mockProjects,
}));

import { MockMemento, __mockConfig } from "../test/__mocks__/vscode";
import {
  ScriptsTreeDataProvider,
  ScriptTreeItem,
  ProjectTreeItem,
} from "./treeDataProvider";

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

describe("ScriptTreeItem", () => {
  const project = makeProject();
  const script = project.scripts[0];

  it("contextValue = 'script' when idle", () => {
    const item = new ScriptTreeItem(script, "/ext", false, false, false);
    expect(item.contextValue).toBe("script");
  });

  it("contextValue = 'scriptRunning' when running", () => {
    const item = new ScriptTreeItem(script, "/ext", true, false, false);
    expect(item.contextValue).toBe("scriptRunning");
  });

  it("contextValue = 'scriptDebugging' when debugging", () => {
    const item = new ScriptTreeItem(script, "/ext", false, true, false);
    expect(item.contextValue).toBe("scriptDebugging");
  });

  it("contextValue = 'scriptFavorite' when favorite + idle", () => {
    const item = new ScriptTreeItem(script, "/ext", false, false, true);
    expect(item.contextValue).toBe("scriptFavorite");
  });

  it("contextValue = 'scriptFavoriteRunning' when favorite + running", () => {
    const item = new ScriptTreeItem(script, "/ext", true, false, true);
    expect(item.contextValue).toBe("scriptFavoriteRunning");
  });

  it("contextValue = 'scriptFavoriteDebugging' when favorite + debugging", () => {
    const item = new ScriptTreeItem(script, "/ext", false, true, true);
    expect(item.contextValue).toBe("scriptFavoriteDebugging");
  });

  it("description is '★' when favorite", () => {
    const item = new ScriptTreeItem(script, "/ext", false, false, true);
    expect(item.description).toBe("★");
  });

  it("command is runScript when idle", () => {
    const item = new ScriptTreeItem(script, "/ext", false, false, false);
    expect((item.command as { command: string }).command).toBe("scriptsRunner.runScript");
  });

  it("command is stopScript when running", () => {
    const item = new ScriptTreeItem(script, "/ext", true, false, false);
    expect((item.command as { command: string }).command).toBe("scriptsRunner.stopScript");
  });
});

describe("ScriptsTreeDataProvider", () => {
  let provider: ScriptsTreeDataProvider;
  let memento: MockMemento;

  beforeEach(() => {
    const project = makeProject();
    mockProjects.length = 0;
    mockProjects.push(project);
    memento = new MockMemento();
    provider = new ScriptsTreeDataProvider("/ext", memento as unknown as import("vscode").Memento);
  });

  it("getChildren(undefined) returns ProjectTreeItems", async () => {
    const children = await provider.getChildren();
    expect(children).toHaveLength(1);
    expect(children[0]).toBeInstanceOf(ProjectTreeItem);
  });

  it("getChildren(project) returns ScriptTreeItems", async () => {
    const projects = await provider.getChildren();
    const scripts = await provider.getChildren(projects[0]);
    expect(scripts).toHaveLength(2);
    expect(scripts[0]).toBeInstanceOf(ScriptTreeItem);
  });

  it("setScriptRunning / isScriptRunning", () => {
    expect(provider.isScriptRunning("app", "dev")).toBe(false);
    provider.setScriptRunning("app", "dev", true);
    expect(provider.isScriptRunning("app", "dev")).toBe(true);
    provider.setScriptRunning("app", "dev", false);
    expect(provider.isScriptRunning("app", "dev")).toBe(false);
  });

  it("setScriptDebugging / isScriptDebugging", () => {
    expect(provider.isScriptDebugging("app", "dev")).toBe(false);
    provider.setScriptDebugging("app", "dev", true);
    expect(provider.isScriptDebugging("app", "dev")).toBe(true);
    provider.setScriptDebugging("app", "dev", false);
    expect(provider.isScriptDebugging("app", "dev")).toBe(false);
  });

  it("getRunningScriptItems returns only running scripts", () => {
    provider.setScriptRunning("app", "dev", true);
    const running = provider.getRunningScriptItems();
    expect(running).toHaveLength(1);
    expect(running[0].name).toBe("dev");
  });

  it("getAllScripts returns flat list", () => {
    expect(provider.getAllScripts()).toHaveLength(2);
  });

  it("toggleFavorite adds and removes favorites", async () => {
    expect(provider.isFavorite("app", "dev")).toBe(false);
    await provider.toggleFavorite("app", "dev");
    expect(provider.isFavorite("app", "dev")).toBe(true);
    await provider.toggleFavorite("app", "dev");
    expect(provider.isFavorite("app", "dev")).toBe(false);
  });

  it("favorites sort to top in getChildren", async () => {
    await provider.toggleFavorite("app", "build");
    const projects = await provider.getChildren();
    const scripts = await provider.getChildren(projects[0]);
    // "build" is favorite, should be first
    expect((scripts[0] as ScriptTreeItem).script.name).toBe("build");
  });

  it("getProjects returns current projects", () => {
    expect(provider.getProjects()).toHaveLength(1);
    expect(provider.getProjects()[0].name).toBe("app");
  });
});

describe("ScriptsTreeDataProvider - run counts / Frequently Run", () => {
  let provider: ScriptsTreeDataProvider;
  let memento: MockMemento;

  beforeEach(() => {
    const project = makeProject();
    mockProjects.length = 0;
    mockProjects.push(project);
    memento = new MockMemento();
    __mockConfig["scriptsRunner.frequentlyRunCount"] = 5;
    provider = new ScriptsTreeDataProvider("/ext", memento as unknown as import("vscode").Memento);
  });

  it("incrementRunCount stores under 'project||script' key and accumulates", () => {
    provider.incrementRunCount("app", "dev");
    provider.incrementRunCount("app", "dev");
    const counts = memento.get<Record<string, number>>("scriptsRunner.runCounts", {});
    expect(counts["app||dev"]).toBe(2);
  });

  it("getTopRunScripts returns descending order, limited", () => {
    provider.incrementRunCount("app", "build");
    provider.incrementRunCount("app", "dev");
    provider.incrementRunCount("app", "dev");
    const top = provider.getTopRunScripts(5);
    expect(top.map((s) => s.name)).toEqual(["dev", "build"]);
  });

  it("getTopRunScripts respects the limit", () => {
    provider.incrementRunCount("app", "build");
    provider.incrementRunCount("app", "dev");
    expect(provider.getTopRunScripts(1)).toHaveLength(1);
  });

  it("getTopRunScripts filters out scripts no longer in projects", () => {
    provider.incrementRunCount("app", "ghost");
    provider.incrementRunCount("app", "dev");
    const top = provider.getTopRunScripts(5);
    expect(top.map((s) => s.name)).toEqual(["dev"]);
  });

  it("getTopRunScripts(0) returns empty", () => {
    provider.incrementRunCount("app", "dev");
    expect(provider.getTopRunScripts(0)).toHaveLength(0);
  });

  it("root getChildren returns only projects (Frequently Run moved to own view)", async () => {
    provider.incrementRunCount("app", "dev");
    const children = await provider.getChildren();
    expect(children).toHaveLength(1);
    expect(children[0]).toBeInstanceOf(ProjectTreeItem);
  });

  it("makeScriptTreeItem builds a ScriptTreeItem reflecting running state", () => {
    provider.setScriptRunning("app", "dev", true);
    const [devScript] = provider.getProjects()[0].scripts;
    const item = provider.makeScriptTreeItem(devScript);
    expect(item).toBeInstanceOf(ScriptTreeItem);
    expect(item.contextValue).toBe("scriptRunning");
  });

  it("resetRunCounts clears all counts", async () => {
    provider.incrementRunCount("app", "dev");
    await provider.resetRunCounts();
    expect(provider.getTopRunScripts(5)).toHaveLength(0);
  });

  it("removeRunCount drops only the targeted script", async () => {
    provider.incrementRunCount("app", "dev");
    provider.incrementRunCount("app", "build");
    await provider.removeRunCount("app", "dev");
    const top = provider.getTopRunScripts(5);
    expect(top.map((s) => s.name)).toEqual(["build"]);
  });

  it("removeRunCount is a no-op for an unknown script", async () => {
    provider.incrementRunCount("app", "dev");
    await provider.removeRunCount("app", "ghost");
    expect(provider.getTopRunScripts(5).map((s) => s.name)).toEqual(["dev"]);
  });
});
