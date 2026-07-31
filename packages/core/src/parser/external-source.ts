import { resolveExternalSourcePath } from "../shared/external-path.js";
import type { ParseOptions, SheetNode } from "../shared/types.js";

interface LoadedExternalSource {
  resolvedPath: string;
  text: string;
}

export function assertExternalDeclaration(sheet: SheetNode, rawPath: string, alreadyDeclared: boolean, canReadExternalSource: boolean): void {
  if (sheet.format.kind === "cello") {
    throw new Error("External sources require an explicit raw-data sheet format.");
  }
  if (sheet.rows.length > 0) {
    throw new Error("External sheet source (-> path) must appear before any rows in a sheet.");
  }
  if (alreadyDeclared) {
    throw new Error("A sheet may declare only one external source.");
  }
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(rawPath)) {
    throw new Error("Network URLs are not supported.");
  }
  if (/\.cel$/i.test(rawPath)) {
    throw new Error("External Cello workbooks are not supported.");
  }
  if (!hasSupportedExternalExtension(sheet, rawPath)) {
    throw new Error("External source extension does not match a supported raw-data format.");
  }
  if (!canReadExternalSource) {
    throw new Error("This host did not provide external-source file access.");
  }
}

export function loadExternalSourceText(options: ParseOptions, rawPath: string): LoadedExternalSource {
  const baseDir = options.baseDir ?? ".";
  const resolvedPath = resolveExternalSourcePath(baseDir, rawPath);
  const readExternalSource = options.readExternalSource;
  if (!readExternalSource) {
    throw new Error("External-source file access is unavailable.");
  }
  const text = readExternalSource(rawPath, { baseDir, resolvedPath }).replace(/\r\n?/g, "\n");
  assertExternalTextLimits(text, options);
  return { resolvedPath, text };
}

export function assertForeignTableLimits(sheet: SheetNode, options: ParseOptions): void {
  const maxRows = options.externalLimits?.maxRows ?? 100_000;
  const maxColumns = options.externalLimits?.maxColumns ?? 1_024;
  const maxCells = options.externalLimits?.maxCells ?? 1_000_000;
  const columnCount = sheet.rows.reduce((max, row) => Math.max(max, row.cells.length), 0);
  const cellCount = sheet.rows.reduce((total, row) => total + row.cells.length, 0);
  if (sheet.rows.length > maxRows) {
    throw new Error(`Foreign table exceeds the ${maxRows}-row limit.`);
  }
  if (columnCount > maxColumns) {
    throw new Error(`Foreign table exceeds the ${maxColumns}-column limit.`);
  }
  if (cellCount > maxCells) {
    throw new Error(`Foreign table exceeds the ${maxCells}-cell limit.`);
  }
}

export function getJsonErrorLocation(raw: string, message: string): { line?: number; column?: number } {
  const directLocation = message.match(/line (\d+) column (\d+)/i);
  if (directLocation) {
    return { line: Number(directLocation[1]), column: Number(directLocation[2]) };
  }
  const reportedPosition = message.match(/position (\d+)/i)?.[1];
  const unexpectedToken = message.match(/Unexpected token '(.+?)'/i)?.[1];
  const position = reportedPosition === undefined ? (unexpectedToken ? raw.lastIndexOf(unexpectedToken) : Number.NaN) : Number(reportedPosition);
  if (!Number.isInteger(position) || position < 0) {
    return {};
  }
  const before = raw.slice(0, position);
  const lines = before.split("\n");
  return { line: lines.length, column: (lines.at(-1)?.length ?? 0) + 1 };
}

function hasSupportedExternalExtension(sheet: SheetNode, path: string): boolean {
  const extension = path.toLowerCase().match(/\.[a-z0-9]+$/)?.[0];
  if (sheet.format.kind === "json") {
    return extension === ".json";
  }
  if (sheet.format.kind === "markdown") {
    return extension === ".md" || extension === ".markdown";
  }
  if (sheet.format.kind === "delimited") {
    if (sheet.format.alias === "csv") return extension === ".csv";
    if (sheet.format.alias === "tsv") return extension === ".tsv";
    return extension === ".txt" || extension === ".csv" || extension === ".tsv";
  }
  return false;
}

function assertExternalTextLimits(text: string, options: ParseOptions): void {
  if (text.includes("\uFFFD")) {
    throw new Error("External source is not valid UTF-8 text.");
  }
  const maxBytes = options.externalLimits?.maxBytes ?? 10 * 1024 * 1024;
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new Error(`External source exceeds the ${maxBytes}-byte limit.`);
  }
}
