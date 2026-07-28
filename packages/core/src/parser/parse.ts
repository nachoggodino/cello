import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type {
  CellNode,
  ColumnNode,
  Diagnostic,
  Modifier,
  ParseOptions,
  SheetLayout,
  RowNode,
  SheetNode,
  WorkbookAst
} from "../shared/types.js";
import {
  columnLetter,
  inferType,
  isCellModifier,
  isKnownModifier,
  isSheetFormatModifier,
  parseSheetFormat,
  parseTrailingModifiers,
  splitDelimitedLine
} from "../shared/utils.js";
import { isSheetColumnsMode, isSheetRowsMode } from "../shared/layout.js";

const DEFAULT_ANON_SHEET_NAME = "Sheet1";

interface MutableParseState {
  currentSheet: SheetNode | null;
  currentHeaders: Array<{ name: string; modifiers: Modifier[] }>;
  previousRowByColumn: Map<number, CellNode>;
  jsonBufferBySheet: Map<string, string[]>;
  consumedDelimitedHeaderBySheet: Set<string>;
}
interface HeaderDef {
  name: string;
  modifiers: Modifier[];
}

interface FormulaParseContext {
  lineNumber: number;
  pushDiagnostic?: (diagnostic: Diagnostic) => void;
  sheetName?: string;
}

interface ParseRuntime {
  workbook: WorkbookAst;
  options: ParseOptions;
  state: MutableParseState;
  injectedLines: string[];
  pushDiagnostic: (d: Diagnostic) => void;
  ensureSheet: () => SheetNode;
}

export function parse(text: string, options: ParseOptions = {}): WorkbookAst {
  const workbook: WorkbookAst = {
    version: "1.0",
    aliases: [],
    sheets: [],
    diagnostics: []
  };

  const state: MutableParseState = {
    currentSheet: null,
    currentHeaders: [],
    previousRowByColumn: new Map<number, CellNode>(),
    jsonBufferBySheet: new Map<string, string[]>(),
    consumedDelimitedHeaderBySheet: new Set<string>()
  };
  const sourceLines = text.replace(/\r\n/g, "\n").split("\n");
  const runtime: ParseRuntime = {
    workbook,
    options,
    state,
    injectedLines: [],
    ensureSheet: () => ensureSheet(workbook, state, options),
    pushDiagnostic: (d) => pushDiagnostic(workbook, options, d)
  };

  let lineNumber = 0;
  let sourceIndex = 0;

  while (runtime.injectedLines.length > 0 || sourceIndex < sourceLines.length) {
    const fromInjected = runtime.injectedLines.length > 0;
    const rawLine = fromInjected
      ? (runtime.injectedLines.shift() ?? "")
      : (sourceLines[sourceIndex] ?? "");
    if (!fromInjected && sourceIndex < sourceLines.length) {
      sourceIndex += 1;
    }
    lineNumber += 1;
    const trimmed = rawLine.trim();

    if (trimmed.startsWith("//")) {
      continue;
    }

    if (tryHandleSheetDeclaration(runtime, trimmed, lineNumber)) {
      continue;
    }

    if (tryHandleAliasDeclaration(runtime, trimmed, lineNumber)) {
      continue;
    }

    if (trimmed.length === 0) {
      resetRowTracking(runtime.state);
      continue;
    }

    const sheet = runtime.ensureSheet();

    if (sheet.format.kind === "json") {
      bufferJsonLine(runtime.state, sheet.name, rawLine);
      continue;
    }

    if (tryHandleExternalSource(runtime, sheet, trimmed, lineNumber)) {
      continue;
    }

    if (sheet.format.kind === "cello" && tryHandleHeaderDirective(runtime, sheet, rawLine, trimmed, lineNumber)) {
      continue;
    }

    if (sheet.format.kind === "cello" && tryHandleDefaultsDirective(runtime, sheet, rawLine, trimmed, lineNumber)) {
      continue;
    }

    if (sheet.format.kind === "delimited") {
      handleDelimitedLine(runtime.state, sheet as SheetNode & { format: Extract<SheetNode["format"], { kind: "delimited" }> }, rawLine, lineNumber);
      continue;
    }

    if (sheet.format.kind === "markdown") {
      handleMarkdownLine(runtime.state, sheet, trimmed, lineNumber);
      continue;
    }

    if (!rawLine.includes("|")) {
      runtime.pushDiagnostic({
        level: "warning",
        line: lineNumber,
        sheet: sheet.name,
        message: `Skipped non-row line: ${trimmed}`
      });
      continue;
    }

    handleNativeLine(runtime, sheet, rawLine, lineNumber);
  }

  finalizeJsonSheets(runtime);

  return workbook;
}

