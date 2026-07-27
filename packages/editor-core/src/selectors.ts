import type { Modifier } from "../../core/src/index.js";
import type { CellAddress, ComputedCellValue, EditorCell, EditorCellStyle, EditorRow, EditorSheet, ModifierScope } from "./model.js";
import type { EditorLayoutOptions } from "./options.js";
import { resolveEditorLayoutOptions } from "./options.js";
import { createBlankCell, createBlankRow } from "./workbook.js";
import { isMergeToken } from "./source.js";

export function getSelectedCell(workbook: { sheets: EditorSheet[] }, address: CellAddress): EditorCell {
  return getCellAt(workbook.sheets[address.sheetIndex], address.rowIndex, address.colIndex);
}

export function getCellAt(sheet: EditorSheet | undefined, rowIndex: number, colIndex: number): EditorCell {
  return sheet?.rows[rowIndex]?.cells[colIndex] ?? createBlankCell();
}

export function getRowAt(sheet: EditorSheet | undefined, rowIndex: number, options?: EditorLayoutOptions): EditorRow {
  return sheet?.rows[rowIndex] ?? createBlankRow(getVisibleColumnCount(sheet, options) - 1);
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

export function getVisibleRowCount(sheet: EditorSheet | undefined, options?: EditorLayoutOptions): number {
  const { minimumVisibleRows } = resolveEditorLayoutOptions(options);
  return Math.max(minimumVisibleRows, (sheet?.rows.length ?? 0) + 1);
}

export function getVisibleColumnCount(sheet: EditorSheet | undefined, options?: EditorLayoutOptions): number {
  const { minimumVisibleColumns } = resolveEditorLayoutOptions(options);
  const actual = sheet ? Math.max(0, ...sheet.rows.map((row) => row.cells.length)) : 0;
  return Math.max(minimumVisibleColumns, actual + 1);
}

export function getCellStyle(sheet: EditorSheet | undefined, rowIndex: number, colIndex: number): EditorCellStyle {
  const style: EditorCellStyle = {};
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

export function hasScopedModifier(sheet: EditorSheet | undefined, address: CellAddress, scope: ModifierScope, key: string): boolean {
  return getScopeModifiers(sheet, address, scope).some((modifier) => modifier.key === key);
}

export function getScopedColorValue(
  sheet: EditorSheet | undefined,
  address: CellAddress,
  scope: ModifierScope,
  key: "bg" | "color",
  fallback: string
): string {
  return getScopeModifiers(sheet, address, scope).find((modifier) => modifier.key === key)?.value ?? fallback;
}

export function getCellDisplayText(cell: EditorCell, computed?: ComputedCellValue): string {
  if (isMergeToken(cell.raw)) {
    return "";
  }
  if (cell.raw.startsWith("=")) {
    return computed === null || computed === undefined ? cell.raw : String(computed);
  }
  return cell.raw;
}

function getEffectiveModifiers(sheet: EditorSheet | undefined, rowIndex: number, colIndex: number): Modifier[] {
  const columnModifiers = getColumnModifiers(sheet, rowIndex, colIndex);
  const rowModifiers = sheet?.rows[rowIndex]?.modifiers ?? [];
  const cellModifiers = sheet?.rows[rowIndex]?.cells[colIndex]?.modifiers ?? [];

  return mergeModifiers(columnModifiers, rowModifiers, cellModifiers);
}

function getScopeModifiers(sheet: EditorSheet | undefined, address: CellAddress, scope: ModifierScope): Modifier[] {
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
    if (row?.kind === "header") {
      return row.cells[colIndex]?.modifiers ?? [];
    }
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
