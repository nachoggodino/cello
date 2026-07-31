import { describe, expect, it, vi } from "vitest";
import { parse } from "../../../packages/core/src/parser/parse.js";

vi.mock("hyperformula", () => {
  throw new Error("module not available");
});

describe("evaluate (without HyperFormula module)", () => {
  it("returns warning diagnostic and keeps formulas unevaluated", async () => {
    const { evaluate } = await import("../../../packages/core/src/evaluator/evaluate.js");
    const ast = parse("@sheet S\n| =1+1 |");
    const out = await evaluate(ast);

    expect(out.diagnostics.some((d) => d.severity === "warning" && d.message.includes("HyperFormula is not available"))).toBe(true);
    expect(out.sheets[0].rows[0].cells[0].computed).toBeUndefined();
  });
});
