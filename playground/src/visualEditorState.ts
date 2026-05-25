import { parse } from "@cello/core";
import type { Modifier } from "@cello/core";

export interface EditorCell {
  raw: string;
  modifiers: Modifier[];
}

export interface EditorRow {
  kind: "header" | "data";
  modifiers: Modifier[];
  cells: EditorCell[];
}

export interface EditorSheet {
  name: string;
  rows: EditorRow[];
}

export interface EditorWorkbook {
  sheets: EditorSheet[];
}

export interface CellAddress {
  sheetIndex: number;
  rowIndex: number;
  colIndex: number;
}

export interface HeaderRowResolution {
  headerRowIndex: number;
  rowOffset: number;
  workbook: EditorWorkbook;
}

const minimumVisibleRows = 6;
const minimumVisibleColumns = 5;

export function createEditorWorkbook(source: string): EditorWorkbook {
  const ast = parse(source, {
    readExternalSource: (path) => {
      throw new Error(`External file sources are not available in the visual editor: ${path}`);
    }
  });

  const sheets = ast.sheets
    .map((sheet) => ({
      name: sheet.name,
      rows: sheet.rows.map((row) => ({
        kind: row.kind,
        modifiers: row.modifiers,
        cells: row.cells.map((cell) => ({
          raw: toBaseRaw(cell.raw, cell.kind),
          modifiers: cell.modifiers
        }))
      }))
    }));

  return {
    sheets: sheets.length > 0 ? sheets : [createBlankSheet("Sheet1")]
  };
}

export function serializeEditorWorkbook(workbook: EditorWorkbook): string {
  return workbook.sheets
    .map((sheet) => {
      const normalizedRows = trimTrailingEmptyRows(sheet.rows).map(trimTrailingEmptyCells);
      const lines = [`@sheet ${sanitizeSheetName(sheet.name)}`];

      for (const row of normalizedRows) {
        lines.push(serializeRow(row));
      }

      return lines.join("\n");
    })
    .join("\n\n");
}

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

