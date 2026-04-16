import { describe, it, expect, vi, beforeEach } from "vitest";

/* Mock fs before importing module under test */
vi.mock("fs", () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => "{}"),
  readdirSync: vi.fn(() => []),
}));

/* Mock config module to avoid vscode dependency chain */
vi.mock("../config", () => ({
  resolvePackageManager: (_name: string, detected: string) => detected,
}));

import { parsePackageJson, scanSubFolders } from "./scanner";
import * as fs from "fs";

const mockedReadFileSync = vi.mocked(fs.readFileSync);
const mockedExistsSync = vi.mocked(fs.existsSync);
const mockedReaddirSync = vi.mocked(fs.readdirSync);

describe("parsePackageJson", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns scripts from valid package.json", () => {
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({ scripts: { build: "tsc", dev: "vite" } }),
    );
    expect(parsePackageJson("/app/package.json")).toEqual({
      build: "tsc",
      dev: "vite",
    });
  });

  it("returns {} when no scripts key", () => {
    mockedReadFileSync.mockReturnValue(JSON.stringify({ name: "app" }));
    expect(parsePackageJson("/app/package.json")).toEqual({});
  });

  it("returns {} on invalid JSON", () => {
    mockedReadFileSync.mockReturnValue("not json");
    expect(parsePackageJson("/app/package.json")).toEqual({});
  });

  it("returns {} when file read throws", () => {
    mockedReadFileSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });
    expect(parsePackageJson("/missing/package.json")).toEqual({});
  });
});

describe("scanSubFolders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedExistsSync.mockReturnValue(false);
  });

  it("finds sub-dirs with package.json", () => {
    mockedReaddirSync.mockReturnValue([
      { name: "app-a", isDirectory: () => true } as unknown as fs.Dirent,
    ]);
    mockedExistsSync.mockImplementation((p) => {
      const s = String(p);
      // Lock file check in detectPackageManager + package.json check
      return s.endsWith("package.json") || s.endsWith("pnpm-lock.yaml");
    });
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({ scripts: { build: "tsc" } }),
    );

    const results = scanSubFolders("/root");
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("app-a");
    expect(results[0].scripts).toHaveLength(1);
    expect(results[0].scripts[0].name).toBe("build");
  });

  it("skips node_modules, .git, dist and other SKIP_DIRS", () => {
    const skipNames = ["node_modules", ".git", "dist", "build", ".next", "out", "coverage"];
    mockedReaddirSync.mockReturnValue(
      skipNames.map((name) => ({
        name,
        isDirectory: () => true,
      })) as unknown as fs.Dirent[],
    );

    const results = scanSubFolders("/root");
    expect(results).toHaveLength(0);
    // existsSync should never be called for skipped dirs
    expect(mockedExistsSync).not.toHaveBeenCalled();
  });

  it("skips non-directory entries", () => {
    mockedReaddirSync.mockReturnValue([
      { name: "README.md", isDirectory: () => false } as unknown as fs.Dirent,
    ]);

    expect(scanSubFolders("/root")).toHaveLength(0);
  });

  it("returns [] when readdirSync throws", () => {
    mockedReaddirSync.mockImplementation(() => {
      throw new Error("EACCES");
    });

    expect(scanSubFolders("/root")).toEqual([]);
  });

  it("skips sub-dir without package.json", () => {
    mockedReaddirSync.mockReturnValue([
      { name: "empty-dir", isDirectory: () => true } as unknown as fs.Dirent,
    ]);
    mockedExistsSync.mockReturnValue(false);

    expect(scanSubFolders("/root")).toHaveLength(0);
  });
});
