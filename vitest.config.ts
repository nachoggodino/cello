import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@cello/core": fileURLToPath(new URL("./packages/core/src/index.ts", import.meta.url)),
      "@cello/editor-core": fileURLToPath(new URL("./packages/editor-core/src/index.ts", import.meta.url)),
      "@cello/editor-react": fileURLToPath(new URL("./packages/editor-react/src/index.ts", import.meta.url)),
      "@nachoggodino/cello/editor-core": fileURLToPath(new URL("./packages/editor-core/src/index.ts", import.meta.url))
    }
  },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx", "tests/it/**/*.test.ts", "tests/e2e/**/*.test.ts", "apps/playground/src/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["packages/core/src/**/*.ts", "packages/cli/src/**/*.ts", "packages/editor-core/src/**/*.ts", "packages/editor-react/src/**/*.{ts,tsx}"],
      exclude: ["packages/core/src/shared/types.ts"],
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 80,
        lines: 80
      }
    }
  }
});
