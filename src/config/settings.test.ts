import { describe, it, expect, beforeEach } from "vitest";
import { __mockConfig } from "../test/__mocks__/vscode";
import { EnumPackageManager } from "../types";
import {
  getDefaultPackageManager,
  getWorkspaceOverride,
  resolvePackageManager,
} from "./settings";

describe("getDefaultPackageManager", () => {
  beforeEach(() => {
    __mockConfig["scriptsRunner.defaultPackageManager"] = "auto";
    __mockConfig["scriptsRunner.workspacePackageManager"] = {};
  });

  it("returns 'auto' by default", () => {
    expect(getDefaultPackageManager()).toBe("auto");
  });

  it("returns configured value", () => {
    __mockConfig["scriptsRunner.defaultPackageManager"] = "pnpm";
    expect(getDefaultPackageManager()).toBe("pnpm");
  });
});

describe("getWorkspaceOverride", () => {
  beforeEach(() => {
    __mockConfig["scriptsRunner.workspacePackageManager"] = {};
  });

  it("returns undefined when no override set", () => {
    expect(getWorkspaceOverride("my-app")).toBeUndefined();
  });

  it("returns override for matching project", () => {
    __mockConfig["scriptsRunner.workspacePackageManager"] = {
      "my-app": "yarn",
    };
    expect(getWorkspaceOverride("my-app")).toBe("yarn");
  });
});

describe("resolvePackageManager", () => {
  beforeEach(() => {
    __mockConfig["scriptsRunner.defaultPackageManager"] = "auto";
    __mockConfig["scriptsRunner.workspacePackageManager"] = {};
  });

  it("returns workspace override when set (highest priority)", () => {
    __mockConfig["scriptsRunner.workspacePackageManager"] = {
      "my-app": "yarn",
    };
    const result = resolvePackageManager("my-app", EnumPackageManager.Npm);
    expect(result).toBe("yarn");
  });

  it("returns user default when not 'auto' and no override", () => {
    __mockConfig["scriptsRunner.defaultPackageManager"] = "pnpm";
    const result = resolvePackageManager("my-app", EnumPackageManager.Npm);
    expect(result).toBe("pnpm");
  });

  it("returns detected manager when default is 'auto' and no override", () => {
    const result = resolvePackageManager("my-app", EnumPackageManager.Bun);
    expect(result).toBe("bun");
  });
});
