import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@cello/core": fileURLToPath(new URL("./packages/core/src/index.ts", import.meta.url))
    }
  },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/it/**/*.test.ts", "tests/e2e/**/*.test.ts", "apps/playground/src/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["packages/core/src/**/*.ts", "packages/cli/src/**/*.ts"],
      exclude: ["packages/core/src/shared/types.ts"]
    }
  }
});
