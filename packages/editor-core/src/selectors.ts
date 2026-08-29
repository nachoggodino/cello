import {
  CELLO_HEADING_STYLES,
  DEFAULT_COLUMN_WIDTH,
  cleanInlineDisplayText,
  expandAliasModifiers,
  fitCandidateValue,
  formatDisplayValue,
  getInlineTextStyle,
  getModifierStyle,
  getToneClasses,
  heightContentToCss,
  heightOuterToCss,
  isFitCandidateCell,
  resolveColumnWidth,
  resolveRowLayout,
  widthOuterToCss,
  type Modifier,
  type ResolvedRowLayout,
  type ResolvedWidth,
  type SheetNode
} from "../../core/src/index.js";
import type { CellAddress, ComputedCellValue, EditorCell, EditorCellStyle, EditorRow, EditorSheet, EditorWorkbook, ModifierScope } from "./model.js";
import type { CellKind } from "../../core/src/index.js";
import { createBlankCell, createBlankRow } from "./workbook.js";
import { isMergeToken } from "./source.js";

export function getSelectedCell(workbook: { sheets: EditorSheet[] }, address: CellAddress): EditorCell {
  return getCellAt(workbook.sheets[address.sheetIndex], address.rowIndex, address.colIndex);
}

export function getCellAt(sheet: EditorSheet | undefined, rowIndex: number, colIndex: number): EditorCell {
  return sheet?.rows[rowIndex]?.cells[colIndex] ?? createBlankCell();
}

export function getDefaultCellAt(sheet: EditorSheet | undefined, colIndex: number): EditorCell {
  return sheet?.defaults[colIndex] ?? createBlankCell();
}

export function getRowAt(sheet: EditorSheet | undefined, rowIndex: number): EditorRow {
  return sheet?.rows[rowIndex] ?? createBlankRow(getVisibleColumnCount(sheet));
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
  return sheet?.rows.length ?? 0;
}

export function getVisibleColumnCount(sheet: EditorSheet | undefined): number {
  const actual = sheet ? Math.max(sheet.defaults.length, ...sheet.rows.map((row) => row.cells.length)) : 0;
  return actual;
}

export function getCellStyle(sheet: EditorSheet | undefined, rowIndex: number, colIndex: number, workbook?: Pick<EditorWorkbook, "aliases">): EditorCellStyle {
  const raw = getCellAt(sheet, rowIndex, colIndex).raw;
  return {
    ...getInlineTextStyle(raw),
    ...getModifierStyle(getEffectiveModifiers(sheet, rowIndex, colIndex, workbook))
  };
}

export function getVisualCellStyle(
  workbook: Pick<EditorWorkbook, "aliases"> | undefined,
  sheet: EditorSheet | undefined,
  rowIndex: number,
  colIndex: number
): EditorCellStyle {
  return {
    ...getCellStyle(sheet, rowIndex, colIndex, workbook),
    ...getVisualColumnStyle(workbook, sheet, rowIndex, colIndex),
    ...getVisualRowStyle(workbook, sheet, rowIndex)
  };
}

export function getCellToneClass(sheet: EditorSheet | undefined, rowIndex: number, colIndex: number, workbook?: Pick<EditorWorkbook, "aliases">): string {
  return getToneClasses(getEffectiveModifiers(sheet, rowIndex, colIndex, workbook), "celloVisualTone").join(" ");
}

export function getVisualColumnStyle(
  workbook: Pick<EditorWorkbook, "aliases"> | undefined,
  sheet: EditorSheet | undefined,
  rowIndex: number,
  colIndex: number
): EditorCellStyle {
  const width = getVisualColumnWidth(workbook, sheet, rowIndex, colIndex);
  const cssWidth = columnWidthToCss(width);
  return {
    width: cssWidth,
    minWidth: cssWidth,
    maxWidth: cssWidth
  };
}

export function getVisualColumnWidth(
  workbook: Pick<EditorWorkbook, "aliases"> | undefined,
  sheet: EditorSheet | undefined,
  rowIndex: number,
  colIndex: number
): ResolvedWidth {
  return getResolvedVisualColumnWidth(workbook, sheet, rowIndex, colIndex);
}

export function getVisualRowStyle(workbook: Pick<EditorWorkbook, "aliases"> | undefined, sheet: EditorSheet | undefined, rowIndex: number): EditorCellStyle {
  const rowLayout = getResolvedVisualRowLayout(workbook, sheet, rowIndex);
  const contentHeight = heightContentToCss(rowLayout.height);
  const outerHeight = heightOuterToCss(rowLayout.height);
  if (!contentHeight || !outerHeight) {
    return {};
  }
  return {
    height: outerHeight,
    minHeight: outerHeight,
    maxHeight: outerHeight,
    overflow: "auto",
    ...(rowLayout.mode === "ellipsis" && rowLayout.height.kind === "lines" && rowLayout.height.value !== undefined
      ? { WebkitBoxOrient: "vertical" as const, WebkitLineClamp: rowLayout.height.value }
      : {})
  };
}

