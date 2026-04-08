import { describe, it, expect } from "vitest";
import {
  EnumPackageManager,
  LOCK_FILE_MAP,
  LOCK_FILE_PRIORITY,
} from "./index";

describe("EnumPackageManager", () => {
  it("has correct string values", () => {
    expect(EnumPackageManager.Npm).toBe("npm");
    expect(EnumPackageManager.Yarn).toBe("yarn");
    expect(EnumPackageManager.Pnpm).toBe("pnpm");
    expect(EnumPackageManager.Bun).toBe("bun");
  });
});

describe("LOCK_FILE_MAP", () => {
  it("maps lock files to correct package managers", () => {
    expect(LOCK_FILE_MAP["pnpm-lock.yaml"]).toBe(EnumPackageManager.Pnpm);
    expect(LOCK_FILE_MAP["yarn.lock"]).toBe(EnumPackageManager.Yarn);
    expect(LOCK_FILE_MAP["bun.lockb"]).toBe(EnumPackageManager.Bun);
    expect(LOCK_FILE_MAP["package-lock.json"]).toBe(EnumPackageManager.Npm);
  });
});

describe("LOCK_FILE_PRIORITY", () => {
  it("has correct priority order: pnpm > yarn > bun > npm", () => {
    expect(LOCK_FILE_PRIORITY).toEqual([
      "pnpm-lock.yaml",
      "yarn.lock",
      "bun.lockb",
      "package-lock.json",
    ]);
  });

  it("every entry exists in LOCK_FILE_MAP", () => {
    for (const lockFile of LOCK_FILE_PRIORITY) {
      expect(LOCK_FILE_MAP).toHaveProperty(lockFile);
    }
  });
});
