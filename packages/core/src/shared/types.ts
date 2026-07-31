export type CelloVersion = "1.0";

export type SheetFormat =
  { kind: "cello" } | { kind: "delimited"; delimiter: string; noHeader: boolean; alias?: "csv" | "tsv" | "excel" } | { kind: "markdown" } | { kind: "json"; path?: string };

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

/** Stable machine-readable diagnostic identifiers. */
export const DIAGNOSTIC_CODES = [
  "skipped-non-row-line",
  "invalid-sheet-declaration",
  "invalid-alias-declaration",
  "invalid-header-directive",
  "invalid-defaults-directive",
  "unsupported-row-prefix",
  "invalid-formula-modifier-scope",
  "duplicate-sheet-identity",
  "duplicate-alias-identity",
  "formula-syntax-error",
  "formula-reference-error",
  "formula-runtime-error",
  "formula-empty-reference",
  "formula-engine-unavailable",
  "formula-engine-initialization-error",
  "formula-evaluation-error",
  "render-error",
  "ambiguous-workbook-identity",
  "external-source-error",
  "external-source-unsupported",
  "foreign-format-error"
] as const;

export type DiagnosticCode = (typeof DIAGNOSTIC_CODES)[number];

export interface SheetLayout {
  columns?: SheetColumnsDefault;
  rows?: SheetRowsDefault;
}

export interface CellNode {
  row: number;
  col: number;
  raw: string;
  kind: CellKind;
  inferredType: InferredType;
  value: string | number | boolean | null;
  formula?: string;
  formulaHeaders?: string[];
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
}

export type DiagnosticLevel = "warning" | "error";
export type DiagnosticStage = "parse" | "evaluate" | "validate" | "render";
export type DiagnosticCategory = "syntax" | "identity" | "reference" | "runtime" | "external" | "format";
export type DiagnosticContextValue = string | number | boolean | null;

export interface DiagnosticLocation {
  line: number;
  column?: number;
  sheet?: string;
  span?: CelloSourceSpan;
}

export interface Diagnostic {
  /** Stable machine-readable identifier. */
  code: DiagnosticCode;
  /** Canonical severity. */
  severity: DiagnosticLevel;
  /** @deprecated Use severity. Retained through 1.x for compatibility. */
  level: DiagnosticLevel;
  stage: DiagnosticStage;
  category: DiagnosticCategory;
  message: string;
  line?: number;
  sheet?: string;
  primary?: DiagnosticLocation;
  external?: {
    path: string;
    line?: number;
    column?: number;
  };
  context?: Readonly<Record<string, DiagnosticContextValue>>;
  related?: DiagnosticLocation[];
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
  dependencies: ExternalDependency[];
}

export interface ExternalDependency {
  sheet: string;
  path: string;
  resolvedPath: string;
  sourceLine: number;
}

export interface ExternalSourceLimits {
  maxBytes?: number;
  maxRows?: number;
  maxCells?: number;
  maxColumns?: number;
}

export interface ParseOptions {
  strict?: boolean;
  anonymousSheetName?: string;
  baseDir?: string;
  externalLimits?: ExternalSourceLimits;
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
  nonce?: string;
}
