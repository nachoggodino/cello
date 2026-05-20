import type { Diagnostic, SheetNode, WorkbookAst } from "../shared/types.js";
import { columnLetter } from "../shared/utils.js";

interface SheetRefIndex {
  firstDataRow: number;
  lastDataRow: number;
  columnsByName: Map<string, number>;
}

interface WorkbookRefIndex {
  firstSheetName: string | undefined;
  bySheetName: Map<string, SheetRefIndex>;
}

export function buildWorkbookRefIndex(workbook: WorkbookAst): WorkbookRefIndex {
  const bySheetName = new Map<string, SheetRefIndex>();

  for (const sheet of workbook.sheets) {
    bySheetName.set(sheet.name, buildSheetRefIndex(sheet));
  }

  return {
    firstSheetName: workbook.sheets[0]?.name,
    bySheetName
  };
}

export function translateFormulaForEngine(
  formula: string,
  sheetName: string,
  index: WorkbookRefIndex,
  diagnostics: Diagnostic[],
  currentRow?: number
): string {
  let translated = normalizeFunctionAliases(formula);

  translated = translated.replace(
    /!!([A-Za-z_][A-Za-z0-9_]*(?:\[(?:\d+:\d+|\*)\])?|[A-Za-z]+\d+)/g,
    (_m, token: string) => {
      if (!index.firstSheetName) {
        return `!!${token}`;
      }
      return `${index.firstSheetName}!${token}`;
    }
  );

  translated = translated.replace(
    /([A-Za-z_][A-Za-z0-9_]*)!([A-Za-z_][A-Za-z0-9_]*)(?:\[(?:(\d+):(\d+)|(\*))\])?/g,
    (m, targetSheet: string, token: string, start: string, end: string, fullSpan: string) => {
      if (isA1Ref(token)) {
        return m;
      }
      const target = index.bySheetName.get(targetSheet);
      if (!target) {
        return m;
      }
      const col = target.columnsByName.get(token.toLowerCase());
      if (!col) {
        return m;
      }
      if (fullSpan) {
        return toFullColumnRange(targetSheet, col, target, m, sheetName, diagnostics, token);
      }
      if (start && end) {
        return `${targetSheet}!${columnLetter(col)}${start}:${columnLetter(col)}${end}`;
      }
      return toFullColumnRange(targetSheet, col, target, m, sheetName, diagnostics, token);
    }
  );

  translated = translated.replace(
    /([A-Za-z_][A-Za-z0-9_]*)(?:\[(?:(\d+):(\d+)|(\*))\])?/g,
    (m, token: string, start: string, end: string, fullSpan: string, offset: number, source: string) => {
      const prev = offset > 0 ? (source[offset - 1] ?? "") : "";
      const next = source[offset + m.length] ?? "";
      const prevOk = prev === "" || /[^\w.]/.test(prev);
      const nextOk = next === "" || /[^\w]/.test(next);
      if (!prevOk || !nextOk || prev === "!" || prev === '"' || next === "(" || isA1Ref(token) || isKeyword(token)) {
        return m;
      }

      const currentSheet = index.bySheetName.get(sheetName);
      if (!currentSheet) {
        return m;
      }
      const col = currentSheet.columnsByName.get(token.toLowerCase());
      if (!col) {
        return m;
      }

      if (fullSpan) {
        return toFullColumnRange(undefined, col, currentSheet, m, sheetName, diagnostics, token);
      }
      if (start && end) {
        return `${columnLetter(col)}${start}:${columnLetter(col)}${end}`;
      }

      if (isAggregateReferenceContext(source, offset, token)) {
        if (currentRow && currentRow > currentSheet.firstDataRow) {
          return `${columnLetter(col)}${currentSheet.firstDataRow}:${columnLetter(col)}${currentRow - 1}`;
        }
        return toFullColumnRange(undefined, col, currentSheet, m, sheetName, diagnostics, token);
      }

      if (!currentRow) {
        return m;
      }
      return `${columnLetter(col)}${currentRow}`;
    }
  );

  return translated;
}

function normalizeFunctionAliases(formula: string): string {
  return formula.replace(/\bAVG\s*\(/gi, "AVERAGE(");
}

function toFullColumnRange(
  targetSheet: string | undefined,
  col: number,
  target: SheetRefIndex,
  fallback: string,
  sheetName: string,
  diagnostics: Diagnostic[],
  token: string
): string {
  if (target.firstDataRow === 0 || target.lastDataRow === 0) {
    diagnostics.push({
      level: "warning",
      sheet: sheetName,
      message: `Named reference "${targetSheet ? `${targetSheet}!` : ""}${token}" has no data rows to resolve.`
    });
    return fallback;
  }
  const range = `${columnLetter(col)}${target.firstDataRow}:${columnLetter(col)}${target.lastDataRow}`;
  return targetSheet ? `${targetSheet}!${range}` : range;
}

function isAggregateReferenceContext(source: string, offset: number, token: string): boolean {
  const aggregateFunctions = new Set(["SUM", "AVG", "AVERAGE", "MIN", "MAX", "COUNT", "COUNTA", "PRODUCT"]);
  let depth = 0;

  for (let i = offset - 1; i >= 0; i -= 1) {
    const ch = source[i] ?? "";
    if (ch === ")") {
      depth += 1;
      continue;
    }
    if (ch === "(") {
      if (depth > 0) {
        depth -= 1;
        continue;
      }
      let end = i - 1;
      while (end >= 0 && /\s/.test(source[end] ?? "")) {
        end -= 1;
      }
      let start = end;
      while (start >= 0 && /[A-Za-z_]/.test(source[start] ?? "")) {
        start -= 1;
      }
      const fn = source.slice(start + 1, end + 1).toUpperCase();
      if (!aggregateFunctions.has(fn)) {
        return false;
      }

      const between = source.slice(i + 1, offset).trim();
      const after = source.slice(offset + token.length).trimStart();
      return (between === "" || between === ",") && (after === "" || after.startsWith(")") || after.startsWith(","));
    }
  }

  return false;
}

function buildSheetRefIndex(sheet: SheetNode): SheetRefIndex {
  const dataRows = sheet.rows.filter((row) => row.kind === "data").map((row) => row.index);
  const firstDataRow = dataRows[0] ?? 0;
  const lastDataRow = dataRows[dataRows.length - 1] ?? 0;
  const columnsByName = new Map<string, number>();

  for (const column of sheet.columns) {
    if (column.name && column.name.trim().length > 0) {
      columnsByName.set(column.name.toLowerCase(), column.index);
    }
  }

  return { firstDataRow, lastDataRow, columnsByName };
}

function isKeyword(token: string): boolean {
  const upper = token.toUpperCase();
  return upper === "TRUE" || upper === "FALSE";
}

function isA1Ref(token: string): boolean {
  return /^\$?[A-Za-z]{1,3}\$?\d+$/.test(token);
}
