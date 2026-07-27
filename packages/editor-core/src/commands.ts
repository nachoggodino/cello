import type { Modifier } from "../../core/src/index.js";
import type { CellAddress, ColorModifierKey, EditorCell, EditorRow, EditorSheet, EditorWorkbook, HeaderRowResolution, MergeDirection, ToggleModifierKey } from "./model.js";
import type { EditorLayoutOptions } from "./options.js";
import { GENERATED_SHEET_NAME_PREFIX } from "./options.js";
import { getVisibleColumnCount } from "./selectors.js";
import { getMergeToken, isMergeToken, parseCellSource } from "./source.js";
import { createBlankCell, createBlankRow, createBlankSheet, createHeaderRow } from "./workbook.js";

export function updateCellRaw(workbook: EditorWorkbook, address: CellAddress, raw: string, options?: EditorLayoutOptions): EditorWorkbook {
  return updateCell(workbook, address, options, (cell) => ({
    raw,
    modifiers: isMergeToken(raw) ? [] : cell.modifiers
  }));
}

export function updateCellSource(workbook: EditorWorkbook, address: CellAddress, source: string, options?: EditorLayoutOptions): EditorWorkbook {
  const parsed = parseCellSource(source);
  return updateCell(workbook, address, options, () => parsed);
}

export function toggleCellModifier(workbook: EditorWorkbook, address: CellAddress, key: ToggleModifierKey, options?: EditorLayoutOptions): EditorWorkbook {
  return updateCell(workbook, address, options, (cell) => {
    if (isMergeToken(cell.raw)) {
      return cell;
    }
    return {
      ...cell,
      modifiers: toggleModifier(cell.modifiers, key)
    };
  });
}

export function toggleRowModifier(workbook: EditorWorkbook, address: CellAddress, key: ToggleModifierKey, options?: EditorLayoutOptions): EditorWorkbook {
  return updateRow(workbook, address.sheetIndex, address.rowIndex, options, (row) => ({
    ...row,
    modifiers: toggleModifier(row.modifiers, key)
  }));
}

export function toggleColumnModifier(workbook: EditorWorkbook, sheetIndex: number, headerRowIndex: number, colIndex: number, key: ToggleModifierKey, options?: EditorLayoutOptions): EditorWorkbook {
  return updateCell(workbook, { sheetIndex, rowIndex: headerRowIndex, colIndex }, options, (cell) => ({
    ...cell,
    modifiers: toggleModifier(cell.modifiers, key)
  }));
}

export function setCellColorModifier(workbook: EditorWorkbook, address: CellAddress, key: ColorModifierKey, value: string, options?: EditorLayoutOptions): EditorWorkbook {
  return updateCell(workbook, address, options, (cell) => {
    if (isMergeToken(cell.raw)) {
      return cell;
    }
    return {
      ...cell,
      modifiers: setModifierValue(cell.modifiers, key, value)
    };
  });
}

export function setRowColorModifier(workbook: EditorWorkbook, address: CellAddress, key: ColorModifierKey, value: string, options?: EditorLayoutOptions): EditorWorkbook {
  return updateRow(workbook, address.sheetIndex, address.rowIndex, options, (row) => ({
    ...row,
    modifiers: setModifierValue(row.modifiers, key, value)
  }));
}

export function setColumnColorModifier(workbook: EditorWorkbook, sheetIndex: number, headerRowIndex: number, colIndex: number, key: ColorModifierKey, value: string, options?: EditorLayoutOptions): EditorWorkbook {
  return updateCell(workbook, { sheetIndex, rowIndex: headerRowIndex, colIndex }, options, (cell) => ({
    ...cell,
    modifiers: setModifierValue(cell.modifiers, key, value)
  }));
}

export function mergeCell(workbook: EditorWorkbook, address: CellAddress, direction: MergeDirection, options?: EditorLayoutOptions): EditorWorkbook {
  if ((direction === "left" && address.colIndex === 0) || (direction === "up" && address.rowIndex === 0)) {
    return workbook;
  }
  return updateCellRaw(workbook, address, getMergeToken(direction), options);
}

export function addRow(workbook: EditorWorkbook, sheetIndex: number, options?: EditorLayoutOptions): EditorWorkbook {
  return updateSheet(workbook, sheetIndex, (sheet) => ({
    ...sheet,
    rows: [...sheet.rows, createBlankRow(getVisibleColumnCount(sheet, options) - 1)]
  }));
}

export function addColumn(workbook: EditorWorkbook, sheetIndex: number): EditorWorkbook {
  return updateSheet(workbook, sheetIndex, (sheet) => ({
    ...sheet,
    rows: sheet.rows.map((row) => ({
      ...row,
      cells: [...row.cells, createBlankCell()]
    }))
  }));
}