function ensureSheet(workbook: WorkbookAst, state: MutableParseState, options: ParseOptions): SheetNode {
  if (!state.currentSheet) {
    state.currentSheet = createSheet(options.anonymousSheetName ?? DEFAULT_ANON_SHEET_NAME);
    workbook.sheets.push(state.currentSheet);
    resetSheetTracking(state);
  }
  return state.currentSheet;
}

function pushDiagnostic(workbook: WorkbookAst, options: ParseOptions, diagnostic: Diagnostic): void {
  workbook.diagnostics.push(diagnostic);
  if (options.strict && diagnostic.level === "error") {
    throw new Error(`Parse error: ${diagnostic.message}${diagnostic.line ? ` (line ${diagnostic.line})` : ""}`);
  }
}

function resetSheetTracking(state: MutableParseState): void {
  state.currentHeaders = [];
  resetRowTracking(state);
}

function resetRowTracking(state: MutableParseState): void {
  state.previousRowByColumn = new Map<number, CellNode>();
}

function tryHandleSheetDeclaration(runtime: ParseRuntime, trimmed: string, lineNumber: number): boolean {
  const sheetMatch = trimmed.match(/^@sheet\s+(.+)$/);
  if (!sheetMatch) {
    return false;
  }

  const parsed = parseTrailingModifiers(sheetMatch[1] ?? "");
  const rawName = parsed.base;
  if (!rawName) {
    runtime.pushDiagnostic({ level: "warning", line: lineNumber, message: "Invalid @sheet declaration." });
    return true;
  }

  const nextSheet = createSheet(rawName.trim(), parsed.modifiers);
  runtime.workbook.sheets.push(nextSheet);
  runtime.state.currentSheet = nextSheet;
  resetSheetTracking(runtime.state);
  return true;
}

function tryHandleAliasDeclaration(runtime: ParseRuntime, trimmed: string, lineNumber: number): boolean {
  const aliasMatch = trimmed.match(/^@(tone|width|height)\s+(.+)$/);
  if (!aliasMatch) {
    return false;
  }

  const namespace = aliasMatch[1] as "tone" | "width" | "height";
  const parsed = parseTrailingModifiers(aliasMatch[2] ?? "");
  const name = parsed.base.trim();
  if (!name || parsed.modifiers.length === 0) {
    runtime.pushDiagnostic({
      level: "warning",
      line: lineNumber,
      message: `Invalid @${namespace} alias declaration.`
    });
    return true;
  }

  runtime.workbook.aliases.push({ namespace, name, modifiers: parsed.modifiers });
  return true;
}

function tryHandleExternalSource(
  runtime: ParseRuntime,
  sheet: SheetNode,
  trimmed: string,
  lineNumber: number
): boolean {
  const externalSourceMatch = trimmed.match(/^->\s+(.+)$/);
  if (!externalSourceMatch) {
    return false;
  }

  if (sheet.rows.length > 0) {
    runtime.pushDiagnostic({
      level: "warning",
      line: lineNumber,
      sheet: sheet.name,
      message: "External sheet source (-> path) must appear before any rows in a sheet."
    });
    return true;
  }

  const rawPath = (externalSourceMatch[1] ?? "").trim();
  const baseDir = runtime.options.baseDir ?? getDefaultBaseDir();
  const filePath = resolve(baseDir, rawPath);
  try {
    const externalText = readExternalSource(runtime.options, rawPath, baseDir, filePath).replace(/\r\n/g, "\n");
    const externalLines = externalText.split("\n");
    runtime.injectedLines = externalLines.concat(runtime.injectedLines);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    runtime.pushDiagnostic({
      level: "warning",
      line: lineNumber,
      sheet: sheet.name,
      message: `Failed to load external sheet source "${rawPath}": ${message}`
    });
  }
  return true;
}

function getDefaultBaseDir(): string {
  return typeof process !== "undefined" && typeof process.cwd === "function" ? process.cwd() : ".";
}

function readExternalSource(options: ParseOptions, rawPath: string, baseDir: string, resolvedPath: string): string {
  return options.readExternalSource
    ? options.readExternalSource(rawPath, { baseDir, resolvedPath })
    : readFileSync(resolvedPath, "utf8");
}

