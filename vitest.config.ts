import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const criticalThreshold = { statements: 85, branches: 75, functions: 85, lines: 85 };

export default defineConfig({
  resolve: {
    alias: {
      "@cello/core": fileURLToPath(new URL("./packages/core/src/index.ts", import.meta.url)),
      "@cello/editor-core": fileURLToPath(new URL("./packages/editor-core/src/internal.ts", import.meta.url)),
      "@cello/editor-react": fileURLToPath(new URL("./packages/editor-react/src/index.ts", import.meta.url)),
      "@nachoggodino/cello/editor-core": fileURLToPath(new URL("./packages/editor-core/src/index.ts", import.meta.url)),
      "@nachoggodino/cello": fileURLToPath(new URL("./packages/core/src/index.ts", import.meta.url))
    }
  },
  test: {
    globals: true,
    include: [
      "tests/unit/**/*.test.ts",
      "tests/unit/**/*.test.tsx",
      "tests/it/**/*.test.ts",
      "tests/e2e/**/*.test.ts",
      "apps/playground/src/**/*.test.ts",
      "apps/vscode/tests/**/*.test.ts"
    ],
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: [
        "packages/core/src/**/*.ts",
        "packages/cli/src/**/*.ts",
        "packages/editor-core/src/**/*.ts",
        "packages/editor-react/src/**/*.{ts,tsx}",
        "apps/vscode/src/externalSources.ts",
        "apps/vscode/src/previewHtml.ts"
      ],
      exclude: ["packages/core/src/shared/types.ts"],
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 80,
        lines: 80,
        "packages/editor-core/src/{document,session}.ts": criticalThreshold,
        "packages/core/src/{parser/source-map,formatter/source-layout,shared/identity,validator/validate,evaluator/evaluate,renderer/render}.ts": criticalThreshold,
        "apps/vscode/src/{externalSources,previewHtml}.ts": criticalThreshold
      }
    }
  }
});
