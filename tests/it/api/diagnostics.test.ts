import { describe, expect, it } from "vitest";
import { DIAGNOSTIC_CODES, evaluate, parse } from "../../../packages/core/src/index.js";
import type { Diagnostic } from "../../../packages/core/src/index.js";

const stableCodes = [
  "skipped-non-row-line",
  "invalid-sheet-declaration",
  "invalid-alias-declaration",
  "invalid-header-directive",
  "invalid-defaults-directive",
  "unsupported-row-prefix",
  "invalid-formula-modifier-scope",
  "duplicate-sheet-identity",
  "duplicate-alias-identity",
  "formula-syntax-error",
  "formula-reference-error",
  "formula-runtime-error",
  "formula-empty-reference",
  "formula-engine-unavailable",
  "formula-engine-initialization-error",
  "formula-evaluation-error",
  "render-error",
  "ambiguous-workbook-identity",
  "external-source-error",
  "external-source-unsupported",
  "foreign-format-error"
] as const;

describe("diagnostic contract", () => {
  it("keeps the machine-readable code registry stable", () => {
    expect(DIAGNOSTIC_CODES).toEqual(stableCodes);
  });

  it("returns complete structured parser diagnostics", () => {
    const workbook = parse("@sheet Report\nnot a row\n@header nope");
    expect(workbook.diagnostics.length).toBeGreaterThan(0);
    workbook.diagnostics.forEach(assertCompleteDiagnostic);
  });

  it("returns complete structured evaluator diagnostics", async () => {
    const workbook = parse("@sheet Same\n| A |\n@sheet Same\n| B |");
    const evaluated = await evaluate(workbook);
    expect(evaluated.diagnostics.length).toBeGreaterThan(0);
    evaluated.diagnostics.forEach(assertCompleteDiagnostic);
  });
});

function assertCompleteDiagnostic(diagnostic: Diagnostic): void {
  expect(DIAGNOSTIC_CODES).toContain(diagnostic.code);
  expect(["warning", "error"]).toContain(diagnostic.severity);
  expect(Reflect.get(diagnostic, "level")).toBe(diagnostic.severity);
  expect(["parse", "evaluate", "validate", "render"]).toContain(diagnostic.stage);
  expect(["syntax", "identity", "reference", "runtime", "external", "format"]).toContain(diagnostic.category);
  expect(diagnostic.message.length).toBeGreaterThan(0);
}
