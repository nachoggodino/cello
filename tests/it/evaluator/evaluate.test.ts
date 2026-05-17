import { describe, expect, it } from "vitest";
import { evaluate } from "../../../src/evaluator/evaluate.js";
import { parse } from "../../../src/parser/parse.js";

describe("evaluate", () => {
  it("evaluates simple formulas", async () => {
    const ast = parse("@sheet S\n| 2 | 3 | =A1+B1 |");
    const out = await evaluate(ast);
    const cell = out.sheets[0].rows[0].cells[2];
    expect(cell.kind).toBe("formula");
    expect(cell.computed).toBe(5);
  });

  it("supports cross-sheet A1 references", async () => {
    const ast = parse("@sheet A\n| 7 |\n@sheet B\n| =A!A1*2 |");
    const out = await evaluate(ast);
    const cell = out.sheets[1].rows[0].cells[0];
    expect(cell.kind).toBe("formula");
    expect(cell.computed).toBe(14);
  });

  it("supports named column ranges on current sheet", async () => {
    const ast = parse("@sheet S\n@header | Price | Qty | Total |\n| 2 | 3 | =SUM(Price) |\n| 4 | 5 | =SUM(Price[2:3]) |");
    const out = await evaluate(ast);
    expect(out.sheets[0].rows[1].cells[2].computed).toBe(6);
    expect(out.sheets[0].rows[2].cells[2].computed).toBe(6);
  });

  it("supports named column ranges across sheets", async () => {
    const ast = parse("@sheet Data\n@header | Amount |\n| 5 |\n| 7 |\n@sheet Report\n| =SUM(Data!Amount) |");
    const out = await evaluate(ast);
    expect(out.sheets[1].rows[0].cells[0].computed).toBe(12);
  });

  it("supports !! as alias for first sheet references", async () => {
    const ast = parse("@sheet Data\n@header | Amount |\n| 9 |\n| 1 |\n@sheet KPIs\n| =SUM(!!Amount) |");
    const out = await evaluate(ast);
    expect(out.sheets[1].rows[0].cells[0].computed).toBe(10);
  });

  it("supports same-sheet totals without self-referential cycles", async () => {
    const ast = parse(
      "@sheet Regions\n@header | Region | Revenue | Units | Avg |\n| Madrid | 4280 | 15 | =Revenue/Units |\n| Barcelona | 2080 | 7 | =Revenue/Units |\n| Valencia | 760 | 2 | =Revenue/Units |\n| TOTAL | =SUM(Revenue) | =SUM(Units) | =SUM(Revenue)/SUM(Units) |"
    );
    const out = await evaluate(ast);
    expect(out.sheets[0].rows[1].cells[3].computed).toBeCloseTo(285.33333333, 8);
    expect(out.sheets[0].rows[4].cells[1].computed).toBe(7120);
    expect(out.sheets[0].rows[4].cells[2].computed).toBe(24);
    expect(out.sheets[0].rows[4].cells[3].computed).toBeCloseTo(296.66666667, 8);
  });

  it("supports [*] to force full-column ranges", async () => {
    const ast = parse("@sheet S\n@header | Amount | Total |\n| 5 | =SUM(Amount[*]) |\n| 7 | =SUM(Amount[*]) |");
    const out = await evaluate(ast);
    expect(out.sheets[0].rows[1].cells[1].computed).toBe(12);
    expect(out.sheets[0].rows[2].cells[1].computed).toBe(12);
  });

  it("evaluates column default formulas for empty cells", async () => {
    const ast = parse("@sheet S\n@header | Qty | Price | Total |\n@defaults | | | =Qty*Price |\n| 2 | 3 |\n| 4 | 5 | 99 |");
    const out = await evaluate(ast);
    expect(out.sheets[0].rows[1].cells[2]).toMatchObject({ kind: "formula", formula: "=Qty*Price", computed: 6 });
    expect(out.sheets[0].rows[2].cells[2]).toMatchObject({ kind: "value", value: 99 });
  });

  it("does not mutate the original AST", async () => {
    const ast = parse("@sheet S\n| 1 | 2 | =A1+B1 |");
    const original = ast.sheets[0].rows[0].cells[2];
    expect(original.computed).toBeUndefined();

    const out = await evaluate(ast);
    expect(out.sheets[0].rows[0].cells[2].computed).toBe(3);
    expect(ast.sheets[0].rows[0].cells[2].computed).toBeUndefined();
  });
});
