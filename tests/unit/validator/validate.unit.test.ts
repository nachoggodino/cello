import { describe, expect, it } from "vitest";
import { validate } from "../../../packages/core/src/validator/validate.js";

describe("validate", () => {
  it("returns valid when parsing and evaluation produce no diagnostics", async () => {
    const result = await validate("@sheet S\n| A | 1 |");

    expect(result).toEqual({
      valid: true,
      diagnostics: []
    });
  });

  it("keeps warning-only workbooks valid by default", async () => {
    const result = await validate("@sheet S\nnot a row\n| ok |");

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ level: "warning", line: 2, sheet: "S" }));
  });

  it("can treat warnings as errors for repository checks", async () => {
    const result = await validate("@sheet S\nnot a row\n| ok |", { warningsAsErrors: true });
    expect(result.valid).toBe(false);
  });

  it.each([
    ["=1/0", "formula-runtime-error"],
    ["=MissingName", "formula-reference-error"],
    ["=1+", "formula-syntax-error"]
  ])("returns invalid for formula failure %s", async (formula, code) => {
    const result = await validate(`@sheet S\n| ${formula} |`);

    expect(result.valid).toBe(false);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ level: "error", code }));
  });

  it("supports explicit structural-only validation", async () => {
    const result = await validate("@sheet S\n| =1/0 |", { structuralOnly: true });
    expect(result).toEqual({ valid: true, diagnostics: [] });
  });
});
