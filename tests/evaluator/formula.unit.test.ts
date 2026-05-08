import { describe, expect, it } from "vitest";
import { buildWorkbookRefIndex, translateFormulaForEngine } from "../../src/evaluator/formula.js";
import { parse } from "../../src/parser/parse.js";

describe("formula translation", () => {
  it("translates current-sheet named ranges", () => {
    const ast = parse("@sheet S\n-Amount-\n| 5 |\n| 7 |");
    const index = buildWorkbookRefIndex(ast);
    const diagnostics = ast.diagnostics;
    const translated = translateFormulaForEngine("=SUM(Amount)", "S", index, diagnostics);
    expect(translated).toBe("=SUM(A2:A3)");
  });

  it("translates cross-sheet named ranges and !! alias", () => {
    const ast = parse("@sheet Data\n-Amount-\n| 5 |\n| 7 |\n@sheet KPIs\n| 1 |");
    const index = buildWorkbookRefIndex(ast);
    const diagnostics = ast.diagnostics;
    const t1 = translateFormulaForEngine("=SUM(Data!Amount)", "KPIs", index, diagnostics);
    const t2 = translateFormulaForEngine("=SUM(!!Amount)", "KPIs", index, diagnostics);
    expect(t1).toBe("=SUM(Data!A2:A3)");
    expect(t2).toBe("=SUM(Data!A2:A3)");
  });

  it("keeps unresolved names unchanged", () => {
    const ast = parse("@sheet S\n-Amount-\n| 5 |");
    const index = buildWorkbookRefIndex(ast);
    const translated = translateFormulaForEngine("=SUM(Unknown)", "S", index, ast.diagnostics);
    expect(translated).toBe("=SUM(Unknown)");
  });
});

