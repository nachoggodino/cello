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

  it("returns invalid with diagnostics when the workbook has warnings", async () => {
    const result = await validate("@sheet S\nnot a row\n| ok |");

    expect(result.valid).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        level: "warning",
        line: 2,
        sheet: "S"
      })
    );
  });
});