function bufferJsonLine(state: MutableParseState, sheetName: string, rawLine: string): void {
  const current = state.jsonBufferBySheet.get(sheetName) ?? [];
  current.push(rawLine);
  state.jsonBufferBySheet.set(sheetName, current);
}

function finalizeJsonSheets(runtime: ParseRuntime): void {
  for (const sheet of runtime.workbook.sheets) {
    if (sheet.format.kind !== "json") {
      continue;
    }
    const raw = (runtime.state.jsonBufferBySheet.get(sheet.name) ?? []).join("\n").trim();
    if (raw.length === 0) {
      continue;
    }

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || (parsed[0] && typeof parsed[0] !== "object")) {
        throw new Error("JSON sheet expects an array of flat objects.");
      }

      const first = parsed[0] as Record<string, unknown> | undefined;
      const headers = Object.keys(first ?? {}).map((name) => ({ name, modifiers: [] as Modifier[] }));
      if (headers.length > 0) {
        applyHeaders(runtime.state, sheet, headers, 0);
      }
      let previousRowByColumn = mapLatestVisibleCells(
        sheet.rows[sheet.rows.length - 1] ?? {
          index: 0,
          kind: "data",
          sourceLine: 0,
          modifiers: [],
          cells: []
        }
      );

      for (const obj of parsed as Array<Record<string, unknown>>) {
        const cells = headers.map((h) => stringifyJsonValue(obj[h.name]));
        previousRowByColumn = appendDataRow(sheet, cells, 0, previousRowByColumn, headers);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      runtime.workbook.diagnostics.push({
        level: "warning",
        sheet: sheet.name,
        message: `JSON parse failed. Falling back to single text row: ${message}`
      });
      const row = parseDataCells([raw], {
        rowIndex: sheet.rows.length + 1,
        lineNumber: 0,
        rowModifiers: [],
        previousRowByColumn: new Map<number, CellNode>(),
        currentHeaders: []
      });
      sheet.rows.push(row);
      registerColumns(sheet, row.cells, []);
    }
  }
}

function createSheet(name: string, modifiers: Modifier[] = []): SheetNode {
  const formatModifier = modifiers.find((modifier) => isSheetFormatModifier(modifier));
  return {
    name,
    format: parseSheetFormat(formatModifier?.raw),
    layout: parseSheetLayout(modifiers),
    rows: [],
    columns: []
  };
}

function parseSheetLayout(modifiers: Modifier[]): SheetLayout {
  const layout: SheetLayout = {};
  for (const modifier of modifiers) {
    if (modifier.key === "columns" && isSheetColumnsMode(modifier.value)) {
      layout.columns = modifier.value;
    }
    if (modifier.key === "rows" && isSheetRowsMode(modifier.value)) {
      layout.rows = modifier.value;
    }
  }
  return layout;
}

function tryHandleHeaderDirective(
  runtime: ParseRuntime,
  sheet: SheetNode,
  rawLine: string,
  trimmed: string,
  lineNumber: number
): boolean {
  if (!/^@header(?:\s|$)/.test(trimmed)) {
    return false;
  }

  const markerStart = rawLine.indexOf("@header");
  const body = rawLine.slice(markerStart + "@header".length).trim();
  if (!body.includes("|")) {
    runtime.pushDiagnostic({
      level: "warning",
      line: lineNumber,
      sheet: sheet.name,
      message: "@header must be followed by a pipe-separated row."
    });
    return true;
  }

  applyHeaders(runtime.state, sheet, parseHeadersFromLine(body), lineNumber);
  return true;
}

function parseHeadersFromLine(line: string): HeaderDef[] {
  return splitNativeCells(line).map((token) => {
    const parsed = parseTrailingModifiers(token.trim());
    return { name: parsed.base, modifiers: parsed.modifiers.filter((modifier) => modifier.key !== "default") };
  });
}

function applyHeaders(state: MutableParseState, sheet: SheetNode, headers: HeaderDef[], lineNumber: number): void {
  pushHeaderRow(sheet, headers, lineNumber);
  state.currentHeaders = headers;
  applyHeadersToColumns(sheet, headers);
}

