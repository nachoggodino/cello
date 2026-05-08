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
  diagnostics: Diagnostic[]
): string {
  let translated = formula;

  translated = translated.replace(/!!([A-Za-z_][A-Za-z0-9_]*(?:\[\d+:\d+\])?|[A-Za-z]+\d+)/g, (_m, token: string) => {
    if (!index.firstSheetName) {
      return `!!${token}`;
    }
    return `${index.firstSheetName}!${token}`;
  });

  translated = translated.replace(
    /([A-Za-z_][A-Za-z0-9_]*)!([A-Za-z_][A-Za-z0-9_]*)(\[(\d+):(\d+)\])?/g,
    (m, targetSheet: string, token: string, _slice: string, start: string, end: string) => {
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
      if (start && end) {
        return `${targetSheet}!${columnLetter(col)}${start}:${columnLetter(col)}${end}`;
      }
      if (target.firstDataRow === 0 || target.lastDataRow === 0) {
        diagnostics.push({
          level: "warning",
          sheet: sheetName,
          message: `Named reference "${targetSheet}!${token}" has no data rows to resolve.`
        });
        return m;
      }
      return `${targetSheet}!${columnLetter(col)}${target.firstDataRow}:${columnLetter(col)}${target.lastDataRow}`;
    }
  );

  translated = translated.replace(
    /([A-Za-z_][A-Za-z0-9_]*)(\[(\d+):(\d+)\])?/g,
    (m, token: string, _slice: string, start: string, end: string, offset: number, source: string) => {
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

      if (start && end) {
        return `${columnLetter(col)}${start}:${columnLetter(col)}${end}`;
      }
      if (currentSheet.firstDataRow === 0 || currentSheet.lastDataRow === 0) {
        diagnostics.push({
          level: "warning",
          sheet: sheetName,
          message: `Named reference "${token}" has no data rows to resolve.`
        });
        return m;
      }
      return `${columnLetter(col)}${currentSheet.firstDataRow}:${columnLetter(col)}${currentSheet.lastDataRow}`;
    }
  );

  return translated;
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

