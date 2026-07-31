import type { CellNode, DiagnosticCategory, DiagnosticCode, DiagnosticLevel, EvaluateOptions, WorkbookAst } from "../shared/types.js";
import { buildWorkbookRefIndex, translateFormulaForEngine } from "./formula.js";
import { deepClone, workbookHasFormulas } from "../shared/utils.js";
import { resolveWorkbookIdentity } from "../shared/identity.js";

interface HyperFormulaEngine {
  getSheetId(sheetName: string): number | null | undefined;
  getCellValue(address: { sheet: number; row: number; col: number }): unknown;
}

interface HyperFormulaCtor {
  buildFromSheets(sheetsData: Record<string, Array<Array<string | number | boolean | null>>>, config: { licenseKey: string }): HyperFormulaEngine;
}

function pushEvaluationDiagnostic(workbook: WorkbookAst, severity: DiagnosticLevel, code: DiagnosticCode, category: DiagnosticCategory, message: string): void {
  workbook.diagnostics.push({ level: severity, severity, code, stage: "evaluate", category, message });
}

let hyperFormulaCtor: HyperFormulaCtor | null = null;

/** Evaluates formula cells in a cloned workbook and returns structured diagnostics. */
export async function evaluate(ast: WorkbookAst, options: EvaluateOptions = {}): Promise<WorkbookAst> {
  const output = deepClone(ast);

  const identity = resolveWorkbookIdentity(output);
  if (identity.ambiguous) {
    if (!output.diagnostics.some((diagnostic) => diagnostic.code === "duplicate-sheet-identity" || diagnostic.code === "duplicate-alias-identity")) {
      output.diagnostics.push(...identity.diagnostics);
    }
    pushEvaluationDiagnostic(output, "error", "ambiguous-workbook-identity", "identity", "Formula evaluation was skipped because workbook identities are ambiguous.");
    if (options.strict) {
      throw new Error("Formula evaluation failed: workbook identities are ambiguous.");
    }
    return output;
  }

  if (!workbookHasFormulas(output)) {
    return output;
  }

  if (!(await loadHyperFormula(output))) {
    return output;
  }
  const ctor = hyperFormulaCtor;
  if (!ctor) {
    pushEvaluationDiagnostic(output, "error", "formula-engine-initialization-error", "runtime", "HyperFormula failed to initialize.");
    return output;
  }

  try {
    const refIndex = buildWorkbookRefIndex(output);
    const sheetsData = buildSheetsData(output, refIndex);
    const hf = ctor.buildFromSheets(sheetsData, { licenseKey: "gpl-v3" });
    applyComputedValues(output, hf);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    pushEvaluationDiagnostic(output, "error", "formula-evaluation-error", "runtime", `Formula evaluation failed: ${message}`);
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
    pushEvaluationDiagnostic(output, "warning", "formula-engine-unavailable", "runtime", "HyperFormula is not available. Formula cells were not evaluated.");
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

function buildSheetsData(workbook: WorkbookAst, refIndex: ReturnType<typeof buildWorkbookRefIndex>): Record<string, Array<Array<string | number | boolean | null>>> {
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
        recordFormulaError(workbook, sheet.name, row.sourceLine, cell, evaluated);
        cell.computed = normalizeValue(evaluated, cell.formula);
      }
    }
  }
}

function toHyperFormulaValue(cell: CellNode, sheetName: string, refIndex: ReturnType<typeof buildWorkbookRefIndex>, output: WorkbookAst): string | number | boolean | null {
  if (cell.kind === "formula" && cell.formula) {
    return translateFormulaForEngine(cell.formula, sheetName, refIndex, output.diagnostics, cell.row, buildHeaderIndex(cell.formulaHeaders));
  }
  return cell.value;
}

function buildHeaderIndex(headers: string[] | undefined): ReadonlyMap<string, number> | undefined {
  if (!headers) {
    return undefined;
  }
  const index = new Map<string, number>();
  for (const [column, header] of headers.entries()) {
    if (header.trim().length > 0) {
      index.set(header.toLowerCase(), column + 1);
    }
  }
  return index;
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
  return stringifyUnknownValue(value);
}

function recordFormulaError(workbook: WorkbookAst, sheet: string, line: number, cell: CellNode, value: unknown): void {
  if (!isDetailedCellError(value)) {
    return;
  }
  const syntaxError = isFormulaParseError(value);
  const referenceError = value.type === "NAME" || value.type === "REF" || value.value === "#NAME?" || value.value === "#REF!";
  const code = syntaxError ? "formula-syntax-error" : referenceError ? "formula-reference-error" : "formula-runtime-error";
  const category = syntaxError ? "syntax" : referenceError ? "reference" : "runtime";
  workbook.diagnostics.push({
    level: "error",
    severity: "error",
    code,
    stage: "evaluate",
    category,
    sheet,
    primary: { line, sheet },
    context: { row: cell.row, column: cell.col },
    line,
    message: `Formula ${category} error at row ${cell.row}, column ${cell.col}: ${value.value}`
  });
}

function isDetailedCellError(value: unknown): value is { value: string; type?: string; message?: string } {
  return typeof value === "object" && value !== null && "value" in value && typeof (value as { value?: unknown }).value === "string";
}

function isFormulaParseError(value: { type?: string; message?: string }): boolean {
  return value.type === "ERROR" && typeof value.message === "string" && value.message.includes("Parsing error");
}

function stringifyUnknownValue(value: unknown): string {
  return Object.prototype.toString.call(value);
}
