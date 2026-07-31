import {
  getColumnName,
  getVisibleColumnCount,
  getVisualCellSpan
} from "@nachoggodino/cello/editor-core";
import type {
  CellAddress,
  CellRange,
  EditorSheet,
  ModifierScope
} from "@nachoggodino/cello/editor-core";

export type SelectionKind = "cells" | "rows" | "columns" | "default";

export interface GridSelection {
  kind: SelectionKind;
  anchor: CellAddress;
  active: CellAddress;
}

export function createCellSelection(address: CellAddress): GridSelection {
  return { kind: "cells", anchor: address, active: address };
}

export function getSelectionRange(selection: GridSelection, rowCount: number, columnCount: number): CellRange {
  const startRow = selection.kind === "columns" ? 0 : Math.min(selection.anchor.rowIndex, selection.active.rowIndex);
  const endRow = selection.kind === "columns"
    ? Math.max(0, rowCount - 1)
    : Math.max(selection.anchor.rowIndex, selection.active.rowIndex);
  const startCol = selection.kind === "rows" ? 0 : Math.min(selection.anchor.colIndex, selection.active.colIndex);
  const endCol = selection.kind === "rows"
    ? Math.max(0, columnCount - 1)
    : Math.max(selection.anchor.colIndex, selection.active.colIndex);
  return {
    sheetIndex: selection.active.sheetIndex,
    startRow,
    endRow,
    startCol,
    endCol
  };
}

export function resolveModifierScope(
  selection: GridSelection,
  range: CellRange,
  sheet: EditorSheet,
  rowCount: number,
  columnCount: number
): ModifierScope {
  if (selection.kind === "rows") {
    return "row";
  }
  if (selection.kind === "columns") {
    return "column";
  }
  if (selection.kind !== "cells") {
    return "cell";
  }

  const hasRangeExtent = selection.anchor.rowIndex !== selection.active.rowIndex ||
    selection.anchor.colIndex !== selection.active.colIndex;
  const coversEveryRow = rowCount > 0 && range.startRow === 0 && range.endRow === rowCount - 1;
  const coversEveryColumn = columnCount > 0 && range.startCol === 0 && range.endCol === columnCount - 1;
  if (hasRangeExtent && coversEveryRow && !coversEveryColumn) {
    return "column";
  }
  if (hasRangeExtent && coversEveryColumn && !coversEveryRow) {
    return "row";
  }

  const selectedRows = sheet.rows.slice(range.startRow, range.endRow + 1);
  return selectedRows.length === 1 && selectedRows[0]?.kind === "header" ? "column" : "cell";
}

export function expandRangeForMergedCells(sheet: EditorSheet, initial: CellRange): CellRange {
  const range = { ...initial };
  let changed = true;
  while (changed) {
    changed = expandIntersectingMerges(sheet, range);
  }
  return range;
}

export function formatSelectionLabel(sheetName: string, selection: GridSelection, range: CellRange): string {
  if (selection.kind === "default") {
    return `${sheetName}!Defaults:${getColumnName(selection.active.colIndex)}`;
  }
  if (selection.kind === "rows") {
    return `${sheetName}!${range.startRow + 1}:${range.endRow + 1}`;
  }
  if (selection.kind === "columns") {
    return `${sheetName}!${getColumnName(range.startCol)}:${getColumnName(range.endCol)}`;
  }
  const start = `${getColumnName(range.startCol)}${range.startRow + 1}`;
  const end = `${getColumnName(range.endCol)}${range.endRow + 1}`;
  return `${sheetName}!${start === end ? start : `${start}:${end}`}`;
}

export function getRangeAddresses(range: CellRange): CellAddress[] {
  const addresses: CellAddress[] = [];
  for (let rowIndex = range.startRow; rowIndex <= range.endRow; rowIndex += 1) {
    for (let colIndex = range.startCol; colIndex <= range.endCol; colIndex += 1) {
      addresses.push({ sheetIndex: range.sheetIndex, rowIndex, colIndex });
    }
  }
  return addresses;
}

export function rangeContainsMergedCells(sheet: EditorSheet, range: CellRange): boolean {
  for (let rowIndex = range.startRow; rowIndex <= range.endRow; rowIndex += 1) {
    for (let colIndex = range.startCol; colIndex <= range.endCol; colIndex += 1) {
      const cell = sheet.rows[rowIndex]?.cells[colIndex];
      if (cell?.raw === "<" || cell?.raw === "^") {
        return true;
      }
    }
  }
  return false;
}

