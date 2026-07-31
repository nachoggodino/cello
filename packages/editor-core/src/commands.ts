import type { Modifier } from "../../core/src/index.js";
import type { CellAddress, ColorModifierKey, EditorCell, EditorRow, EditorSheet, EditorWorkbook, HeaderRowResolution, MergeDirection, SheetColumnsMode, SheetRowsMode, TextTone, ToggleModifierKey } from "./model.js";
import { GENERATED_SHEET_NAME_PREFIX } from "./options.js";
import { getVisibleColumnCount } from "./selectors.js";
import { getMergeToken, isMergeToken, parseCellSource } from "./source.js";
import { createBlankCell, createBlankRow, createBlankSheet, createHeaderRow } from "./workbook.js";

export function updateCellRaw(workbook: EditorWorkbook, address: CellAddress, raw: string): EditorWorkbook {
  return updateCell(workbook, address, (cell) => ({
    raw,
    modifiers: isMergeToken(raw) ? [] : cell.modifiers
  }));
}

export function updateCellSource(workbook: EditorWorkbook, address: CellAddress, source: string): EditorWorkbook {
  const parsed = parseCellSource(source);
  return updateCell(workbook, address, () => parsed);
}

export function updateCellContentSource(workbook: EditorWorkbook, address: CellAddress, source: string): EditorWorkbook {
  return updateCell(workbook, address, (cell) => {
    const parsed = parseCellSource(source);
    if (parsed.modifiers.length === 0) {
      return {
        ...cell,
        raw: source,
        modifiers: isMergeToken(source) ? [] : cell.modifiers
      };
    }
    const incomingKeys = new Set(parsed.modifiers.map((modifier) => modifier.key));
    return {
      raw: parsed.raw,
      modifiers: isMergeToken(parsed.raw)
        ? []
        : [...cell.modifiers.filter((modifier) => !incomingKeys.has(modifier.key)), ...parsed.modifiers]
    };
  });
}

export function updateDefaultCellSource(workbook: EditorWorkbook, sheetIndex: number, colIndex: number, source: string): EditorWorkbook {
  const parsed = parseCellSource(source);
  return updateSheet(workbook, sheetIndex, (sheet) => ({
    ...sheet,
    defaults: ensureCellCount(sheet.defaults, colIndex + 1).map((cell, index) => index === colIndex ? parsed : cell)
  }));
}

export function updateRowModifierSource(workbook: EditorWorkbook, address: CellAddress, source: string): EditorWorkbook {
  const modifiers = parseCellSource(`cell${source}`).modifiers;
  return updateRow(workbook, address.sheetIndex, address.rowIndex, (row) => ({ ...row, modifiers }));
}

export function updateColumnModifierSource(workbook: EditorWorkbook, sheetIndex: number, headerRowIndex: number, colIndex: number, source: string): EditorWorkbook {
  const modifiers = parseCellSource(`cell${source}`).modifiers;
  return updateCell(workbook, { sheetIndex, rowIndex: headerRowIndex, colIndex }, (cell) => ({ ...cell, modifiers }));
}

export function toggleCellModifier(workbook: EditorWorkbook, address: CellAddress, key: ToggleModifierKey): EditorWorkbook {
  return updateCell(workbook, address, (cell) => {
    if (isMergeToken(cell.raw)) {
      return cell;
    }
    return {
      ...cell,
      modifiers: toggleModifier(cell.modifiers, key)
    };
  });
}

export function toggleRowModifier(workbook: EditorWorkbook, address: CellAddress, key: ToggleModifierKey): EditorWorkbook {
  return updateRow(workbook, address.sheetIndex, address.rowIndex, (row) => ({
    ...row,
    modifiers: toggleModifier(row.modifiers, key)
  }));
}

export function toggleColumnModifier(workbook: EditorWorkbook, sheetIndex: number, headerRowIndex: number, colIndex: number, key: ToggleModifierKey): EditorWorkbook {
  return updateCell(workbook, { sheetIndex, rowIndex: headerRowIndex, colIndex }, (cell) => ({
    ...cell,
    modifiers: toggleModifier(cell.modifiers, key)
  }));
}

export function setSheetColumnsMode(workbook: EditorWorkbook, sheetIndex: number, mode: SheetColumnsMode | undefined): EditorWorkbook {
  return updateSheet(workbook, sheetIndex, (sheet) => ({
    ...sheet,
    layout: mode === undefined || mode === "normal" ? withoutLayoutKey(sheet.layout, "columns") : { ...(sheet.layout ?? {}), columns: mode }
  }));
}

export function setSheetRowsMode(workbook: EditorWorkbook, sheetIndex: number, mode: SheetRowsMode | undefined): EditorWorkbook {
  return updateSheet(workbook, sheetIndex, (sheet) => ({
    ...sheet,
    layout: mode === undefined || mode === "wrap" ? withoutLayoutKey(sheet.layout, "rows") : { ...(sheet.layout ?? {}), rows: mode }
  }));
}

