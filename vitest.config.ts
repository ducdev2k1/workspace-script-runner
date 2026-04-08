import { defineConfig } from "vitest/config";
import * as path from "path";

export default defineConfig({
  test: {
    globals: true,
    root: ".",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/**/index.ts", "src/test/**/*"],
    },
  },
  resolve: {
    alias: {
      vscode: path.resolve(__dirname, "src/test/__mocks__/vscode.ts"),
    },
  },
});
