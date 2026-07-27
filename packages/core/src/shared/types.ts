export type CelloVersion = "1.0";

export type SheetFormat =
  | { kind: "cello" }
  | { kind: "delimited"; delimiter: string; noHeader: boolean; alias?: "csv" | "tsv" | "excel" }
  | { kind: "markdown" }
  | { kind: "json"; path?: string };

export type RowKind = "header" | "data";
export type CellKind = "value" | "formula" | "merge-left" | "merge-up" | "empty";
export type InferredType = "number" | "date" | "boolean" | "text" | "empty";

export interface Modifier {
  raw: string;
  key: string;
  value?: string;
}

export interface CellNode {
  row: number;
  col: number;
  raw: string;
  kind: CellKind;
  inferredType: InferredType;
  value: string | number | boolean | null;
  formula?: string;
  modifiers: Modifier[];
  computed?: string | number | boolean | null;
  colspan: number;
  rowspan: number;
}

export interface RowNode {
  index: number;
  kind: RowKind;
  sourceLine: number;
  modifiers: Modifier[];
  cells: CellNode[];
}

export interface ColumnNode {
  index: number;
  letter: string;
  name?: string;
  modifiers: Modifier[];
  hidden: boolean;
}

export interface SheetNode {
  name: string;
  format: SheetFormat;
  rows: RowNode[];
  columns: ColumnNode[];
}

export type DiagnosticLevel = "warning" | "error";

export interface Diagnostic {
  level: DiagnosticLevel;
  message: string;
  line?: number;
  sheet?: string;
}

export interface WorkbookAst {
  version: CelloVersion;
  sheets: SheetNode[];
  diagnostics: Diagnostic[];
}

export interface ParseOptions {
  strict?: boolean;
  anonymousSheetName?: string;
  baseDir?: string;
  readExternalSource?: (path: string, context: { baseDir: string; resolvedPath: string }) => string;
}

export interface EvaluateOptions {
  strict?: boolean;
}

export interface RenderOptions {
  strict?: boolean;
  title?: string;
  baseDir?: string;
  readExternalSource?: ParseOptions["readExternalSource"];
  evaluate?: boolean;
  format?: "document" | "fragment";
  interactive?: boolean;
}
