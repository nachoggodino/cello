import type { Diagnostic, SheetNode, WorkbookAst } from "../shared/types.js";
import { columnLetter } from "../shared/utils.js";

interface SheetRefIndex {
  firstDataRow: number;
  lastDataRow: number;
  columnsByName: ReadonlyMap<string, number>;
}

interface WorkbookRefIndex {
  firstSheetName: string | undefined;
  bySheetName: Map<string, SheetRefIndex>;
}

interface LocalReferenceContext {
  sheetName: string;
  index: WorkbookRefIndex;
  diagnostics: Diagnostic[];
  currentRow?: number;
  currentColumnsByName?: ReadonlyMap<string, number>;
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
  currentRow?: number,
  currentColumnsByName?: ReadonlyMap<string, number>
): string {
  const normalized = normalizeFunctionAliases(formula);
  const workbookQualified = translateWorkbookShortcut(normalized, index);
  const sheetQualified = translateQualifiedReferences(workbookQualified, sheetName, index, diagnostics);
  return translateLocalReferences(sheetQualified, {
    sheetName,
    index,
    diagnostics,
    ...(currentRow === undefined ? {} : { currentRow }),
    ...(currentColumnsByName === undefined ? {} : { currentColumnsByName })
  });
}

function translateWorkbookShortcut(formula: string, index: WorkbookRefIndex): string {
  return formula.replace(/!!([A-Za-z_][A-Za-z0-9_]*(?:\[(?:\d+|\d+:\d+|\*)\])?|[A-Za-z]+\d+)/g, (_match, token: string) =>
    index.firstSheetName ? `${index.firstSheetName}!${token}` : `!!${token}`
  );
}

function translateQualifiedReferences(formula: string, sheetName: string, index: WorkbookRefIndex, diagnostics: Diagnostic[]): string {
  return formula.replace(
    /([A-Za-z_][A-Za-z0-9_]*)!([A-Za-z_][A-Za-z0-9_]*)(?:\[(?:(\d+)(?::(\d+))?|(\*))\])?/g,
    (match, targetSheet: string, token: string, start: string, end: string | undefined, fullSpan: string | undefined) => {
      const target = index.bySheetName.get(targetSheet);
      const column = target?.columnsByName.get(token.toLowerCase());
      if (isA1Ref(token) || !target || !column) return match;
      if (fullSpan) return toFullColumnRange(targetSheet, column, target, match, sheetName, diagnostics, token);
      if (start && end) return `${targetSheet}!${columnLetter(column)}${start}:${columnLetter(column)}${end}`;
      if (start) return `${targetSheet}!${columnLetter(column)}${start}`;
      return toFullColumnRange(targetSheet, column, target, match, sheetName, diagnostics, token);
    }
  );
}

function translateLocalReferences(formula: string, context: LocalReferenceContext): string {
  return formula.replace(
    /([A-Za-z_][A-Za-z0-9_]*)(?:\[(?:(\d+)(?::(\d+))?|(\*))\])?/g,
    (match, token: string, start: string, end: string | undefined, fullSpan: string | undefined, offset: number, source: string) =>
      translateLocalReference(match, token, start, end, fullSpan, offset, source, context)
  );
}

function translateLocalReference(
  match: string,
  token: string,
  start: string,
  end: string | undefined,
  fullSpan: string | undefined,
  offset: number,
  source: string,
  context: LocalReferenceContext
): string {
  if (!isLocalReferenceToken(match, token, offset, source)) return match;
  const indexedSheet = context.index.bySheetName.get(context.sheetName);
  if (!indexedSheet) return match;
  const currentSheet = context.currentColumnsByName ? { ...indexedSheet, columnsByName: context.currentColumnsByName } : indexedSheet;
  const column = currentSheet.columnsByName.get(token.toLowerCase());
  if (!column) return match;
  if (fullSpan) return toLocalFullRange(column, currentSheet, match, token, context);
  if (start && end) return `${columnLetter(column)}${start}:${columnLetter(column)}${end}`;
  if (start) return `${columnLetter(column)}${start}`;
  if (isAggregateReferenceContext(source, offset, token)) return translateAggregateReference(column, currentSheet, match, token, context);
  return context.currentRow ? `${columnLetter(column)}${context.currentRow}` : match;
}

function isLocalReferenceToken(match: string, token: string, offset: number, source: string): boolean {
  const previous = offset > 0 ? (source[offset - 1] ?? "") : "";
  const next = source[offset + match.length] ?? "";
  const hasBoundaries = (previous === "" || /[^\w.]/.test(previous)) && (next === "" || /[^\w]/.test(next));
  return hasBoundaries && previous !== "!" && previous !== '"' && next !== "(" && !isA1Ref(token) && !isKeyword(token);
}

function translateAggregateReference(column: number, sheet: SheetRefIndex, match: string, token: string, context: LocalReferenceContext): string {
  if (context.currentRow && context.currentRow > sheet.firstDataRow) {
    return `${columnLetter(column)}${sheet.firstDataRow}:${columnLetter(column)}${context.currentRow - 1}`;
  }
  return toLocalFullRange(column, sheet, match, token, context);
}

function toLocalFullRange(column: number, sheet: SheetRefIndex, match: string, token: string, context: LocalReferenceContext): string {
  return toFullColumnRange(undefined, column, sheet, match, context.sheetName, context.diagnostics, token);
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
      severity: "warning",
      code: "formula-empty-reference",
      stage: "evaluate",
      category: "reference",
      sheet: sheetName,
      context: { reference: token },
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