export function toggleColumnFit(workbook: EditorWorkbook, sheetIndex: number, headerRowIndex: number, colIndex: number): EditorWorkbook {
  return updateCell(workbook, { sheetIndex, rowIndex: headerRowIndex, colIndex }, (cell) => ({
    ...cell,
    modifiers: toggleExclusiveLayoutModifier(cell.modifiers, "fit", ["fit", "width"])
  }));
}

export function setColumnWidth(workbook: EditorWorkbook, sheetIndex: number, headerRowIndex: number, colIndex: number, value: string | undefined): EditorWorkbook {
  return updateCell(workbook, { sheetIndex, rowIndex: headerRowIndex, colIndex }, (cell) => ({
    ...cell,
    modifiers: value ? setModifierValue(cell.modifiers.filter((modifier) => modifier.key !== "fit"), "width", value) : cell.modifiers.filter((modifier) => modifier.key !== "width")
  }));
}

export function toggleRowWrap(workbook: EditorWorkbook, address: CellAddress): EditorWorkbook {
  return updateRow(workbook, address.sheetIndex, address.rowIndex, (row) => {
    const hasWrap = row.modifiers.some((modifier) => modifier.key === "wrap");
    return {
      ...row,
      modifiers: hasWrap
        ? row.modifiers.filter((modifier) => modifier.key !== "wrap")
        : [...row.modifiers.filter((modifier) => modifier.key !== "ellipsis"), { raw: "wrap", key: "wrap" }]
    };
  });
}

export function setRowHeight(workbook: EditorWorkbook, address: CellAddress, value: string | undefined): EditorWorkbook {
  return updateRow(workbook, address.sheetIndex, address.rowIndex, (row) => ({
    ...row,
    modifiers: value ? setModifierValue(row.modifiers, "height", value) : row.modifiers.filter((modifier) => modifier.key !== "height")
  }));
}

export function setCellColorModifier(workbook: EditorWorkbook, address: CellAddress, key: ColorModifierKey, value: string): EditorWorkbook {
  return updateCell(workbook, address, (cell) => {
    if (isMergeToken(cell.raw)) {
      return cell;
    }
    return {
      ...cell,
      modifiers: setModifierValue(cell.modifiers, key, value)
    };
  });
}

export function setCellToneModifier(workbook: EditorWorkbook, address: CellAddress, value: TextTone): EditorWorkbook {
  return updateCell(workbook, address, (cell) => {
    if (isMergeToken(cell.raw)) {
      return cell;
    }
    return {
      ...cell,
      modifiers: setModifierValue(cell.modifiers, "tone", value)
    };
  });
}

export function setRowToneModifier(workbook: EditorWorkbook, address: CellAddress, value: TextTone): EditorWorkbook {
  return updateRow(workbook, address.sheetIndex, address.rowIndex, (row) => ({
    ...row,
    modifiers: setModifierValue(row.modifiers, "tone", value)
  }));
}

export function setRowColorModifier(workbook: EditorWorkbook, address: CellAddress, key: ColorModifierKey, value: string): EditorWorkbook {
  return updateRow(workbook, address.sheetIndex, address.rowIndex, (row) => ({
    ...row,
    modifiers: setModifierValue(row.modifiers, key, value)
  }));
}

export function setColumnColorModifier(workbook: EditorWorkbook, sheetIndex: number, headerRowIndex: number, colIndex: number, key: ColorModifierKey, value: string): EditorWorkbook {
  return updateCell(workbook, { sheetIndex, rowIndex: headerRowIndex, colIndex }, (cell) => ({
    ...cell,
    modifiers: setModifierValue(cell.modifiers, key, value)
  }));
}

export function setColumnToneModifier(workbook: EditorWorkbook, sheetIndex: number, headerRowIndex: number, colIndex: number, value: TextTone): EditorWorkbook {
  return updateCell(workbook, { sheetIndex, rowIndex: headerRowIndex, colIndex }, (cell) => ({
    ...cell,
    modifiers: setModifierValue(cell.modifiers, "tone", value)
  }));
}

export function mergeCell(workbook: EditorWorkbook, address: CellAddress, direction: MergeDirection): EditorWorkbook {
  if ((direction === "left" && address.colIndex === 0) || (direction === "up" && address.rowIndex === 0)) {
    return workbook;
  }
  return updateCellRaw(workbook, address, getMergeToken(direction));
}

export function addRow(workbook: EditorWorkbook, sheetIndex: number, afterRowIndex?: number): EditorWorkbook {
  return updateSheet(workbook, sheetIndex, (sheet) => ({
    ...sheet,
    rows: insertAt(sheet.rows, getInsertIndex(sheet.rows.length, afterRowIndex), createBlankRow(Math.max(1, getVisibleColumnCount(sheet))))
  }));
}

