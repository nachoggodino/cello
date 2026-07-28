import { CELLO_TONE_NAMES } from "../../core/src/index.js";
import type { AliasDeclaration, Diagnostic, Modifier, SheetFormat, SheetLayout } from "../../core/src/index.js";

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
  format: SheetFormat;
  layout?: SheetLayout;
  externalSource?: EditorExternalSource;
  rows: EditorRow[];
  defaults: EditorCell[];
}

export interface EditorWorkbook {
  aliases?: AliasDeclaration[];
  sheets: EditorSheet[];
}

export interface EditorExternalSource {
  path: string;
  status: "unresolved" | "loaded" | "unsupported" | "error";
  message?: string;
}

export interface EditorSourceSpan {
  start: number;
  end: number;
}

export interface EditorCellSourceLocation {
  span: EditorSourceSpan;
}

export interface EditorRowSourceLocation {
  line: number;
  sourceKind: "row" | "header" | "defaults";
  lineSpan: EditorSourceSpan;
  cells: EditorCellSourceLocation[];
}

export interface EditorSheetSourceLocation {
  declaration?: {
    line: number;
    lineSpan: EditorSourceSpan;
    nameSpan: EditorSourceSpan;
  };
  sheetSpan: EditorSourceSpan;
  rows: EditorRowSourceLocation[];
  defaults?: EditorRowSourceLocation;
  externalSources: Array<{
    path: string;
    line: number;
    lineSpan: EditorSourceSpan;
  }>;
  editable: boolean;
  format: SheetFormat;
}

export interface EditorSourceMap {
  sheets: EditorSheetSourceLocation[];
}

export type EditorDiagnostic = Diagnostic & {
  code?: string;
};

export interface EditorDocument {
  source: string;
  workbook: EditorWorkbook;
  sourceMap: EditorSourceMap;
  diagnostics: EditorDiagnostic[];
}

export interface EditorCommandFailure {
  ok: false;
  reason:
    | "unsupported-source-region"
    | "stale-source-map"
    | "ambiguous-cell-location"
    | "external-source-unavailable";
  message: string;
  document: EditorDocument;
}

export interface EditorCommandSuccess {
  ok: true;
  source: string;
  document: EditorDocument;
}

export type EditorCommandResult = EditorCommandSuccess | EditorCommandFailure;

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
export type ToggleModifierKey = "bold" | "italic" | "strike";
export type ColorModifierKey = "bg" | "color";
export type SheetColumnsMode = "normal" | "fit";
export type SheetRowsMode = "ellipsis" | "wrap";
export type MergeDirection = "left" | "up";
export type ComputedCellValue = string | number | boolean | null;
export type ComputedCellValues = Record<string, ComputedCellValue>;
export const TEXT_TONES = CELLO_TONE_NAMES;
export type TextTone = (typeof TEXT_TONES)[number];

export interface EditorCellStyle {
  background?: string;
  color?: string;
  fontSize?: string;
  fontStyle?: string;
  fontWeight?: number;
  height?: string;
  maxHeight?: string;
  maxWidth?: string;
  minHeight?: string;
  minWidth?: string;
  overflow?: string;
  overflowWrap?: "anywhere";
  textOverflow?: string;
  textDecoration?: string;
  whiteSpace?: "normal" | "nowrap";
  width?: string;
  WebkitBoxOrient?: "vertical";
  WebkitLineClamp?: number;
}
