import { parseDocument } from "../parser/parse.js";
import type { CelloRowSourceLocation, CelloSourceSpan } from "../shared/types.js";
import { parseTrailingModifiers } from "../shared/utils.js";

export type CelloSourceLayout = "compact" | "pretty";

export interface FormatSourceOptions {
  layout?: CelloSourceLayout;
  range?: CelloSourceSpan;
}

interface LayoutRow {
  location: CelloRowSourceLocation;
  prefix: string;
  cells: string[];
}

interface SourceReplacement {
  span: CelloSourceSpan;
  text: string;
}

/**
 * Formats recognized native Cello table blocks while preserving all other source.
 * When a range is provided, every contiguous table block intersecting it is formatted.
 */
export function formatSource(source: string, options: FormatSourceOptions = {}): string {
  const layout = options.layout ?? "compact";
  const range = options.range;
  const document = parseDocument(source, { readExternalSource: () => "" });
  const replacements: SourceReplacement[] = [];

  for (const sheet of document.sourceMap.sheets) {
    if (!sheet.editable || sheet.format.kind !== "cello") {
      continue;
    }
    const locations = [...sheet.rows, ...(sheet.defaults ? [sheet.defaults] : [])].sort((left, right) => left.line - right.line);
    for (const block of collectBlocks(source, locations)) {
      if (range && !block.some((row) => spansIntersect(row.location.lineSpan, range))) {
        continue;
      }
      replacements.push(...formatBlock(block, layout));
    }
  }

  return applySourceReplacements(source, replacements);
}

function collectBlocks(source: string, locations: CelloRowSourceLocation[]): LayoutRow[][] {
  const blocks: LayoutRow[][] = [];
  let block: LayoutRow[] = [];
  const flush = () => {
    if (block.length > 0) {
      blocks.push(block);
      block = [];
    }
  };

  for (const location of locations) {
    const row = readLayoutRow(source, location);
    const previous = block[block.length - 1];
    if (!row || (previous && location.line !== previous.location.line + 1)) {
      flush();
    }
    if (row) {
      block.push(row);
    }
  }
  flush();
  return blocks;
}

function readLayoutRow(source: string, location: CelloRowSourceLocation): LayoutRow | undefined {
  const line = source.slice(location.lineSpan.start, location.lineSpan.end);
  const content = line.trimStart();
  const firstPipe = content.indexOf("|");
  if (firstPipe < 0) {
    return undefined;
  }
  const prefix = getSupportedPrefix(content.slice(0, firstPipe).trim(), location.sourceKind);
  if (prefix === undefined) {
    return undefined;
  }
  const cells = location.cells.filter((cell) => cell.sourceKind !== "omitted").map((cell) => source.slice(cell.tokenSpan.start, cell.tokenSpan.end).trim());
  if (cells.length === 0) {
    return undefined;
  }
  return { location, prefix, cells };
}

function getSupportedPrefix(prefix: string, sourceKind: CelloRowSourceLocation["sourceKind"]): string | undefined {
  if (sourceKind === "header") {
    return prefix === "@header" ? prefix : undefined;
  }
  if (sourceKind === "defaults") {
    return prefix === "@defaults" ? prefix : undefined;
  }
  if (prefix.length === 0) {
    return "";
  }
  return parseTrailingModifiers(prefix).base.length === 0 ? prefix : undefined;
}

function formatBlock(block: LayoutRow[], layout: CelloSourceLayout): SourceReplacement[] {
  if (layout === "compact") {
    return block.map((row) => ({ span: row.location.lineSpan, text: formatCompactRow(row) }));
  }
  const prefixWidth = block.reduce((width, row) => Math.max(width, row.prefix.length), 0);
  const columnWidths = getColumnWidths(block);
  return block.map((row) => ({
    span: row.location.lineSpan,
    text: formatPrettyRow(row, prefixWidth, columnWidths)
  }));
}

function formatCompactRow(row: LayoutRow): string {
  const prefix = row.prefix.length > 0 ? `${row.prefix}${row.prefix.startsWith("@") ? " " : ""}` : "";
  return `${prefix}|${row.cells.join("|")}|`;
}

function getColumnWidths(block: LayoutRow[]): number[] {
  const count = block.reduce((maximum, row) => Math.max(maximum, row.cells.length), 0);
  const widths = new Array<number>(count).fill(0);
  for (const row of block) {
    row.cells.forEach((cell, index) => {
      widths[index] = Math.max(widths[index] ?? 0, cell.length);
    });
  }
  return widths;
}

function formatPrettyRow(row: LayoutRow, prefixWidth: number, widths: number[]): string {
  const prefix = row.prefix.length > 0 ? `${row.prefix}${" ".repeat(prefixWidth - row.prefix.length + 1)}` : prefixWidth > 0 ? " ".repeat(prefixWidth + 1) : "";
  const cells = row.cells.map((cell, index) => ` ${cell.padEnd(widths[index] ?? cell.length)} |`).join("");
  return `${prefix}|${cells}`;
}

function spansIntersect(left: CelloSourceSpan, right: CelloSourceSpan): boolean {
  return left.start <= right.end && right.start <= left.end;
}

function applySourceReplacements(source: string, replacements: SourceReplacement[]): string {
  let result = source;
  for (const replacement of [...replacements].sort((left, right) => right.span.start - left.span.start)) {
    result = `${result.slice(0, replacement.span.start)}${replacement.text}${result.slice(replacement.span.end)}`;
  }
  return result;
}