export function addColumn(workbook: EditorWorkbook, sheetIndex: number, afterColIndex?: number): EditorWorkbook {
  return updateSheet(workbook, sheetIndex, (sheet) => {
    const dataColumnCount = getSheetDataColumnCount(sheet);
    return {
      ...sheet,
      defaults: insertAt(ensureCellCount(sheet.defaults, dataColumnCount), getInsertIndex(dataColumnCount, afterColIndex), createBlankCell()),
      rows: sheet.rows.map((row) => ({
        ...row,
        cells: insertAt(row.cells, getInsertIndex(row.cells.length, afterColIndex), createBlankCell())
      }))
    };
  });
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
    ...workbook,
    sheets: [...workbook.sheets, createBlankSheet(name)]
  };
}

export function removeSheet(workbook: EditorWorkbook, sheetIndex: number): EditorWorkbook {
  if (workbook.sheets.length <= 1 || !workbook.sheets[sheetIndex]) {
    return workbook;
  }

  return {
    ...workbook,
    sheets: workbook.sheets.filter((_, index) => index !== sheetIndex)
  };
}

export function renameSheet(workbook: EditorWorkbook, sheetIndex: number, name: string): EditorWorkbook {
  return updateSheet(workbook, sheetIndex, (sheet) => ({
    ...sheet,
    name: name.trim() || sheet.name
  }));
}

export function ensureColumnHeaderRow(workbook: EditorWorkbook, sheetIndex: number): HeaderRowResolution {
  const sheet = workbook.sheets[sheetIndex];
  if (!sheet) {
    return { workbook, headerRowIndex: 0, rowOffset: 0 };
  }

  const headerRowIndex = sheet.rows.findIndex((row) => row.kind === "header");
  if (headerRowIndex >= 0) {
    return { workbook, headerRowIndex, rowOffset: 0 };
  }

  const columnCount = Math.max(1, getVisibleColumnCount(sheet));
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
  update: (cell: EditorCell) => EditorCell
): EditorWorkbook {
  return updateSheet(workbook, address.sheetIndex, (sheet) => {
    const ensured = ensureCellAddress(sheet, address.rowIndex, address.colIndex);
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
  update: (row: EditorRow) => EditorRow
): EditorWorkbook {
  return updateSheet(workbook, sheetIndex, (sheet) => {
    const ensured = ensureCellAddress(sheet, rowIndex, 0);
    return {
      ...ensured,
      rows: ensured.rows.map((row, index) => index === rowIndex ? update(row) : row)
    };
  });
}

function updateSheet(workbook: EditorWorkbook, sheetIndex: number, update: (sheet: EditorSheet) => EditorSheet): EditorWorkbook {
  return {
    ...workbook,
    sheets: workbook.sheets.map((sheet, index) => index === sheetIndex ? update(sheet) : sheet)
  };
}

function ensureCellAddress(sheet: EditorSheet, rowIndex: number, colIndex: number): EditorSheet {
  const rows = [...sheet.rows];
  const targetColumnCount = Math.max(colIndex + 1, getVisibleColumnCount(sheet));

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

function setModifierValue(modifiers: Modifier[], key: ColorModifierKey | "tone" | "width" | "height", value: string): Modifier[] {
  if (key === "tone" && modifiers.some((existing) => existing.key === key && existing.value === value)) {
    return modifiers.filter((existing) => existing.key !== key);
  }
  const modifier: Modifier = {
    raw: `${key}:${value}`,
    key,
    value
  };
  return [...modifiers.filter((existing) => existing.key !== key), modifier];
}

function toggleExclusiveLayoutModifier(modifiers: Modifier[], key: "fit", exclusiveKeys: string[]): Modifier[] {
  const hasModifier = modifiers.some((modifier) => modifier.key === key);
  return hasModifier
    ? modifiers.filter((modifier) => modifier.key !== key)
    : [...modifiers.filter((modifier) => !exclusiveKeys.includes(modifier.key)), { raw: key, key }];
}

function withoutLayoutKey(layout: EditorSheet["layout"], key: "columns" | "rows"): NonNullable<EditorSheet["layout"]> {
  const next = { ...(layout ?? {}) };
  Reflect.deleteProperty(next, key);
  return next;
}

function insertAt<T>(values: T[], index: number, value: T): T[] {
  return [...values.slice(0, index), value, ...values.slice(index)];
}

function getInsertIndex(length: number, afterIndex: number | undefined): number {
  if (afterIndex === undefined) {
    return length;
  }
  return Math.max(0, Math.min(afterIndex + 1, length));
}

function getSheetDataColumnCount(sheet: EditorSheet): number {
  return getVisibleColumnCount(sheet);
}
