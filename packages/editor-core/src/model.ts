import type { Modifier } from "../../core/src/index.js";

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

export type ModifierScope = "cell" | "row" | "column";
export type ToggleModifierKey = "bold" | "italic";
export type ColorModifierKey = "bg" | "color";
export type MergeDirection = "left" | "up";
export type ComputedCellValue = string | number | boolean | null;
export type ComputedCellValues = Record<string, ComputedCellValue>;

export interface EditorCellStyle {
  background?: string;
  color?: string;
  fontStyle?: string;
  fontWeight?: number;
}
