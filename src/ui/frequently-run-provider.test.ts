import { describe, it, expect, vi, beforeEach } from "vitest";
import { EnumPackageManager, IWorkspaceProject } from "../types";

/* Mock workspace scanner to return controlled data */
const mockProjects: IWorkspaceProject[] = [];
vi.mock("../workspace", () => ({
  scanWorkspace: () => mockProjects,
}));

import { MockMemento, __mockConfig } from "../test/__mocks__/vscode";
import { ScriptsTreeDataProvider, ScriptTreeItem } from "./treeDataProvider";
import { FrequentlyRunProvider } from "./frequently-run-provider";

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

describe("FrequentlyRunProvider", () => {
  let source: ScriptsTreeDataProvider;
  let provider: FrequentlyRunProvider;

  beforeEach(() => {
    mockProjects.length = 0;
    mockProjects.push(makeProject());
    __mockConfig["scriptsRunner.frequentlyRunCount"] = 5;
    source = new ScriptsTreeDataProvider(
      "/ext",
      new MockMemento() as unknown as import("vscode").Memento,
    );
    provider = new FrequentlyRunProvider(source);
  });

  it("getChildren returns empty when no run history", () => {
    expect(provider.getChildren()).toHaveLength(0);
  });

  it("getChildren returns top run scripts as ScriptTreeItems, desc by count", () => {
    source.incrementRunCount("app", "build");
    source.incrementRunCount("app", "dev");
    source.incrementRunCount("app", "dev");
    const children = provider.getChildren();
    expect(children.every((c) => c instanceof ScriptTreeItem)).toBe(true);
    expect(children.map((c) => c.script.name)).toEqual(["dev", "build"]);
  });

  it("getChildren reflects running state via contextValue", () => {
    source.incrementRunCount("app", "dev");
    source.setScriptRunning("app", "dev", true);
    const [first] = provider.getChildren();
    expect(first.contextValue).toBe("scriptRunning");
  });

  it("click focuses terminal instead of re-running the script", () => {
    source.incrementRunCount("app", "dev");
    const [first] = provider.getChildren();
    expect(first.command?.command).toBe("scriptsRunner.focusTerminal");
    // arg là IScriptItem, không phải tree item (khớp focusTerminal handler)
    expect(first.command?.arguments?.[0]).toBe(first.script);
  });

  it("getChildren honors frequentlyRunCount setting", () => {
    source.incrementRunCount("app", "build");
    source.incrementRunCount("app", "dev");
    __mockConfig["scriptsRunner.frequentlyRunCount"] = 1;
    expect(provider.getChildren()).toHaveLength(1);
  });
});
