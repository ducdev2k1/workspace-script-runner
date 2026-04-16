import { describe, it, expect, vi, beforeEach } from "vitest";
import { EnumPackageManager } from "../types";

/* Mock fs before importing the module under test */
vi.mock("fs", () => ({
  existsSync: vi.fn(() => false),
}));

import { detectPackageManager, getRunCommand } from "./detector";
import * as fs from "fs";

const mockedExistsSync = vi.mocked(fs.existsSync);

describe("getRunCommand", () => {
  it("npm → npm run <script>", () => {
    expect(getRunCommand(EnumPackageManager.Npm, "build")).toBe("npm run build");
  });

  it("yarn → yarn <script> (no run)", () => {
    expect(getRunCommand(EnumPackageManager.Yarn, "dev")).toBe("yarn dev");
  });

  it("pnpm → pnpm run <script>", () => {
    expect(getRunCommand(EnumPackageManager.Pnpm, "test")).toBe("pnpm run test");
  });

  it("bun → bun run <script>", () => {
    expect(getRunCommand(EnumPackageManager.Bun, "start")).toBe("bun run start");
  });
});

describe("detectPackageManager", () => {
  beforeEach(() => {
    mockedExistsSync.mockReset();
  });

  it("detects pnpm when pnpm-lock.yaml exists", () => {
    mockedExistsSync.mockImplementation((p) =>
      String(p).endsWith("pnpm-lock.yaml"),
    );
    expect(detectPackageManager("/project")).toBe(EnumPackageManager.Pnpm);
  });

  it("detects yarn when yarn.lock exists", () => {
    mockedExistsSync.mockImplementation((p) =>
      String(p).endsWith("yarn.lock"),
    );
    expect(detectPackageManager("/project")).toBe(EnumPackageManager.Yarn);
  });

  it("detects bun when bun.lockb exists", () => {
    mockedExistsSync.mockImplementation((p) =>
      String(p).endsWith("bun.lockb"),
    );
    expect(detectPackageManager("/project")).toBe(EnumPackageManager.Bun);
  });

  it("detects npm when package-lock.json exists", () => {
    mockedExistsSync.mockImplementation((p) =>
      String(p).endsWith("package-lock.json"),
    );
    expect(detectPackageManager("/project")).toBe(EnumPackageManager.Npm);
  });

  it("falls back to npm when no lock file found", () => {
    mockedExistsSync.mockReturnValue(false);
    expect(detectPackageManager("/project")).toBe(EnumPackageManager.Npm);
  });

  it("returns highest priority when multiple lock files exist", () => {
    // Both pnpm-lock.yaml and yarn.lock exist → pnpm wins
    mockedExistsSync.mockImplementation((p) => {
      const s = String(p);
      return s.endsWith("pnpm-lock.yaml") || s.endsWith("yarn.lock");
    });
    expect(detectPackageManager("/project")).toBe(EnumPackageManager.Pnpm);
  });
});
