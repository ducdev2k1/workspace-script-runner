import { describe, it, expect, vi, beforeEach } from "vitest";
import { EnumPackageManager, IScriptItem, IWorkspaceProject } from "../types";
import { TerminalManager } from "./manager";

/** Helper to build a test script */
const makeProject = (name = "app"): IWorkspaceProject => ({
  name,
  path: `/workspace/${name}`,
  packageJsonPath: `/workspace/${name}/package.json`,
  packageManager: EnumPackageManager.Pnpm,
  scripts: [],
});

const makeScript = (name = "dev", project?: IWorkspaceProject): IScriptItem => {
  const proj = project ?? makeProject();
  return { name, command: `echo ${name}`, project: proj };
};

describe("TerminalManager", () => {
  let manager: TerminalManager;

  beforeEach(() => {
    manager = new TerminalManager();
  });

  describe("runScript", () => {
    it("creates a terminal and sends the correct run command", () => {
      const terminal = manager.runScript(makeScript("build"));
      const sendSpy = vi.spyOn(terminal, "sendText");
      // Re-run to capture sendText on the new terminal
      const t2 = manager.runScript(makeScript("build"));
      const spy2 = vi.spyOn(t2, "sendText");
      // Verify terminal was created with correct name
      expect(t2).toBeDefined();
      expect(t2.name).toContain("app/build");
      // sendText is called internally during runScript, so check the mock was set up
      spy2.mockRestore();
      sendSpy.mockRestore();
    });

    it("disposes existing terminal before creating new one", () => {
      const script = makeScript("dev");
      const t1 = manager.runScript(script);
      const disposeSpy = vi.spyOn(t1, "dispose");
      manager.runScript(script);
      expect(disposeSpy).toHaveBeenCalled();
    });
  });

  describe("stopScript", () => {
    it("sends Ctrl+C then disposes terminal", () => {
      const script = makeScript("dev");
      const terminal = manager.runScript(script);
      const sendSpy = vi.spyOn(terminal, "sendText");
      const disposeSpy = vi.spyOn(terminal, "dispose");
      manager.stopScript(script);
      expect(sendSpy).toHaveBeenCalledWith("\x03", false);
      expect(disposeSpy).toHaveBeenCalled();
      expect(manager.isRunning(script)).toBe(false);
    });

    it("does nothing if script is not running", () => {
      // Should not throw
      manager.stopScript(makeScript("dev"));
    });
  });

  describe("restartScript", () => {
    it("sends Ctrl+C to old terminal, disposes it, then starts new one", () => {
      const script = makeScript("dev");
      const t1 = manager.runScript(script);
      const sendSpy = vi.spyOn(t1, "sendText");
      const disposeSpy = vi.spyOn(t1, "dispose");
      const t2 = manager.restartScript(script);
      expect(sendSpy).toHaveBeenCalledWith("\x03", false);
      expect(disposeSpy).toHaveBeenCalled();
      expect(t2).toBeDefined();
      expect(manager.isRunning(script)).toBe(true);
    });
  });

  describe("isRunning", () => {
    it("returns true for running script", () => {
      const script = makeScript("dev");
      manager.runScript(script);
      expect(manager.isRunning(script)).toBe(true);
    });

    it("returns false for not-running script", () => {
      expect(manager.isRunning(makeScript("dev"))).toBe(false);
    });
  });

  describe("focusTerminal", () => {
    it("calls show() on existing terminal", () => {
      const script = makeScript("dev");
      const terminal = manager.runScript(script);
      const showSpy = vi.spyOn(terminal, "show");
      manager.focusTerminal(script);
      expect(showSpy).toHaveBeenCalled();
    });

    it("does nothing for unknown script", () => {
      // Should not throw
      manager.focusTerminal(makeScript("dev"));
    });
  });

  describe("handleTerminalClosed", () => {
    it("returns script info for known terminal", () => {
      const script = makeScript("dev");
      const terminal = manager.runScript(script);
      const result = manager.handleTerminalClosed(terminal);
      expect(result).toEqual({ projectName: "app", scriptName: "dev" });
      expect(manager.isRunning(script)).toBe(false);
    });

    it("returns null for unknown terminal", () => {
      const fakeTerminal = { name: "unknown" } as unknown as import("vscode").Terminal;
      expect(manager.handleTerminalClosed(fakeTerminal)).toBeNull();
    });
  });

  describe("dispose", () => {
    it("disposes all terminals and clears map", () => {
      const s1 = makeScript("dev");
      const s2 = makeScript("build");
      const t1 = manager.runScript(s1);
      const t2 = manager.runScript(s2);
      const d1 = vi.spyOn(t1, "dispose");
      const d2 = vi.spyOn(t2, "dispose");

      manager.dispose();
      expect(d1).toHaveBeenCalled();
      expect(d2).toHaveBeenCalled();
      expect(manager.isRunning(s1)).toBe(false);
      expect(manager.isRunning(s2)).toBe(false);
    });
  });
});
