import { describe, expect, it } from "vitest";
import { buildWorkbookRefIndex, translateFormulaForEngine } from "../../../src/evaluator/formula.js";
import { parse } from "../../../src/parser/parse.js";

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

  it("keeps !! token when workbook has no sheets", () => {
    const index = buildWorkbookRefIndex({ version: "1.0", sheets: [], diagnostics: [] });
    const diagnostics: Array<{ level: "warning" | "error"; message: string; sheet?: string }> = [];
    const translated = translateFormulaForEngine("=SUM(!!Amount)", "S", index, diagnostics);
    expect(translated).toBe("=SUM(!!Amount)");
  });

  it("does not rewrite cross-sheet A1 refs or unknown sheet/column refs", () => {
    const ast = parse("@sheet Data\n-Amount-\n| 1 |");
    const index = buildWorkbookRefIndex(ast);
    expect(translateFormulaForEngine("=Data!A1", "Data", index, ast.diagnostics)).toBe("=Data!A1");
    expect(translateFormulaForEngine("=Ghost!Amount", "Data", index, ast.diagnostics)).toBe("=Ghost!Amount");
    expect(translateFormulaForEngine("=Data!Missing", "Data", index, ast.diagnostics)).toBe("=Data!Missing");
  });

  it("adds diagnostics when named refs target sheets without data rows", () => {
    const ast = parse("@sheet Empty\n-Amount-\n@sheet KPIs\n-Amount-\n| 1 |");
    const index = buildWorkbookRefIndex(ast);
    const diagnostics = ast.diagnostics;

    const t1 = translateFormulaForEngine("=SUM(Empty!Amount)", "KPIs", index, diagnostics);
    const t2 = translateFormulaForEngine("=SUM(Amount)", "Empty", index, diagnostics);

    expect(t1).toBe("=SUM(Empty!Amount)");
    expect(t2).toBe("=SUM(Amount)");
    expect(diagnostics.some((d) => d.message.includes('Empty!Amount') && d.level === "warning")).toBe(true);
    expect(diagnostics.some((d) => d.message.includes('Named reference "Amount"') && d.level === "warning")).toBe(true);
  });

  it("translates named slices and preserves keywords/functions", () => {
    const ast = parse("@sheet S\n-Amount-\n| 5 |\n| 7 |");
    const index = buildWorkbookRefIndex(ast);
    const diagnostics = ast.diagnostics;

    expect(translateFormulaForEngine("=SUM(Amount[2:3])", "S", index, diagnostics)).toBe("=SUM(A2:A3)");
    expect(translateFormulaForEngine("=IF(TRUE,FALSE,TRUE)", "S", index, diagnostics)).toBe("=IF(TRUE,FALSE,TRUE)");
  });

  it("keeps unresolved tokens when sheetName is not present in the index", () => {
    const ast = parse("@sheet Data\n-Amount-\n| 3 |");
    const index = buildWorkbookRefIndex(ast);
    const translated = translateFormulaForEngine("=SUM(Amount)", "MissingSheet", index, ast.diagnostics);
    expect(translated).toBe("=SUM(Amount)");
  });
});