export function getMergeOwnerAddress(sheet: EditorSheet, address: CellAddress): CellAddress {
  const directSpan = getVisualCellSpan(sheet, address.rowIndex, address.colIndex);
  if (!directSpan.hidden) {
    return address;
  }

  for (let rowIndex = 0; rowIndex <= address.rowIndex; rowIndex += 1) {
    for (let colIndex = 0; colIndex <= address.colIndex; colIndex += 1) {
      const span = getVisualCellSpan(sheet, rowIndex, colIndex);
      if (span.hidden) {
        continue;
      }
      if (
        address.rowIndex >= rowIndex &&
        address.rowIndex < rowIndex + span.rowspan &&
        address.colIndex >= colIndex &&
        address.colIndex < colIndex + span.colspan
      ) {
        return { ...address, rowIndex, colIndex };
      }
    }
  }
  return address;
}

export function isPasteCompatibleWithMergedCells(
  sheet: EditorSheet,
  start: CellAddress,
  matrix: string[][]
): boolean {
  const rowCount = matrix.length;
  const columnCount = Math.max(0, ...matrix.map((row) => row.length));
  if (rowCount === 0 || columnCount === 0) {
    return true;
  }
  const target: CellRange = {
    sheetIndex: start.sheetIndex,
    startRow: start.rowIndex,
    endRow: start.rowIndex + rowCount - 1,
    startCol: start.colIndex,
    endCol: start.colIndex + columnCount - 1
  };
  const expanded = expandRangeForMergedCells(sheet, target);
  if (
    expanded.startRow !== target.startRow ||
    expanded.endRow !== target.endRow ||
    expanded.startCol !== target.startCol ||
    expanded.endCol !== target.endCol
  ) {
    return false;
  }

  for (let rowOffset = 0; rowOffset < rowCount; rowOffset += 1) {
    for (let colOffset = 0; colOffset < columnCount; colOffset += 1) {
      const cell = sheet.rows[start.rowIndex + rowOffset]?.cells[start.colIndex + colOffset];
      const expectedMarker = cell?.raw === "<" ? "<" : cell?.raw === "^" ? "^" : undefined;
      const pastedMarker = matrix[rowOffset]?.[colOffset]?.trim();
      const targetIsMergeContinuation = expectedMarker !== undefined;
      const pasteIsMergeContinuation = pastedMarker === "<" || pastedMarker === "^";
      if (targetIsMergeContinuation !== pasteIsMergeContinuation) {
        return false;
      }
      if (expectedMarker !== undefined && pastedMarker !== expectedMarker) {
        return false;
      }
    }
  }
  return true;
}

export function shiftSelectionRows(selection: GridSelection, offset: number): GridSelection {
  return {
    ...selection,
    anchor: { ...selection.anchor, rowIndex: selection.anchor.rowIndex + offset },
    active: { ...selection.active, rowIndex: selection.active.rowIndex + offset }
  };
}

function expandIntersectingMerges(sheet: EditorSheet, range: CellRange): boolean {
  let changed = false;
  for (let rowIndex = 0; rowIndex < sheet.rows.length; rowIndex += 1) {
    for (let colIndex = 0; colIndex < getVisibleColumnCount(sheet); colIndex += 1) {
      const span = getVisualCellSpan(sheet, rowIndex, colIndex);
      if (span.hidden || (span.colspan === 1 && span.rowspan === 1)) {
        continue;
      }
      const spanEndRow = rowIndex + span.rowspan - 1;
      const spanEndCol = colIndex + span.colspan - 1;
      if (!rectanglesIntersect(range, rowIndex, spanEndRow, colIndex, spanEndCol)) {
        continue;
      }
      const next = {
        startRow: Math.min(range.startRow, rowIndex),
        endRow: Math.max(range.endRow, spanEndRow),
        startCol: Math.min(range.startCol, colIndex),
        endCol: Math.max(range.endCol, spanEndCol)
      };
      changed ||= next.startRow !== range.startRow || next.endRow !== range.endRow ||
        next.startCol !== range.startCol || next.endCol !== range.endCol;
      Object.assign(range, next);
    }
  }
  return changed;
}

function rectanglesIntersect(range: CellRange, startRow: number, endRow: number, startCol: number, endCol: number): boolean {
  return startRow <= range.endRow && endRow >= range.startRow &&
    startCol <= range.endCol && endCol >= range.startCol;
}
