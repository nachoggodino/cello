import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type {
  CellNode,
  ColumnNode,
  Diagnostic,
  Modifier,
  ParseOptions,
  RowNode,
  SheetNode,
  WorkbookAst
} from "../shared/types.js";
import {
  columnLetter,
  inferType,
  parseSheetFormat,
  parseTrailingModifiers,
  splitDelimitedLine
} from "../shared/utils.js";

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

    if (sheet.format.kind === "cello" && isHeaderRow(trimmed)) {
      applyHeaders(runtime.state, sheet, parseHeadersFromLine(trimmed), lineNumber);
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

    handleNativeLine(runtime.state, sheet, rawLine, lineNumber);
  }

  finalizeJsonSheets(runtime);

  return workbook;
}

function ensureSheet(workbook: WorkbookAst, state: MutableParseState, options: ParseOptions): SheetNode {
  if (!state.currentSheet) {
    state.currentSheet = createSheet(options.anonymousSheetName ?? DEFAULT_ANON_SHEET_NAME, undefined);
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
  const sheetMatch = trimmed.match(/^@sheet\s+(.+?)(?:\s+\[(.+)\])?$/);
  if (!sheetMatch) {
    return false;
  }

  const rawName = sheetMatch[1];
  const rawFormat = sheetMatch[2];
  if (!rawName) {
    runtime.pushDiagnostic({ level: "warning", line: lineNumber, message: "Invalid @sheet declaration." });
    return true;
  }

  const nextSheet = createSheet(rawName.trim(), rawFormat?.trim());
  runtime.workbook.sheets.push(nextSheet);
  runtime.state.currentSheet = nextSheet;
  resetSheetTracking(runtime.state);
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
  const filePath = resolve(runtime.options.baseDir ?? process.cwd(), rawPath);
  try {
    const externalText = readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
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

function createSheet(name: string, rawFormat?: string): SheetNode {
  return {
    name,
    format: parseSheetFormat(rawFormat),
    rows: [],
    columns: []
  };
}

function isHeaderRow(trimmed: string): boolean {
  return trimmed.startsWith("-") && trimmed.endsWith("-") && trimmed.includes("-");
}

function parseHeadersFromLine(trimmed: string): HeaderDef[] {
  const inner = trimmed.slice(1, -1);
  const tokens = inner.split("-");
  return tokens.map((token) => {
    const parsed = parseTrailingModifiers(token.trim());
    return { name: parsed.base, modifiers: parsed.modifiers };
  });
}

function applyHeaders(state: MutableParseState, sheet: SheetNode, headers: HeaderDef[], lineNumber: number): void {
  pushHeaderRow(sheet, headers, lineNumber);
  state.currentHeaders = headers;
  applyHeadersToColumns(sheet, headers);
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

function splitNativeRow(line: string): { rowName?: string; rowNameModifiers: Modifier[]; cells: string[] } {
  const firstPipe = line.indexOf("|");
  if (firstPipe === -1) {
    return { rowNameModifiers: [], cells: [line] };
  }

  const rowNamePart = line.slice(0, firstPipe).trim();
  const body = line.slice(firstPipe);
  const tokens = body.split("|").map((t) => t.trim());
  const cleaned = trimPipeEdgeTokens(tokens);
  if (rowNamePart.length === 0) {
    return { rowNameModifiers: [], cells: cleaned };
  }

  const parsed = parseTrailingModifiers(rowNamePart);
  return { rowName: parsed.base, rowNameModifiers: parsed.modifiers, cells: cleaned };
}

function handleNativeLine(state: MutableParseState, sheet: SheetNode, rawLine: string, lineNumber: number): void {
  const { rowName, rowNameModifiers, cells } = splitNativeRow(rawLine);
  state.previousRowByColumn = appendDataRow(
    sheet,
    cells,
    lineNumber,
    state.previousRowByColumn,
    state.currentHeaders,
    rowName,
    rowNameModifiers
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
    rowName?: string;
    rowModifiers: Modifier[];
    previousRowByColumn: Map<number, CellNode>;
    currentHeaders: HeaderDef[];
  }
): RowNode {
  const parsedCells: CellNode[] = [];
  const currentByColumn = new Map<number, CellNode>();
  const maxColumn = Math.max(cells.length, getLastDefaultColumnIndex(context.currentHeaders));

  for (let idx = 0; idx < maxColumn; idx += 1) {
    const col = idx + 1;
    const token = cells[idx]?.trim() ?? "";
    const defaultFormula = getColumnDefaultFormula(context.currentHeaders[idx]);

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

    if (token.length === 0 && defaultFormula) {
      const formulaCell = createFormulaCell(context.rowIndex, col, defaultFormula);
      parsedCells.push(formulaCell);
      currentByColumn.set(col, formulaCell);
      continue;
    }

    if (token.startsWith("=")) {
      const formulaCell = createFormulaCell(context.rowIndex, col, token);
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

  return createDataRow(context.rowIndex, context.lineNumber, parsedCells, context.rowModifiers, context.rowName);
}

function appendDataRow(
  sheet: SheetNode,
  cells: string[],
  lineNumber: number,
  previousRowByColumn: Map<number, CellNode>,
  currentHeaders: HeaderDef[],
  rowName?: string,
  rowModifiers: Modifier[] = []
): Map<number, CellNode> {
  const row = parseDataCells(cells, {
    rowIndex: sheet.rows.length + 1,
    lineNumber,
    ...(rowName ? { rowName } : {}),
    rowModifiers,
    previousRowByColumn,
    currentHeaders
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
    if (getColumnDefaultFormula(headers[idx])) {
      return idx + 1;
    }
  }

  return 0;
}

function getColumnDefaultFormula(header?: HeaderDef): string | undefined {
  const formula = header?.modifiers.find((modifier) => modifier.key === "default")?.value?.trim();
  if (!formula) {
    return undefined;
  }

  return formula.startsWith("=") ? formula : `=${formula}`;
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
  modifiers: Modifier[],
  rowName?: string
): RowNode {
  return {
    index,
    kind: "data",
    sourceLine,
    ...(rowName ? { name: rowName } : {}),
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

function createFormulaCell(row: number, col: number, formula: string): CellNode {
  return {
    row,
    col,
    raw: formula,
    kind: "formula",
    inferredType: "text",
    value: formula,
    formula,
    modifiers: [],
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
