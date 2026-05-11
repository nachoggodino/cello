import type { CellNode, EvaluateOptions, WorkbookAst } from "../shared/types.js";
import { buildWorkbookRefIndex, translateFormulaForEngine } from "./formula.js";
import { deepClone } from "../shared/utils.js";

interface HyperFormulaEngine {
  getSheetId(sheetName: string): number | null | undefined;
  getCellValue(address: { sheet: number; row: number; col: number }): unknown;
}

interface HyperFormulaCtor {
  buildFromSheets(
    sheetsData: Record<string, Array<Array<string | number | boolean | null>>>,
    config: { licenseKey: string }
  ): HyperFormulaEngine;
}

let hyperFormulaCtor: HyperFormulaCtor | null = null;

export async function evaluate(ast: WorkbookAst, options: EvaluateOptions = {}): Promise<WorkbookAst> {
  const output = deepClone(ast);

  if (!(await loadHyperFormula(output))) {
    return output;
  }
  const ctor = hyperFormulaCtor;
  if (!ctor) {
    output.diagnostics.push({
      level: "error",
      message: "HyperFormula failed to initialize."
    });
    return output;
  }

  try {
    const refIndex = buildWorkbookRefIndex(output);
    const sheetsData = buildSheetsData(output, refIndex);
    const hf = ctor.buildFromSheets(sheetsData, { licenseKey: "gpl-v3" });
    applyComputedValues(output, hf);
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

async function loadHyperFormula(output: WorkbookAst): Promise<boolean> {
  try {
    if (!hyperFormulaCtor) {
      const module = await import("hyperformula");
      const maybeCtor = (module as { HyperFormula?: unknown }).HyperFormula;
      if (!isHyperFormulaCtor(maybeCtor)) {
        throw new Error("Invalid HyperFormula module export.");
      }
      hyperFormulaCtor = maybeCtor;
    }
    return true;
  } catch {
    output.diagnostics.push({
      level: "warning",
      message: "HyperFormula is not available. Formula cells were not evaluated."
    });
    return false;
  }
}

function isHyperFormulaCtor(value: unknown): value is HyperFormulaCtor {
  return (
    (typeof value === "object" || typeof value === "function") &&
    value !== null &&
    "buildFromSheets" in value &&
    typeof (value as { buildFromSheets?: unknown }).buildFromSheets === "function"
  );
}

function buildSheetsData(
  workbook: WorkbookAst,
  refIndex: ReturnType<typeof buildWorkbookRefIndex>
): Record<string, Array<Array<string | number | boolean | null>>> {
  return Object.fromEntries(workbook.sheets.map((sheet) => [sheet.name, buildSheetMatrix(sheet, workbook, refIndex)]));
}

function buildSheetMatrix(
  sheet: WorkbookAst["sheets"][number],
  workbook: WorkbookAst,
  refIndex: ReturnType<typeof buildWorkbookRefIndex>
): Array<Array<string | number | boolean | null>> {
  const matrix = createEmptyMatrix(sheet.rows.length, sheet.columns.length);

  for (const row of sheet.rows) {
    const matrixRow = matrix[row.index - 1];
    if (!matrixRow) {
      continue;
    }
    for (const cell of row.cells) {
      if (cell.kind === "merge-left" || cell.kind === "merge-up") {
        continue;
      }
      matrixRow[cell.col - 1] = toHyperFormulaValue(cell, sheet.name, refIndex, workbook);
    }
  }

  return matrix;
}

function createEmptyMatrix(rowCount: number, colCount: number): Array<Array<string | number | boolean | null>> {
  return Array.from({ length: rowCount }, () => Array.from({ length: colCount }, () => null));
}

function applyComputedValues(workbook: WorkbookAst, hf: HyperFormulaEngine): void {
  for (const sheet of workbook.sheets) {
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
        cell.computed = normalizeValue(evaluated, cell.formula);
      }
    }
  }
}

function toHyperFormulaValue(
  cell: CellNode,
  sheetName: string,
  refIndex: ReturnType<typeof buildWorkbookRefIndex>,
  output: WorkbookAst
): string | number | boolean | null {
  if (cell.kind === "formula" && cell.formula) {
    return translateFormulaForEngine(cell.formula, sheetName, refIndex, output.diagnostics, cell.row);
  }
  return cell.value;
}

function normalizeValue(value: unknown, formula?: string): string | number | boolean | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "string") {
    return value;
  }
  if (isDetailedCellError(value)) {
    if (isFormulaParseError(value) && formula) {
      return formula;
    }
    return value.value;
  }
  return String(value);
}

function isDetailedCellError(value: unknown): value is { value: string; type?: string; message?: string } {
  return typeof value === "object" && value !== null && "value" in value && typeof (value as { value?: unknown }).value === "string";
}

function isFormulaParseError(value: { type?: string; message?: string }): boolean {
  return value.type === "ERROR" && typeof value.message === "string" && value.message.includes("Parsing error");
}