function tryHandleDefaultsDirective(
  runtime: ParseRuntime,
  sheet: SheetNode,
  rawLine: string,
  trimmed: string,
  lineNumber: number
): boolean {
  if (!/^@defaults(?:\s|$)/.test(trimmed)) {
    return false;
  }

  const markerStart = rawLine.indexOf("@defaults");
  const body = rawLine.slice(markerStart + "@defaults".length).trim();
  if (!body.includes("|")) {
    runtime.pushDiagnostic({
      level: "warning",
      line: lineNumber,
      sheet: sheet.name,
      message: "@defaults must be followed by a pipe-separated row."
    });
    return true;
  }

  applyDefaults(runtime.state, sheet, splitNativeCells(body));
  return true;
}

function applyDefaults(state: MutableParseState, sheet: SheetNode, defaults: string[]): void {
  const maxColumns = Math.max(defaults.length, state.currentHeaders.length);
  const nextHeaders: HeaderDef[] = [];

  for (let idx = 0; idx < maxColumns; idx += 1) {
    const header = state.currentHeaders[idx] ?? { name: "", modifiers: [] };
    const rawDefault = defaults[idx]?.trim() ?? "";
    const modifiers = rawDefault.length > 0
      ? upsertDefaultModifier(header.modifiers, rawDefault)
      : header.modifiers;
    nextHeaders[idx] = { name: header.name, modifiers };
  }

  state.currentHeaders = nextHeaders;
  applyHeadersToColumns(sheet, nextHeaders);
}

function upsertDefaultModifier(modifiers: Modifier[], token: string): Modifier[] {
  const defaultModifier: Modifier = {
    raw: `default:${token}`,
    key: "default",
    value: token
  };
  return [...modifiers.filter((modifier) => modifier.key !== "default"), defaultModifier];
}

function pushHeaderRow(sheet: SheetNode, headers: HeaderDef[], lineNumber: number): void {
  const index = sheet.rows.length + 1;
  sheet.rows.push({
    index,
    kind: "header",
    sourceLine: lineNumber,
    modifiers: [],
    cells: headers.map((header, col) => createValueCell(index, col + 1, header.name, header.modifiers, "text"))
  });
}

function splitNativeCells(line: string): string[] {
  const tokens = line.split("|").map((t) => t.trim());
  return trimPipeEdgeTokens(tokens);
}

function splitNativeRow(line: string): { rowModifiers: Modifier[]; unsupportedPrefix?: string; cells: string[] } {
  const firstPipe = line.indexOf("|");
  if (firstPipe === -1) {
    return { rowModifiers: [], cells: [line] };
  }

  const rowPrefix = line.slice(0, firstPipe).trim();
  const body = line.slice(firstPipe);
  const cells = splitNativeCells(body);
  if (rowPrefix.length === 0) {
    return { rowModifiers: [], cells };
  }

  const parsed = parseTrailingModifiers(rowPrefix);
  if (parsed.base.length === 0) {
    return { rowModifiers: parsed.modifiers, cells };
  }

  return { rowModifiers: [], unsupportedPrefix: rowPrefix, cells };
}

function handleNativeLine(runtime: ParseRuntime, sheet: SheetNode, rawLine: string, lineNumber: number): void {
  const { rowModifiers, unsupportedPrefix, cells } = splitNativeRow(rawLine);
  if (unsupportedPrefix) {
    runtime.pushDiagnostic({
      level: "warning",
      line: lineNumber,
      sheet: sheet.name,
      message: `Ignored unsupported row prefix "${unsupportedPrefix}". Row references are not supported.`
    });
  }
  runtime.state.previousRowByColumn = appendDataRow(
    sheet,
    cells,
    lineNumber,
    runtime.state.previousRowByColumn,
    runtime.state.currentHeaders,
    rowModifiers,
    runtime.pushDiagnostic
  );
}

function handleDelimitedLine(
  state: MutableParseState,
  sheet: SheetNode & { format: Extract<SheetNode["format"], { kind: "delimited" }> },
  rawLine: string,
  lineNumber: number
): void {
  const parts = splitDelimitedLine(rawLine, sheet.format.delimiter).map((v) => v.trim());
  const headerConsumedKey = sheet.name;

  if (!sheet.format.noHeader && !state.consumedDelimitedHeaderBySheet.has(headerConsumedKey)) {
    applyHeaders(state, sheet, toHeaderDefs(parts), lineNumber);
    state.consumedDelimitedHeaderBySheet.add(headerConsumedKey);
    return;
  }

  state.previousRowByColumn = appendDataRow(sheet, parts, lineNumber, state.previousRowByColumn, state.currentHeaders);
}