export function getVisualCellContentStyle(workbook: Pick<EditorWorkbook, "aliases"> | undefined, sheet: EditorSheet | undefined, rowIndex: number): EditorCellStyle {
  const rowLayout = getResolvedVisualRowLayout(workbook, sheet, rowIndex);
  if (rowLayout.mode === "wrap") {
    const wrapStyle: EditorCellStyle = {
      whiteSpace: "normal",
      overflowWrap: "anywhere"
    };
    return rowLayout.height.kind === "auto" ? wrapStyle : { ...wrapStyle, overflow: "auto" };
  }
  const ellipsisStyle: EditorCellStyle = {
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis"
  };
  const contentHeight = heightContentToCss(rowLayout.height);
  return contentHeight ? { ...ellipsisStyle, maxHeight: contentHeight } : ellipsisStyle;
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

export function getColumnWidthValue(sheet: EditorSheet | undefined, rowIndex: number, colIndex: number): string {
  return getColumnModifiers(sheet, rowIndex, colIndex).find((modifier) => modifier.key === "width")?.value ?? "";
}

export function isColumnFit(sheet: EditorSheet | undefined, rowIndex: number, colIndex: number): boolean {
  return getColumnModifiers(sheet, rowIndex, colIndex).some((modifier) => modifier.key === "fit");
}

export function isRowWrap(sheet: EditorSheet | undefined, rowIndex: number): boolean {
  return Boolean(sheet?.rows[rowIndex]?.modifiers.some((modifier) => modifier.key === "wrap"));
}

export function getRowHeightValue(sheet: EditorSheet | undefined, rowIndex: number): string {
  return sheet?.rows[rowIndex]?.modifiers.find((modifier) => modifier.key === "height")?.value ?? "";
}

export function getCellHeadingPrefix(cell: EditorCell): string | undefined {
  return CELLO_HEADING_STYLES.find((heading) => cell.raw.startsWith(heading.prefix))?.prefix;
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
  return cleanInlineDisplayText(cell.raw, cell.raw);
}

export function getCellFormattedDisplayText(
  sheet: EditorSheet | undefined,
  rowIndex: number,
  colIndex: number,
  computed?: ComputedCellValue,
  workbook?: Pick<EditorWorkbook, "aliases">
): string {
  const cell = getCellAt(sheet, rowIndex, colIndex);
  if (isMergeToken(cell.raw)) {
    return "";
  }
  const displayValue = getRawDisplayValue(cell, computed);
  const formatted = formatDisplayValue(displayValue, getEffectiveModifiers(sheet, rowIndex, colIndex, workbook));
  return cleanInlineDisplayText(cell.raw, formatted);
}

export function getCellFitMeasureText(
  sheet: EditorSheet | undefined,
  rowIndex: number,
  colIndex: number,
  computed?: ComputedCellValue,
  workbook?: Pick<EditorWorkbook, "aliases">
): string | undefined {
  const cell = getCellAt(sheet, rowIndex, colIndex);
  const span = getVisualCellSpan(sheet, rowIndex, colIndex);
  const kind: CellKind = cell.raw.startsWith("=") ? "formula" : "value";
  if (span.hidden || !isFitCandidateCell({ kind, colspan: span.colspan, rowspan: span.rowspan })) {
    return undefined;
  }
  const candidate = {
    raw: cell.raw,
    kind,
    modifiers: cell.modifiers,
    value: cell.raw,
    ...(computed === undefined ? {} : { computed })
  };
  return fitCandidateValue(
    candidate,
    getEffectiveModifiers(sheet, rowIndex, colIndex, workbook)
  );
}

function getEffectiveModifiers(sheet: EditorSheet | undefined, rowIndex: number, colIndex: number, workbook?: Pick<EditorWorkbook, "aliases">): Modifier[] {
  const columnModifiers = getColumnModifiers(sheet, rowIndex, colIndex);
  const rowModifiers = sheet?.rows[rowIndex]?.modifiers ?? [];
  const cellModifiers = sheet?.rows[rowIndex]?.cells[colIndex]?.modifiers ?? [];

  return mergeModifiers(columnModifiers, rowModifiers, cellModifiers).flatMap((modifier) => expandAliasModifiers(workbook?.aliases, modifier));
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

function getRawDisplayValue(cell: EditorCell, computed?: ComputedCellValue): string | number | boolean | null {
  if (isMergeToken(cell.raw)) {
    return "";
  }
  if (cell.raw.startsWith("=")) {
    return computed === null || computed === undefined ? cell.raw : computed;
  }
  if (cell.raw.trim().length > 0) {
    const numericValue = Number(cell.raw.trim());
    if (!Number.isNaN(numericValue) && Number.isFinite(numericValue)) {
      return numericValue;
    }
  }
  return cell.raw;
}

function getResolvedVisualColumnWidth(
  workbook: Pick<EditorWorkbook, "aliases"> | undefined,
  sheet: EditorSheet | undefined,
  rowIndex: number,
  colIndex: number
): ResolvedWidth {
  const visualSheet: SheetNode = {
    name: sheet?.name ?? "",
    format: sheet?.format ?? { kind: "cello" },
    layout: sheet?.layout ?? {},
    rows: [],
    columns: Array.from({ length: colIndex + 1 }, (_, index) => ({
      index: index + 1,
      letter: "",
      modifiers: index === colIndex ? getColumnModifiers(sheet, rowIndex, colIndex) : [],
      hidden: false
    })),
    views: []
  };
  const width = resolveColumnWidth(workbook ?? {}, visualSheet, colIndex);
  return width;
}

function columnWidthToCss(width: ResolvedWidth): string {
  const resolved = width.kind === "fit" ? DEFAULT_COLUMN_WIDTH : width;
  if (resolved.value === undefined || resolved.unit === undefined) {
    return columnWidthToCss(DEFAULT_COLUMN_WIDTH);
  }
  return widthOuterToCss(resolved);
}

function getResolvedVisualRowLayout(
  workbook: Pick<EditorWorkbook, "aliases"> | undefined,
  sheet: EditorSheet | undefined,
  rowIndex: number
): ResolvedRowLayout {
  const visualSheet: SheetNode = {
    name: sheet?.name ?? "",
    format: sheet?.format ?? { kind: "cello" },
    layout: sheet?.layout ?? {},
    rows: [],
    columns: [],
    views: []
  };
  return resolveRowLayout(
    workbook ?? {},
    visualSheet,
    sheet?.rows[rowIndex]?.modifiers ?? []
  );
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