export function addSheet(workbook: EditorWorkbook): EditorWorkbook {
  const names = new Set(workbook.sheets.map((sheet) => sheet.name));
  let index = workbook.sheets.length + 1;
  let name = `${GENERATED_SHEET_NAME_PREFIX}${index}`;
  while (names.has(name)) {
    index += 1;
    name = `${GENERATED_SHEET_NAME_PREFIX}${index}`;
  }

  return {
    sheets: [...workbook.sheets, createBlankSheet(name)]
  };
}

export function removeSheet(workbook: EditorWorkbook, sheetIndex: number): EditorWorkbook {
  if (workbook.sheets.length <= 1 || !workbook.sheets[sheetIndex]) {
    return workbook;
  }

  return {
    sheets: workbook.sheets.filter((_, index) => index !== sheetIndex)
  };
}

export function renameSheet(workbook: EditorWorkbook, sheetIndex: number, name: string): EditorWorkbook {
  return updateSheet(workbook, sheetIndex, (sheet) => ({
    ...sheet,
    name: name.trim() || sheet.name
  }));
}

export function ensureColumnHeaderRow(workbook: EditorWorkbook, sheetIndex: number, options?: EditorLayoutOptions): HeaderRowResolution {
  const sheet = workbook.sheets[sheetIndex];
  if (!sheet) {
    return { workbook, headerRowIndex: 0, rowOffset: 0 };
  }

  const headerRowIndex = sheet.rows.findIndex((row) => row.kind === "header");
  if (headerRowIndex >= 0) {
    return { workbook, headerRowIndex, rowOffset: 0 };
  }

  const columnCount = getVisibleColumnCount(sheet, options) - 1;
  const nextWorkbook = updateSheet(workbook, sheetIndex, (currentSheet) => ({
    ...currentSheet,
    rows: [createHeaderRow(columnCount), ...currentSheet.rows]
  }));

  return {
    workbook: nextWorkbook,
    headerRowIndex: 0,
    rowOffset: 1
  };
}

function updateCell(
  workbook: EditorWorkbook,
  address: CellAddress,
  options: EditorLayoutOptions | undefined,
  update: (cell: EditorCell) => EditorCell
): EditorWorkbook {
  return updateSheet(workbook, address.sheetIndex, (sheet) => {
    const ensured = ensureCellAddress(sheet, address.rowIndex, address.colIndex, options);
    return {
      ...ensured,
      rows: ensured.rows.map((row, rowIndex) => rowIndex === address.rowIndex ? updateCellInRow(row, address.colIndex, update) : row)
    };
  });
}

function updateCellInRow(row: EditorRow, colIndex: number, update: (cell: EditorCell) => EditorCell): EditorRow {
  return {
    ...row,
    cells: row.cells.map((cell, index) => index === colIndex ? update(cell) : cell)
  };
}

function updateRow(
  workbook: EditorWorkbook,
  sheetIndex: number,
  rowIndex: number,
  options: EditorLayoutOptions | undefined,
  update: (row: EditorRow) => EditorRow
): EditorWorkbook {
  return updateSheet(workbook, sheetIndex, (sheet) => {
    const ensured = ensureCellAddress(sheet, rowIndex, 0, options);
    return {
      ...ensured,
      rows: ensured.rows.map((row, index) => index === rowIndex ? update(row) : row)
    };
  });
}

function updateSheet(workbook: EditorWorkbook, sheetIndex: number, update: (sheet: EditorSheet) => EditorSheet): EditorWorkbook {
  return {
    sheets: workbook.sheets.map((sheet, index) => index === sheetIndex ? update(sheet) : sheet)
  };
}

function ensureCellAddress(sheet: EditorSheet, rowIndex: number, colIndex: number, options?: EditorLayoutOptions): EditorSheet {
  const rows = [...sheet.rows];
  const targetColumnCount = Math.max(colIndex + 1, getVisibleColumnCount(sheet, options) - 1);

  while (rows.length <= rowIndex) {
    rows.push(createBlankRow(targetColumnCount));
  }

  return {
    ...sheet,
    rows: rows.map((row) => ({
      ...row,
      cells: ensureCellCount(row.cells, targetColumnCount)
    }))
  };
}

function ensureCellCount(cells: EditorCell[], count: number): EditorCell[] {
  return cells.length >= count
    ? cells
    : [...cells, ...Array.from({ length: count - cells.length }, () => createBlankCell())];
}

function toggleModifier(modifiers: Modifier[], key: ToggleModifierKey): Modifier[] {
  const hasModifier = modifiers.some((modifier) => modifier.key === key);
  return hasModifier
    ? modifiers.filter((modifier) => modifier.key !== key)
    : [...modifiers, { raw: key, key }];
}

function setModifierValue(modifiers: Modifier[], key: ColorModifierKey, value: string): Modifier[] {
  const modifier: Modifier = {
    raw: `${key}:${value}`,
    key,
    value
  };
  return [...modifiers.filter((existing) => existing.key !== key), modifier];
}
