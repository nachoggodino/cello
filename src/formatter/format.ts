import { parseSheetFormat, parseTrailingModifiers } from "../shared/utils.js";

interface FormatRow {
  leading: string;
  prefix: string;
  cells: string[];
}

export function format(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const output: string[] = [];
  let activeSheetFormat: "cello" | "other" = "cello";
  let block: FormatRow[] = [];

  const flushBlock = () => {
    if (block.length === 0) {
      return;
    }
    output.push(...formatBlock(block));
    block = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("//") || trimmed.length === 0) {
      flushBlock();
      output.push(line);
      continue;
    }

    const sheetMatch = trimmed.match(/^@sheet\s+(.+?)(?:\s+\[(.+)\])?$/);
    if (sheetMatch) {
      flushBlock();
      activeSheetFormat = parseSheetFormat(sheetMatch[2]?.trim()).kind === "cello" ? "cello" : "other";
      output.push(line);
      continue;
    }

    if (activeSheetFormat !== "cello") {
      flushBlock();
      output.push(line);
      continue;
    }

    const parsed = parseFormatRow(line);
    if (parsed) {
      block.push(parsed);
      continue;
    }

    flushBlock();
    output.push(line);
  }

  flushBlock();
  return output.join("\n");
}

function parseFormatRow(line: string): FormatRow | null {
  const leading = "";
  const content = line.trimStart();

  if (/^@header(?:\s|$)/.test(content)) {
    return parseDirectiveRow(leading, content, "@header");
  }

  if (/^@defaults(?:\s|$)/.test(content)) {
    return parseDirectiveRow(leading, content, "@defaults");
  }

  const firstPipe = content.indexOf("|");
  if (firstPipe < 0) {
    return null;
  }

  const prefix = content.slice(0, firstPipe).trim();
  const body = content.slice(firstPipe);
  const cells = splitPipeCells(body);
  if (prefix.length === 0) {
    return { leading, prefix: "", cells };
  }

  const parsed = parseTrailingModifiers(prefix);
  if (parsed.base.length === 0) {
    return { leading, prefix, cells };
  }

  return null;
}

function parseDirectiveRow(leading: string, content: string, directive: "@header" | "@defaults"): FormatRow | null {
  const body = content.slice(directive.length).trim();
  if (!body.includes("|")) {
    return null;
  }
  return {
    leading,
    prefix: directive,
    cells: splitPipeCells(body)
  };
}

function splitPipeCells(line: string): string[] {
  const tokens = line.split("|").map((token) => token.trim());
  return tokens
    .filter((_, index) => !(index === 0 && tokens[0] === ""))
    .filter((_, index, all) => !(index === all.length - 1 && all[index] === ""));
}

function formatBlock(rows: FormatRow[]): string[] {
  const prefixWidth = rows.reduce((max, row) => Math.max(max, row.prefix.length), 0);
  const columnCount = rows.reduce((max, row) => Math.max(max, row.cells.length), 0);
  const columnWidths = new Array<number>(columnCount).fill(0);

  for (const row of rows) {
    for (let index = 0; index < columnCount; index += 1) {
      const cell = row.cells[index] ?? "";
      if (cell.length > (columnWidths[index] ?? 0)) {
        columnWidths[index] = cell.length;
      }
    }
  }

  return rows.map((row) => formatRow(row, prefixWidth, columnWidths));
}

function formatRow(row: FormatRow, prefixWidth: number, columnWidths: number[]): string {
  const formattedPrefix =
    row.prefix.length > 0
      ? `${row.prefix}${" ".repeat(prefixWidth - row.prefix.length + 1)}`
      : prefixWidth > 0
        ? " ".repeat(prefixWidth + 1)
        : "";

  let formatted = `${row.leading}${formattedPrefix}|`;
  for (let index = 0; index < columnWidths.length; index += 1) {
    const cell = row.cells[index] ?? "";
    formatted += ` ${cell.padEnd(columnWidths[index] ?? 0)} |`;
  }
  return formatted;
}
