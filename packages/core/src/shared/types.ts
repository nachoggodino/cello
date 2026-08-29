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

export type AliasNamespace = "tone" | "width" | "height";
export type SheetColumnsDefault = "normal" | "fit";
export type SheetRowsDefault = "ellipsis" | "wrap";

export interface AliasDeclaration {
  namespace: AliasNamespace;
  name: string;
  modifiers: Modifier[];
}

export interface SheetLayout {
  columns?: SheetColumnsDefault;
  rows?: SheetRowsDefault;
}

export type ViewSortDirection = "asc" | "desc";

export interface ViewColumnRule {
  filter?: string;
  sort?: ViewSortDirection;
}

export interface SheetView {
  name: string;
  default: boolean;
  columns: ViewColumnRule[];
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
  layout: SheetLayout;
  rows: RowNode[];
  columns: ColumnNode[];
  views: SheetView[];
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
  aliases: AliasDeclaration[];
  sheets: SheetNode[];
  diagnostics: Diagnostic[];
}

export interface CelloSourceSpan {
  start: number;
  end: number;
}

export interface CelloCellSourceLocation {
  span: CelloSourceSpan;
  tokenSpan: CelloSourceSpan;
  sourceKind: "explicit-value" | "explicit-empty" | "omitted";
  valueOrigin: "explicit" | "empty" | "default-derived" | "absent";
  defaultSpan?: CelloSourceSpan;
}

export interface CelloRowSourceLocation {
  line: number;
  sourceKind: "row" | "header" | "defaults";
  lineSpan: CelloSourceSpan;
  cells: CelloCellSourceLocation[];
}

export interface CelloSheetSourceLocation {
  declaration?: {
    line: number;
    lineSpan: CelloSourceSpan;
    nameSpan: CelloSourceSpan;
  };
  sheetSpan: CelloSourceSpan;
  rows: CelloRowSourceLocation[];
  defaults?: CelloRowSourceLocation;
  views: Array<{
    name: string;
    line: number;
    lineSpan: CelloSourceSpan;
    nameSpan: CelloSourceSpan;
    cells: CelloCellSourceLocation[];
  }>;
  externalSources: Array<{
    path: string;
    line: number;
    lineSpan: CelloSourceSpan;
  }>;
  editable: boolean;
  format: SheetFormat;
}

export interface CelloSourceMap {
  sheets: CelloSheetSourceLocation[];
}

export interface ParsedCelloDocument {
  source: string;
  workbook: WorkbookAst;
  sourceMap: CelloSourceMap;
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
