import type { Modifier } from "../../core/src/index.js";
import { TEXT_TONES } from "./model.js";
import type { CellAddress, ComputedCellValue, EditorCell, EditorCellStyle, EditorRow, EditorSheet, ModifierScope } from "./model.js";
import type { EditorLayoutOptions } from "./options.js";
import { resolveEditorLayoutOptions } from "./options.js";
import { createBlankCell, createBlankRow } from "./workbook.js";
import { isMergeToken } from "./source.js";

const headingPattern = /^#{1,3}\s+/;
const inlineStrikeMarker = "~~";
const inlineBoldPattern = /^\*[^*]+\*$/;
const inlineItalicPattern = /^_[^_]+_$/;
const headingFontSizes = new Map([
  ["## ", "1.25rem"],
  ["# ", "1.1rem"],
  ["### ", "1rem"]
]);

export function getSelectedCell(workbook: { sheets: EditorSheet[] }, address: CellAddress): EditorCell {
  return getCellAt(workbook.sheets[address.sheetIndex], address.rowIndex, address.colIndex);
}

export function getCellAt(sheet: EditorSheet | undefined, rowIndex: number, colIndex: number): EditorCell {
  return sheet?.rows[rowIndex]?.cells[colIndex] ?? createBlankCell();
}

export function getDefaultCellAt(sheet: EditorSheet | undefined, colIndex: number): EditorCell {
  return sheet?.defaults[colIndex] ?? createBlankCell();
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
  const raw = getCellAt(sheet, rowIndex, colIndex).raw;
  if (headingPattern.test(raw)) {
    style.fontWeight = 700;
    const fontSize = getHeadingFontSize(raw);
    if (fontSize) {
      style.fontSize = fontSize;
    }
  }
  if (inlineBoldPattern.test(raw)) {
    style.fontWeight = 700;
  }
  if (inlineItalicPattern.test(raw)) {
    style.fontStyle = "italic";
  }
  if (isWrapped(raw, inlineStrikeMarker)) {
    style.textDecoration = "line-through";
  }
  for (const modifier of getEffectiveModifiers(sheet, rowIndex, colIndex)) {
    if (modifier.key === "bold") {
      style.fontWeight = 700;
    }
    if (modifier.key === "italic") {
      style.fontStyle = "italic";
    }
    if (modifier.key === "strike") {
      style.textDecoration = "line-through";
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

export function getCellToneClass(sheet: EditorSheet | undefined, rowIndex: number, colIndex: number): string {
  const tone = [...getEffectiveModifiers(sheet, rowIndex, colIndex)].reverse().find((modifier) => modifier.key === "tone")?.value;
  return tone && TEXT_TONES.some((candidate) => candidate === tone) ? `celloVisualTone-${tone}` : "";
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

export function getScopedToneValue(sheet: EditorSheet | undefined, address: CellAddress, scope: ModifierScope): string | undefined {
  return getScopeModifiers(sheet, address, scope).find((modifier) => modifier.key === "tone")?.value;
}

export function getCellHeadingPrefix(cell: EditorCell): string | undefined {
  return Array.from(headingFontSizes.keys()).find((prefix) => cell.raw.startsWith(prefix));
}

export function getInheritedModifierGroups(sheet: EditorSheet | undefined, rowIndex: number, colIndex: number): Array<{ scope: "default" | "column" | "row"; modifiers: Modifier[] }> {
  const defaultCell = getDefaultCellAt(sheet, colIndex);
  const groups: Array<{ scope: "default" | "column" | "row"; modifiers: Modifier[] }> = [
    { scope: "default", modifiers: defaultCell.raw || defaultCell.modifiers.length > 0 ? [{ raw: `default:${getCellSourceText(defaultCell)}`, key: "default", value: getCellSourceText(defaultCell) }] : [] },
    { scope: "column", modifiers: getColumnModifiers(sheet, rowIndex, colIndex).filter((modifier) => modifier.key !== "default") },
    { scope: "row", modifiers: sheet?.rows[rowIndex]?.modifiers ?? [] }
  ];
  return groups.filter((group) => group.modifiers.length > 0);
}

export interface VisualCellSpan {
  hidden: boolean;
  colspan: number;
  rowspan: number;
}

export function getVisualCellSpan(sheet: EditorSheet | undefined, rowIndex: number, colIndex: number): VisualCellSpan {
  const origin = findMergeOrigin(sheet, rowIndex, colIndex);
  if (!origin || origin.rowIndex !== rowIndex || origin.colIndex !== colIndex) {
    return { hidden: true, colspan: 1, rowspan: 1 };
  }

  const colspan = getHorizontalSpan(sheet, rowIndex, colIndex);
  const rowspan = getVerticalSpan(sheet, rowIndex, colIndex, colspan);
  return { hidden: false, colspan, rowspan };
}

export function getCellDisplayText(cell: EditorCell, computed?: ComputedCellValue): string {
  if (isMergeToken(cell.raw)) {
    return "";
  }
  if (cell.raw.startsWith("=")) {
    return computed === null || computed === undefined ? cell.raw : String(computed);
  }
  if (isWrapped(cell.raw, inlineStrikeMarker)) {
    return cell.raw.slice(inlineStrikeMarker.length, -inlineStrikeMarker.length);
  }
  if (inlineBoldPattern.test(cell.raw) || inlineItalicPattern.test(cell.raw)) {
    return cell.raw.slice(1, -1);
  }
  if (headingPattern.test(cell.raw)) {
    return cell.raw.replace(headingPattern, "");
  }
  return cell.raw;
}

function getHeadingFontSize(raw: string): string | undefined {
  return Array.from(headingFontSizes.entries()).find(([prefix]) => raw.startsWith(prefix))?.[1];
}

function isWrapped(value: string, marker: string): boolean {
  return value.startsWith(marker) && value.endsWith(marker) && value.length > marker.length * 2;
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

function getCellSourceText(cell: EditorCell): string {
  return `${cell.raw}${cell.modifiers.map((modifier) => `[${modifier.raw}]`).join("")}`;
}

function findMergeOrigin(sheet: EditorSheet | undefined, rowIndex: number, colIndex: number): { rowIndex: number; colIndex: number } | undefined {
  const cell = getCellAt(sheet, rowIndex, colIndex);
  if (cell.raw === "<") {
    for (let left = colIndex - 1; left >= 0; left -= 1) {
      const candidate = findMergeOrigin(sheet, rowIndex, left);
      if (candidate) {
        return candidate;
      }
    }
    return undefined;
  }
  if (cell.raw === "^") {
    return findMergeOrigin(sheet, rowIndex - 1, colIndex);
  }
  return { rowIndex, colIndex };
}

function getHorizontalSpan(sheet: EditorSheet | undefined, rowIndex: number, colIndex: number): number {
  let span = 1;
  for (let nextCol = colIndex + 1; getCellAt(sheet, rowIndex, nextCol).raw === "<"; nextCol += 1) {
    span += 1;
  }
  return span;
}

function getVerticalSpan(sheet: EditorSheet | undefined, rowIndex: number, colIndex: number, colspan: number): number {
  let span = 1;
  for (let nextRow = rowIndex + 1; rowHasVerticalMerge(sheet, nextRow, colIndex, colspan); nextRow += 1) {
    span += 1;
  }
  return span;
}

function rowHasVerticalMerge(sheet: EditorSheet | undefined, rowIndex: number, colIndex: number, colspan: number): boolean {
  for (let offset = 0; offset < colspan; offset += 1) {
    const raw = getCellAt(sheet, rowIndex, colIndex + offset).raw;
    if (raw !== "^" && !(offset > 0 && raw === "<")) {
      return false;
    }
  }
  return true;
}