function handleMarkdownLine(state: MutableParseState, sheet: SheetNode, trimmed: string, lineNumber: number): void {
  if (isMarkdownSeparator(trimmed) || !trimmed.includes("|")) {
    return;
  }

  const parts = parseMarkdownLine(trimmed);
  if (state.currentHeaders.length === 0) {
    applyHeaders(state, sheet, toHeaderDefs(parts), lineNumber);
    return;
  }

  state.previousRowByColumn = appendDataRow(sheet, parts, lineNumber, state.previousRowByColumn, state.currentHeaders);
}

function parseDataCells(
  cells: string[],
  context: {
    rowIndex: number;
    lineNumber: number;
    rowModifiers: Modifier[];
    previousRowByColumn: Map<number, CellNode>;
    currentHeaders: HeaderDef[];
    pushDiagnostic?: (diagnostic: Diagnostic) => void;
    sheetName?: string;
  }
): RowNode {
  const parsedCells: CellNode[] = [];
  const currentByColumn = new Map<number, CellNode>();
  const maxColumn = Math.max(cells.length, getLastDefaultColumnIndex(context.currentHeaders));

  for (let idx = 0; idx < maxColumn; idx += 1) {
    const col = idx + 1;
    const token = cells[idx]?.trim() ?? "";
    const defaultToken = getColumnDefaultToken(context.currentHeaders[idx]);

    if (token === "<") {
      const left = currentByColumn.get(col - 1);
      if (left) {
        left.colspan += 1;
      }
      parsedCells.push(createMergeCell(context.rowIndex, col, "merge-left"));
      if (left) {
        currentByColumn.set(col, left);
      }
      continue;
    }

    if (token === "^") {
      const above = context.previousRowByColumn.get(col);
      if (above) {
        above.rowspan += 1;
      }
      parsedCells.push(createMergeCell(context.rowIndex, col, "merge-up"));
      if (above) {
        currentByColumn.set(col, above);
      }
      continue;
    }

    if (token.length === 0 && defaultToken) {
      const cell = createCellFromDefault(context.rowIndex, col, defaultToken, context);
      parsedCells.push(cell);
      currentByColumn.set(col, cell);
      continue;
    }

    if (token.startsWith("=")) {
      const formulaCell = createFormulaCellFromToken(context.rowIndex, col, token, context);
      parsedCells.push(formulaCell);
      currentByColumn.set(col, formulaCell);
      continue;
    }

    const extracted = parseTrailingModifiers(token);
    const inferred = inferType(extracted.base);
    const cell = createValueCell(context.rowIndex, col, inferred.parsed, extracted.modifiers, inferred.inferredType, token);

    parsedCells.push(cell);
    currentByColumn.set(col, cell);
  }

  return createDataRow(context.rowIndex, context.lineNumber, parsedCells, context.rowModifiers);
}

function appendDataRow(
  sheet: SheetNode,
  cells: string[],
  lineNumber: number,
  previousRowByColumn: Map<number, CellNode>,
  currentHeaders: HeaderDef[],
  rowModifiers: Modifier[] = [],
  pushDiagnostic?: (diagnostic: Diagnostic) => void
): Map<number, CellNode> {
  const row = parseDataCells(cells, {
    rowIndex: sheet.rows.length + 1,
    lineNumber,
    rowModifiers,
    previousRowByColumn,
    currentHeaders,
    sheetName: sheet.name,
    ...(pushDiagnostic ? { pushDiagnostic } : {})
  });
  sheet.rows.push(row);
  registerColumns(sheet, row.cells, currentHeaders);
  return mapLatestVisibleCells(row);
}

function registerColumns(
  sheet: SheetNode,
  cells: CellNode[],
  currentHeaders: Array<{ name: string; modifiers: Modifier[] }>
): void {
  const maxCol = cells.length;
  for (let col = 1; col <= maxCol; col += 1) {
    if (sheet.columns[col - 1]) {
      continue;
    }
    const header = currentHeaders[col - 1];
    sheet.columns[col - 1] = createColumnNode(col, header);
  }
}

function applyHeadersToColumns(sheet: SheetNode, headers: Array<{ name: string; modifiers: Modifier[] }>): void {
  for (let i = 0; i < headers.length; i += 1) {
    const header = headers[i];
    if (!header) {
      continue;
    }
    sheet.columns[i] = createColumnNode(i + 1, header);
  }
}

