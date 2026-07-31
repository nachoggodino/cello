import type { CellAddress, EditorWorkbook } from "./model.js";
import { getCellAt } from "./selectors.js";
import { getCellSourceText } from "./source.js";
import { updateCellRaw, updateCellSource } from "./commands.js";

export interface CellRange {
  sheetIndex: number;
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
}

export function normalizeCellRange(anchor: CellAddress, active: CellAddress): CellRange {
  return {
    sheetIndex: active.sheetIndex,
    startRow: Math.min(anchor.rowIndex, active.rowIndex),
    endRow: Math.max(anchor.rowIndex, active.rowIndex),
    startCol: Math.min(anchor.colIndex, active.colIndex),
    endCol: Math.max(anchor.colIndex, active.colIndex)
  };
}

export function isAddressInRange(address: CellAddress, range: CellRange): boolean {
  return (
    address.sheetIndex === range.sheetIndex &&
    address.rowIndex >= range.startRow &&
    address.rowIndex <= range.endRow &&
    address.colIndex >= range.startCol &&
    address.colIndex <= range.endCol
  );
}

export function getCellRangeSize(range: CellRange): { rows: number; columns: number; cells: number } {
  const rows = range.endRow - range.startRow + 1;
  const columns = range.endCol - range.startCol + 1;
  return { rows, columns, cells: rows * columns };
}

export function copyRangeAsTsv(workbook: EditorWorkbook, range: CellRange): string {
  const sheet = workbook.sheets[range.sheetIndex];
  const lines: string[] = [];
  for (let rowIndex = range.startRow; rowIndex <= range.endRow; rowIndex += 1) {
    const values: string[] = [];
    for (let colIndex = range.startCol; colIndex <= range.endCol; colIndex += 1) {
      values.push(escapeTsvValue(getCellSourceText(getCellAt(sheet, rowIndex, colIndex))));
    }
    lines.push(values.join("\t"));
  }
  return lines.join("\n");
}

export function parseClipboardMatrix(text: string): string[][] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n$/, "");
  if (normalized.includes("\t")) {
    return normalized.split("\n").map((line) => line.split("\t"));
  }
  return parseCsvMatrix(normalized);
}

export function pasteMatrixAt(workbook: EditorWorkbook, start: CellAddress, matrix: string[][]): EditorWorkbook {
  let next = workbook;
  for (const [rowOffset, row] of matrix.entries()) {
    for (const [colOffset, value] of row.entries()) {
      next = updateCellSource(
        next,
        {
          sheetIndex: start.sheetIndex,
          rowIndex: start.rowIndex + rowOffset,
          colIndex: start.colIndex + colOffset
        },
        value
      );
    }
  }
  return next;
}

export function clearRange(workbook: EditorWorkbook, range: CellRange): EditorWorkbook {
  let next = workbook;
  for (let rowIndex = range.startRow; rowIndex <= range.endRow; rowIndex += 1) {
    for (let colIndex = range.startCol; colIndex <= range.endCol; colIndex += 1) {
      next = updateCellRaw(next, { sheetIndex: range.sheetIndex, rowIndex, colIndex }, "");
    }
  }
  return next;
}

export function clearRangeAll(workbook: EditorWorkbook, range: CellRange): EditorWorkbook {
  let next = workbook;
  for (let rowIndex = range.startRow; rowIndex <= range.endRow; rowIndex += 1) {
    for (let colIndex = range.startCol; colIndex <= range.endCol; colIndex += 1) {
      next = updateCellSource(next, { sheetIndex: range.sheetIndex, rowIndex, colIndex }, "");
    }
  }
  return next;
}

export function fillRange(workbook: EditorWorkbook, range: CellRange, source: string): EditorWorkbook {
  let next = workbook;
  for (let rowIndex = range.startRow; rowIndex <= range.endRow; rowIndex += 1) {
    for (let colIndex = range.startCol; colIndex <= range.endCol; colIndex += 1) {
      next = updateCellSource(next, { sheetIndex: range.sheetIndex, rowIndex, colIndex }, source);
    }
  }
  return next;
}

function escapeTsvValue(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\t/g, " ");
}

function parseCsvMatrix(text: string): string[][] {
  const rows: string[][] = [[]];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index] ?? "";
    const next = text[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      currentRow(rows).push(value);
      value = "";
    } else if (char === "\n") {
      currentRow(rows).push(value);
      rows.push([]);
      value = "";
    } else {
      value += char;
    }
  }
  currentRow(rows).push(value);
  return rows;
}

function currentRow(rows: string[][]): string[] {
  return rows[rows.length - 1] ?? [];
}
