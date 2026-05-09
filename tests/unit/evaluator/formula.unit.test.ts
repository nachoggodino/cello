import { describe, expect, it } from "vitest";
import { buildWorkbookRefIndex, translateFormulaForEngine } from "../../../src/evaluator/formula.js";
import type { CellNode, WorkbookAst } from "../../../src/shared/types.js";

function createWorkbook(
  sheets: Array<{
    name: string;
    columns?: string[];
    dataRows?: Array<Array<string | number | boolean>>;
  }>
): WorkbookAst {
  return {
    version: "1.0",
    diagnostics: [],
    sheets: sheets.map((sheet) => {
      const columns = (sheet.columns ?? []).map((name, index) => ({
        index: index + 1,
        letter: String.fromCharCode(65 + index),
        name,
        modifiers: [],
        hidden: false
      }));
      const rows = (sheet.dataRows ?? []).map((values, rowIndex) => ({
        index: rowIndex + 2,
        kind: "data" as const,
        sourceLine: rowIndex + 1,
        modifiers: [],
        cells: values.map((value, colIndex) => createValueCell(rowIndex + 2, colIndex + 1, value))
      }));
      return {
        name: sheet.name,
        format: { kind: "cello" as const },
        rows,
        columns
      };
    })
  };
}

function createValueCell(row: number, col: number, value: string | number | boolean): CellNode {
  return {
    row,
    col,
    raw: String(value),
    kind: "value",
    inferredType: typeof value === "number" ? "number" : typeof value === "boolean" ? "boolean" : "text",
    value,
    modifiers: [],
    colspan: 1,
    rowspan: 1
  };
}

describe("formula translation", () => {
  it("translates current-sheet named ranges", () => {
    const ast = createWorkbook([{ name: "S", columns: ["Amount"], dataRows: [[5], [7]] }]);
    const index = buildWorkbookRefIndex(ast);
    const translated = translateFormulaForEngine("=SUM(Amount)", "S", index, ast.diagnostics);
    expect(translated).toBe("=SUM(A2:A3)");
  });

  it("translates cross-sheet named ranges and !! alias", () => {
    const ast = createWorkbook([
      { name: "Data", columns: ["Amount"], dataRows: [[5], [7]] },
      { name: "KPIs", columns: ["Value"], dataRows: [[1]] }
    ]);
    const index = buildWorkbookRefIndex(ast);
    const t1 = translateFormulaForEngine("=SUM(Data!Amount)", "KPIs", index, ast.diagnostics);
    const t2 = translateFormulaForEngine("=SUM(!!Amount)", "KPIs", index, ast.diagnostics);
    expect(t1).toBe("=SUM(Data!A2:A3)");
    expect(t2).toBe("=SUM(Data!A2:A3)");
  });

  it("keeps unresolved names unchanged", () => {
    const ast = createWorkbook([{ name: "S", columns: ["Amount"], dataRows: [[5]] }]);
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
    const ast = createWorkbook([{ name: "Data", columns: ["Amount"], dataRows: [[1]] }]);
    const index = buildWorkbookRefIndex(ast);
    expect(translateFormulaForEngine("=Data!A1", "Data", index, ast.diagnostics)).toBe("=Data!A1");
    expect(translateFormulaForEngine("=Ghost!Amount", "Data", index, ast.diagnostics)).toBe("=Ghost!Amount");
    expect(translateFormulaForEngine("=Data!Missing", "Data", index, ast.diagnostics)).toBe("=Data!Missing");
  });

  it("adds diagnostics when named refs target sheets without data rows", () => {
    const ast = createWorkbook([
      { name: "Empty", columns: ["Amount"], dataRows: [] },
      { name: "KPIs", columns: ["Amount"], dataRows: [[1]] }
    ]);
    const index = buildWorkbookRefIndex(ast);

    const t1 = translateFormulaForEngine("=SUM(Empty!Amount)", "KPIs", index, ast.diagnostics);
    const t2 = translateFormulaForEngine("=SUM(Amount)", "Empty", index, ast.diagnostics);

    expect(t1).toBe("=SUM(Empty!Amount)");
    expect(t2).toBe("=SUM(Amount)");
    expect(ast.diagnostics.some((d) => d.message.includes('Empty!Amount') && d.level === "warning")).toBe(true);
    expect(ast.diagnostics.some((d) => d.message.includes('Named reference "Amount"') && d.level === "warning")).toBe(
      true
    );
  });

  it("translates named slices and preserves keywords/functions", () => {
    const ast = createWorkbook([{ name: "S", columns: ["Amount"], dataRows: [[5], [7]] }]);
    const index = buildWorkbookRefIndex(ast);

    expect(translateFormulaForEngine("=SUM(Amount[2:3])", "S", index, ast.diagnostics)).toBe("=SUM(A2:A3)");
    expect(translateFormulaForEngine("=IF(TRUE,FALSE,TRUE)", "S", index, ast.diagnostics)).toBe("=IF(TRUE,FALSE,TRUE)");
  });

  it("keeps unresolved tokens when sheetName is not present in the index", () => {
    const ast = createWorkbook([{ name: "Data", columns: ["Amount"], dataRows: [[3]] }]);
    const index = buildWorkbookRefIndex(ast);
    const translated = translateFormulaForEngine("=SUM(Amount)", "MissingSheet", index, ast.diagnostics);
    expect(translated).toBe("=SUM(Amount)");
  });
});
