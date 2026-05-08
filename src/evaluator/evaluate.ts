import type { CellNode, EvaluateOptions, WorkbookAst } from "../shared/types.js";
import { buildWorkbookRefIndex, translateFormulaForEngine } from "./formula.js";
import { deepClone } from "../shared/utils.js";

export async function evaluate(ast: WorkbookAst, options: EvaluateOptions = {}): Promise<WorkbookAst> {
  const output = deepClone(ast);

  let HyperFormula: any;
  try {
    const module = await import("hyperformula");
    HyperFormula = module.HyperFormula;
  } catch {
    output.diagnostics.push({
      level: "warning",
      message: "HyperFormula is not available. Formula cells were not evaluated."
    });
    return output;
  }

  try {
    const sheetsData: Record<string, Array<Array<string | number | boolean | null>>> = {};
    const refIndex = buildWorkbookRefIndex(output);

    for (const sheet of output.sheets) {
      const rowCount = sheet.rows.length;
      const colCount = sheet.columns.length;
      const matrix: Array<Array<string | number | boolean | null>> = Array.from({ length: rowCount }, () =>
        Array.from({ length: colCount }, () => null)
      );

      for (const row of sheet.rows) {
        for (const cell of row.cells) {
          if (cell.kind === "merge-left" || cell.kind === "merge-up") {
            continue;
          }
          matrix[row.index - 1][cell.col - 1] = toHyperFormulaValue(cell, sheet.name, refIndex, output);
        }
      }

      sheetsData[sheet.name] = matrix;
    }

    const hf = HyperFormula.buildFromSheets(sheetsData, { licenseKey: "gpl-v3" });

    for (const sheet of output.sheets) {
      const sheetId = hf.getSheetId(sheet.name);
      if (sheetId === undefined || sheetId === null) {
        continue;
      }

      for (const row of sheet.rows) {
        for (const cell of row.cells) {
          if (cell.kind !== "formula") {
            continue;
          }
          const evaluated = hf.getCellValue({ sheet: sheetId, row: row.index - 1, col: cell.col - 1 });
          cell.computed = normalizeValue(evaluated);
        }
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    output.diagnostics.push({
      level: "error",
      message: `Formula evaluation failed: ${message}`
    });
    if (options.strict) {
      throw err;
    }
  }

  return output;
}

function toHyperFormulaValue(
  cell: CellNode,
  sheetName: string,
  refIndex: ReturnType<typeof buildWorkbookRefIndex>,
  output: WorkbookAst
): string | number | boolean | null {
  if (cell.kind === "formula" && cell.formula) {
    return translateFormulaForEngine(cell.formula, sheetName, refIndex, output.diagnostics);
  }
  return cell.value;
}

function normalizeValue(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "string") {
    return value;
  }
  return String(value);
}