export function toggleCellModifier(workbook: EditorWorkbook, address: CellAddress, key: "bold" | "italic"): EditorWorkbook {
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

export function toggleRowModifier(workbook: EditorWorkbook, address: CellAddress, key: "bold" | "italic"): EditorWorkbook {
  return updateRow(workbook, address.sheetIndex, address.rowIndex, (row) => ({
    ...row,
    modifiers: toggleModifier(row.modifiers, key)
  }));
}

export function toggleColumnModifier(workbook: EditorWorkbook, sheetIndex: number, headerRowIndex: number, colIndex: number, key: "bold" | "italic"): EditorWorkbook {
  return updateCell(workbook, { sheetIndex, rowIndex: headerRowIndex, colIndex }, (cell) => ({
    ...cell,
    modifiers: toggleModifier(cell.modifiers, key)
  }));
}

export function setCellColorModifier(workbook: EditorWorkbook, address: CellAddress, key: "bg" | "color", value: string): EditorWorkbook {
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

export function setRowColorModifier(workbook: EditorWorkbook, address: CellAddress, key: "bg" | "color", value: string): EditorWorkbook {
  return updateRow(workbook, address.sheetIndex, address.rowIndex, (row) => ({
    ...row,
    modifiers: setModifierValue(row.modifiers, key, value)
  }));
}

export function setColumnColorModifier(workbook: EditorWorkbook, sheetIndex: number, headerRowIndex: number, colIndex: number, key: "bg" | "color", value: string): EditorWorkbook {
  return updateCell(workbook, { sheetIndex, rowIndex: headerRowIndex, colIndex }, (cell) => ({
    ...cell,
    modifiers: setModifierValue(cell.modifiers, key, value)
  }));
}

export function mergeCell(workbook: EditorWorkbook, address: CellAddress, direction: "left" | "up"): EditorWorkbook {
  if ((direction === "left" && address.colIndex === 0) || (direction === "up" && address.rowIndex === 0)) {
    return workbook;
  }
  return updateCellRaw(workbook, address, direction === "left" ? "<" : "^");
}

export function addRow(workbook: EditorWorkbook, sheetIndex: number): EditorWorkbook {
  return updateSheet(workbook, sheetIndex, (sheet) => ({
    ...sheet,
    rows: [...sheet.rows, createBlankRow(getVisibleColumnCount(sheet) - 1)]
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
  let name = `Sheet${index}`;
  while (names.has(name)) {
    index += 1;
    name = `Sheet${index}`;
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

export function getSelectedCell(workbook: EditorWorkbook, address: CellAddress): EditorCell {
  return getCellAt(workbook.sheets[address.sheetIndex], address.rowIndex, address.colIndex);
}

export function getCellAt(sheet: EditorSheet | undefined, rowIndex: number, colIndex: number): EditorCell {
  return sheet?.rows[rowIndex]?.cells[colIndex] ?? createBlankCell();
}

export function getRowAt(sheet: EditorSheet | undefined, rowIndex: number): EditorRow {
  return sheet?.rows[rowIndex] ?? createBlankRow(getVisibleColumnCount(sheet) - 1);
}

export function getColumnName(index: number): string {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

export function getVisibleRowCount(sheet: EditorSheet | undefined): number {
  return Math.max(minimumVisibleRows, (sheet?.rows.length ?? 0) + 1);
}

export function getVisibleColumnCount(sheet: EditorSheet | undefined): number {
  const actual = sheet ? Math.max(0, ...sheet.rows.map((row) => row.cells.length)) : 0;
  return Math.max(minimumVisibleColumns, actual + 1);
}

export function getCellStyle(sheet: EditorSheet | undefined, rowIndex: number, colIndex: number): { background?: string; color?: string; fontStyle?: string; fontWeight?: number } {
  const style: { background?: string; color?: string; fontStyle?: string; fontWeight?: number } = {};
  for (const modifier of getEffectiveModifiers(sheet, rowIndex, colIndex)) {
    if (modifier.key === "bold") {
      style.fontWeight = 700;
    }
    if (modifier.key === "italic") {
      style.fontStyle = "italic";
    }
    if (modifier.key === "bg" && modifier.value) {
      style.background = modifier.value;
    }
    if (modifier.key === "color" && modifier.value) {
      style.color = modifier.value;
    }
  }
  return style;
}

export function hasScopedModifier(sheet: EditorSheet | undefined, address: CellAddress, scope: "cell" | "row" | "column", key: string): boolean {
  return getScopeModifiers(sheet, address, scope).some((modifier) => modifier.key === key);
}

export function getScopedColorValue(
  sheet: EditorSheet | undefined,
  address: CellAddress,
  scope: "cell" | "row" | "column",
  key: "bg" | "color",
  fallback: string
): string {
  return getScopeModifiers(sheet, address, scope).find((modifier) => modifier.key === key)?.value ?? fallback;
}

export function getCellSourceText(cell: EditorCell): string {
  return `${cell.raw}${cell.modifiers.map((modifier) => `[${modifier.raw}]`).join("")}`;
}

export function getCellDisplayText(cell: EditorCell, computed?: string | number | boolean | null): string {
  if (cell.raw === "<" || cell.raw === "^") {
    return "";
  }
  if (cell.raw.startsWith("=")) {
    return computed === null || computed === undefined ? cell.raw : String(computed);
  }
  return cell.raw;
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

  const columnCount = getVisibleColumnCount(sheet) - 1;
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

function getEffectiveModifiers(sheet: EditorSheet | undefined, rowIndex: number, colIndex: number): Modifier[] {
  const columnModifiers = getColumnModifiers(sheet, rowIndex, colIndex);
  const rowModifiers = sheet?.rows[rowIndex]?.modifiers ?? [];
  const cellModifiers = sheet?.rows[rowIndex]?.cells[colIndex]?.modifiers ?? [];

  return mergeModifiers(columnModifiers, rowModifiers, cellModifiers);
}

function getScopeModifiers(sheet: EditorSheet | undefined, address: CellAddress, scope: "cell" | "row" | "column"): Modifier[] {
  if (scope === "cell") {
    return getCellAt(sheet, address.rowIndex, address.colIndex).modifiers;
  }
  if (scope === "row") {
    return sheet?.rows[address.rowIndex]?.modifiers ?? [];
  }
  return getColumnModifiers(sheet, address.rowIndex, address.colIndex);
}

function getColumnModifiers(sheet: EditorSheet | undefined, rowIndex: number, colIndex: number): Modifier[] {
  if (!sheet) {
    return [];
  }

  for (let index = Math.min(rowIndex, sheet.rows.length - 1); index >= 0; index -= 1) {
    const row = sheet.rows[index];
    if (!row || row.kind !== "header") {
      continue;
    }
    return row.cells[colIndex]?.modifiers ?? [];
  }

  return [];
}

function mergeModifiers(...groups: Modifier[][]): Modifier[] {
  const merged = new Map<string, Modifier>();
  for (const group of groups) {
    for (const modifier of group) {
      const token = modifier.key === "bg" || modifier.key === "color" ? modifier.key : modifier.raw;
      merged.set(token, modifier);
    }
  }
  return Array.from(merged.values());
}

function updateCell(workbook: EditorWorkbook, address: CellAddress, update: (cell: EditorCell) => EditorCell): EditorWorkbook {
  return updateSheet(workbook, address.sheetIndex, (sheet) => {
    const ensured = ensureCellAddress(sheet, address.rowIndex, address.colIndex);
    return {
      ...ensured,
      rows: ensured.rows.map((row, rowIndex) => {
        if (rowIndex !== address.rowIndex) {
          return row;
        }
        return {
          ...row,
          cells: row.cells.map((cell, colIndex) => colIndex === address.colIndex ? update(cell) : cell)
        };
      })
    };
  });
}

function updateRow(workbook: EditorWorkbook, sheetIndex: number, rowIndex: number, update: (row: EditorRow) => EditorRow): EditorWorkbook {
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
    sheets: workbook.sheets.map((sheet, index) => index === sheetIndex ? update(sheet) : sheet)
  };
}

function ensureCellAddress(sheet: EditorSheet, rowIndex: number, colIndex: number): EditorSheet {
  const rows = [...sheet.rows];
  const targetColumnCount = Math.max(colIndex + 1, getVisibleColumnCount(sheet) - 1);

  while (rows.length <= rowIndex) {
    rows.push(createBlankRow(targetColumnCount));
  }

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (!row) {
      continue;
    }
    const cells = [...row.cells];
    while (cells.length < targetColumnCount) {
      cells.push(createBlankCell());
    }
    rows[index] = { ...row, cells };
  }

  return { ...sheet, rows };
}

function createBlankSheet(name: string): EditorSheet {
  return {
    name,
    rows: []
  };
}

function createBlankRow(columnCount: number): EditorRow {
  return {
    kind: "data",
    modifiers: [],
    cells: Array.from({ length: Math.max(columnCount, 0) }, () => createBlankCell())
  };
}

function createHeaderRow(columnCount: number): EditorRow {
  return {
    kind: "header",
    modifiers: [],
    cells: Array.from({ length: Math.max(columnCount, 0) }, () => createBlankCell())
  };
}

function createBlankCell(): EditorCell {
  return { raw: "", modifiers: [] };
}

function toggleModifier(modifiers: Modifier[], key: "bold" | "italic"): Modifier[] {
  const hasModifier = modifiers.some((modifier) => modifier.key === key);
  return hasModifier
    ? modifiers.filter((modifier) => modifier.key !== key)
    : [...modifiers, { raw: key, key }];
}

function setModifierValue(modifiers: Modifier[], key: "bg" | "color", value: string): Modifier[] {
  const modifier: Modifier = {
    raw: `${key}:${value}`,
    key,
    value
  };
  return [...modifiers.filter((existing) => existing.key !== key), modifier];
}

function trimTrailingEmptyRows(rows: EditorRow[]): EditorRow[] {
  let end = rows.length;
  while (end > 0 && isEmptyRow(rows[end - 1])) {
    end -= 1;
  }
  return rows.slice(0, end);
}

function trimTrailingEmptyCells(row: EditorRow): EditorRow {
  let end = row.cells.length;
  while (end > 0 && isEmptyCell(row.cells[end - 1])) {
    end -= 1;
  }
  return {
    ...row,
    cells: row.cells.slice(0, end)
  };
}

function isEmptyRow(row: EditorRow | undefined): boolean {
  return Boolean(row) && row?.kind === "data" && row.modifiers.length === 0 && row.cells.every(isEmptyCell);
}

function isEmptyCell(cell: EditorCell | undefined): boolean {
  return Boolean(cell) && cell?.raw.trim() === "" && cell.modifiers.length === 0;
}

function serializeRow(row: EditorRow): string {
  const cells = row.cells.map(serializeCell).join(" | ");
  if (row.kind === "header") {
    return `@header | ${cells} |`;
  }
  const rowPrefix = row.modifiers.length > 0 ? `${row.modifiers.map((modifier) => `[${modifier.raw}]`).join("")} ` : "";
  return `${rowPrefix}| ${cells} |`;
}

function serializeCell(cell: EditorCell): string {
  if (isMergeToken(cell.raw)) {
    return cell.raw;
  }
  return `${sanitizeCellRaw(cell.raw)}${cell.modifiers.map((modifier) => `[${modifier.raw}]`).join("")}`;
}

function sanitizeCellRaw(value: string): string {
  return value.replaceAll("|", " ");
}

function sanitizeSheetName(value: string): string {
  return value.replaceAll("[", "").replaceAll("]", "").trim() || "Sheet";
}

function parseCellSource(source: string): EditorCell {
  const { base, modifiers } = splitTrailingModifiers(source);
  return {
    raw: base,
    modifiers: isMergeToken(base) ? [] : modifiers
  };
}

function splitTrailingModifiers(value: string): { base: string; modifiers: Modifier[] } {
  let rest = value.trimEnd();
  const modifiers: Modifier[] = [];

  while (rest.endsWith("]")) {
    const open = rest.lastIndexOf("[");
    if (open < 0) {
      break;
    }
    const rawContent = rest.slice(open + 1, -1);
    if (rawContent.includes("[") || rawContent.includes("]")) {
      break;
    }
    modifiers.unshift(parseModifier(rawContent));
    rest = rest.slice(0, open).trimEnd();
  }

  return { base: rest, modifiers };
}

function parseModifier(raw: string): Modifier {
  if (raw.startsWith("#bg:")) {
    const [background = "", foreground = ""] = raw
      .slice(4)
      .split(":")
      .map((part) => part.trim());
    return { raw, key: "bgfg", value: `${background}:${foreground}` };
  }

  if (raw.includes(":")) {
    const [key, ...rest] = raw.split(":");
    return { raw, key: (key ?? "").trim().toLowerCase(), value: rest.join(":").trim() };
  }

  return { raw, key: raw.trim().toLowerCase() };
}

function toBaseRaw(raw: string, kind: string): string {
  if (kind === "formula" || kind === "merge-left" || kind === "merge-up") {
    return raw;
  }
  return splitTrailingModifiers(raw).base;
}

function isMergeToken(value: string): boolean {
  return value === "<" || value === "^";
}