function mapLatestVisibleCells(row: RowNode): Map<number, CellNode> {
  const map = new Map<number, CellNode>();
  for (const cell of row.cells) {
    if (cell.kind === "merge-left" || cell.kind === "merge-up") {
      continue;
    }
    map.set(cell.col, cell);
  }
  return map;
}

function isMarkdownSeparator(trimmed: string): boolean {
  const collapsed = trimmed.replaceAll(" ", "");
  return /^(\|)?[:\-|]+(\|)?$/.test(collapsed);
}

function parseMarkdownLine(trimmed: string): string[] {
  const parts = trimmed.split("|").map((p) => p.trim());
  return trimPipeEdgeTokens(parts);
}

function trimPipeEdgeTokens(tokens: string[]): string[] {
  return tokens
    .filter((_, idx) => !(idx === 0 && tokens[0] === ""))
    .filter((_, idx, arr) => !(idx === arr.length - 1 && arr[idx] === ""));
}

function toHeaderDefs(values: string[]): HeaderDef[] {
  return values.map((name) => ({ name, modifiers: [] }));
}

function getLastDefaultColumnIndex(headers: HeaderDef[]): number {
  for (let idx = headers.length - 1; idx >= 0; idx -= 1) {
    if (getColumnDefaultToken(headers[idx])) {
      return idx + 1;
    }
  }

  return 0;
}

function getColumnDefaultToken(header?: HeaderDef): string | undefined {
  const token = header?.modifiers.find((modifier) => modifier.key === "default")?.value?.trim();
  return token && token.length > 0 ? token : undefined;
}

function createColumnNode(index: number, header?: HeaderDef): ColumnNode {
  return {
    index,
    letter: columnLetter(index),
    ...(header?.name ? { name: header.name } : {}),
    modifiers: header?.modifiers ?? [],
    hidden: Boolean(header?.modifiers.some((m) => m.key === "hidden"))
  };
}

function createDataRow(
  index: number,
  sourceLine: number,
  cells: CellNode[],
  modifiers: Modifier[]
): RowNode {
  return {
    index,
    kind: "data",
    sourceLine,
    modifiers,
    cells
  };
}

function createValueCell(
  row: number,
  col: number,
  value: CellNode["value"],
  modifiers: Modifier[],
  inferredType: CellNode["inferredType"],
  raw = value === null ? "" : String(value)
): CellNode {
  return {
    row,
    col,
    raw,
    kind: inferredType === "empty" ? "empty" : "value",
    inferredType,
    value,
    modifiers,
    colspan: 1,
    rowspan: 1
  };
}

function createCellFromDefault(
  row: number,
  col: number,
  token: string,
  context?: FormulaParseContext
): CellNode {
  if (token.startsWith("=")) {
    return createFormulaCellFromToken(row, col, token, context);
  }

  const extracted = parseTrailingModifiers(token);
  const inferred = inferType(extracted.base);
  return createValueCell(row, col, inferred.parsed, extracted.modifiers, inferred.inferredType, token);
}

function createFormulaCellFromToken(
  row: number,
  col: number,
  token: string,
  context?: FormulaParseContext
): CellNode {
  const extracted = parseTrailingModifiers(token);
  if (extracted.modifiers.length > 0 && extracted.modifiers.every(isCellModifier)) {
    return createFormulaCell(row, col, extracted.base, extracted.modifiers, token);
  }
  const wrongScope = extracted.modifiers.find((modifier) => isKnownModifier(modifier) && !isCellModifier(modifier));
  if (wrongScope) {
    context?.pushDiagnostic?.({
      level: "warning",
      line: context.lineNumber,
      ...(context.sheetName ? { sheet: context.sheetName } : {}),
      message: `Formula cell modifier [${wrongScope.raw}] is a known Cello modifier, but it is not valid on cells. Keeping it as formula text.`
    });
  }

  return createFormulaCell(row, col, token, [], token);
}

function createFormulaCell(row: number, col: number, formula: string, modifiers: Modifier[] = [], raw = formula): CellNode {
  return {
    row,
    col,
    raw,
    kind: "formula",
    inferredType: "text",
    value: formula,
    formula,
    modifiers,
    colspan: 1,
    rowspan: 1
  };
}

function createMergeCell(row: number, col: number, kind: "merge-left" | "merge-up"): CellNode {
  return {
    row,
    col,
    raw: kind === "merge-left" ? "<" : "^",
    kind,
    inferredType: "empty",
    value: null,
    modifiers: [],
    colspan: 0,
    rowspan: 0
  };
}

function stringifyJsonValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}
