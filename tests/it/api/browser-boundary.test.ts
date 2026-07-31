import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const browserEntrySources = [
  "packages/core/src/parser/parse.ts",
  "packages/core/src/evaluator/evaluate.ts",
  "packages/core/src/evaluator/formula.ts",
  "packages/core/src/formatter/source-layout.ts",
  "packages/core/src/renderer/render.ts",
  "packages/core/src/validator/validate.ts",
  "packages/editor-core/src/index.ts"
];

describe("browser package boundary", () => {
  it("does not import Node built-ins from browser entry modules", () => {
    for (const relativePath of browserEntrySources) {
      expect(readFileSync(resolve(root, relativePath), "utf8"), relativePath).not.toMatch(/from ["'](?:node:|fs["']|path["']|url["'])/);
    }
  });
});
