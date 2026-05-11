import { describe, expect, it } from "vitest";
import { buildWorkbookRefIndex, translateFormulaForEngine } from "../../../src/evaluator/formula.js";
import { dataRow, sheet, valueCell, workbook } from "../../helpers/ast.js";

function createWorkbook(defs: Array<{ name: string; columns?: string[]; dataRows?: Array<Array<string | number | boolean>> }>) {
  return workbook(
    defs.map(({ name, columns = [], dataRows = [] }) =>
      sheet({
        name,
        columns,
        rows: dataRows.map((values, rowIndex) =>
          dataRow(
            rowIndex + 2,
            values.map((value, colIndex) => valueCell(rowIndex + 2, colIndex + 1, value)),
            { sourceLine: rowIndex + 1 }
          )
        )
      })
    )
  );
}

describe("formula translation", () => {
  it("translates current-sheet named ranges", () => {
    const ast = createWorkbook([{ name: "S", columns: ["Amount"], dataRows: [[5], [7]] }]);
    const index = buildWorkbookRefIndex(ast);
    const translated = translateFormulaForEngine("=SUM(Amount)", "S", index, ast.diagnostics, 4);
    expect(translated).toBe("=SUM(A2:A3)");
  });

  it("translates current-sheet bare named refs to the current row in scalar context", () => {
    const ast = createWorkbook([{ name: "S", columns: ["Revenue", "Units"], dataRows: [[5, 2], [7, 1], [9, 3]] }]);
    const index = buildWorkbookRefIndex(ast);
    const translated = translateFormulaForEngine("=Revenue/Units", "S", index, ast.diagnostics, 4);
    expect(translated).toBe("=A4/B4");
  });

  it("excludes the current row from same-sheet aggregate named refs", () => {
    const ast = createWorkbook([{ name: "S", columns: ["Revenue"], dataRows: [[5], [7], [9], [0]] }]);
    const index = buildWorkbookRefIndex(ast);
    const translated = translateFormulaForEngine("=SUM(Revenue)", "S", index, ast.diagnostics, 5);
    expect(translated).toBe("=SUM(A2:A4)");
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

    expect(translateFormulaForEngine("=SUM(Amount[2:3])", "S", index, ast.diagnostics, 4)).toBe("=SUM(A2:A3)");
    expect(translateFormulaForEngine("=SUM(Amount[*])", "S", index, ast.diagnostics, 4)).toBe("=SUM(A2:A3)");
    expect(translateFormulaForEngine("=IF(TRUE,FALSE,TRUE)", "S", index, ast.diagnostics, 4)).toBe("=IF(TRUE,FALSE,TRUE)");
  });

  it("keeps unresolved tokens when sheetName is not present in the index", () => {
    const ast = createWorkbook([{ name: "Data", columns: ["Amount"], dataRows: [[3]] }]);
    const index = buildWorkbookRefIndex(ast);
    const translated = translateFormulaForEngine("=SUM(Amount)", "MissingSheet", index, ast.diagnostics);
    expect(translated).toBe("=SUM(Amount)");
  });
});
