import { describe, it, expect, vi, beforeEach } from "vitest";
import { EnumPackageManager, IScriptItem, IWorkspaceProject } from "../types";

/* Mock workspace scanner to return controlled data */
const mockProjects: IWorkspaceProject[] = [];
vi.mock("../workspace", () => ({
  scanWorkspace: () => mockProjects,
}));

import { MockMemento } from "../test/__mocks__/vscode";
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
