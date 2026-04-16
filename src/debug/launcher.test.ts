import { describe, it, expect, vi } from "vitest";
import { buildDebugConfig, launchDebug } from "./launcher";
import { EnumPackageManager, IScriptItem, IWorkspaceProject } from "../types";
import { debug } from "vscode";

/** Helper to build a test script item */
const makeScript = (pm: EnumPackageManager, scriptName = "dev"): IScriptItem => {
  const project: IWorkspaceProject = {
    name: "my-app",
    path: "/workspace/my-app",
    packageJsonPath: "/workspace/my-app/package.json",
    packageManager: pm,
    scripts: [],
  };
  return { name: scriptName, command: `echo ${scriptName}`, project };
};

describe("buildDebugConfig", () => {
  it("returns correct config shape", () => {
    const config = buildDebugConfig(makeScript(EnumPackageManager.Npm));
    expect(config).toMatchObject({
      type: "node",
      request: "launch",
      console: "integratedTerminal",
      skipFiles: ["<node_internals>/**"],
    });
  });

  it("sets name as Debug: <project>/<script>", () => {
    const config = buildDebugConfig(makeScript(EnumPackageManager.Npm, "build"));
    expect(config.name).toBe("Debug: my-app/build");
  });

  it("sets cwd to project path", () => {
    const config = buildDebugConfig(makeScript(EnumPackageManager.Npm));
    expect(config.cwd).toBe("/workspace/my-app");
  });

  it.each([
    [EnumPackageManager.Npm, "npm"],
    [EnumPackageManager.Yarn, "yarn"],
    [EnumPackageManager.Pnpm, "pnpm"],
    [EnumPackageManager.Bun, "bun"],
  ])("uses %s executable for %s", (pm, expected) => {
    const config = buildDebugConfig(makeScript(pm));
    expect(config.runtimeExecutable).toBe(expected);
  });

  it("passes script name in runtimeArgs", () => {
    const config = buildDebugConfig(makeScript(EnumPackageManager.Pnpm, "test"));
    expect(config.runtimeArgs).toEqual(["run", "test"]);
  });
});

describe("launchDebug", () => {
  it("calls vscode.debug.startDebugging with correct config", async () => {
    const spy = vi.spyOn(debug, "startDebugging");
    const script = makeScript(EnumPackageManager.Npm, "dev");
    const result = await launchDebug(script);
    expect(result).toBe(true);
    expect(spy).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ name: "Debug: my-app/dev" }),
    );
    spy.mockRestore();
  });
});
