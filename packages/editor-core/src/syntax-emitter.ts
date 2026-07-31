import { sheetLayoutToToken } from "../../core/src/internal.js";
import type { EditorCell, EditorRow, EditorSheet } from "./model.js";
import { DEFAULT_SHEET_NAME } from "./options.js";
import { isMergeToken } from "./source.js";

export function emitEditorSheet(sheet: EditorSheet): string {
  const lines = [emitEditorSheetDeclaration(sheet)];
  const defaults = emitEditorDefaultsRow(sheet);
  for (const row of sheet.rows) {
    lines.push(emitEditorRow(row));
    if (row.kind === "header" && defaults) {
      lines.push(defaults);
    }
  }
  if (!sheet.rows.some((row) => row.kind === "header") && defaults) {
    lines.push(defaults);
  }
  return lines.join("\n");
}

export function emitEditorSheetDeclaration(sheet: EditorSheet): string {
  const formatToken = emitSheetFormatToken(sheet);
  const layoutToken = sheetLayoutToToken(sheet.layout);
  const tokens = [formatToken, layoutToken].filter(Boolean).join("");
  return `@sheet ${emitEditorSheetName(sheet.name)}${tokens ? ` ${tokens}` : ""}`;
}

export function emitForeignEditorSheet(sheet: EditorSheet): string {
  const lines = [emitEditorSheetDeclaration(sheet)];
  if (sheet.format.kind === "delimited") {
    const delimiter = sheet.format.delimiter;
    lines.push(...sheet.rows.map((row) => row.cells.map((cell) => escapeDelimitedValue(cell.raw, delimiter)).join(delimiter)));
  } else if (sheet.format.kind === "markdown") {
    const [header, ...rows] = sheet.rows;
    if (header) {
      lines.push(emitMarkdownRow(header), `| ${header.cells.map(() => "---").join(" | ")} |`);
    }
    lines.push(...rows.map(emitMarkdownRow));
  } else if (sheet.format.kind === "json") {
    const header = sheet.rows.find((row) => row.kind === "header");
    const rows = sheet.rows.filter((row) => row.kind === "data");
    const names = header?.cells.map((cell, index) => cell.raw || `Column${index + 1}`) ?? [];
    const records = rows.map((row) => Object.fromEntries(names.map((name, index) => [name, row.cells[index]?.raw ?? ""])));
    lines.push(JSON.stringify(records, null, 2));
  }
  return lines.join("\n");
}

function emitSheetFormatToken(sheet: EditorSheet): string {
  if (sheet.format.kind === "cello") {
    return "";
  }
  if (sheet.format.kind === "markdown") {
    return "[markdown]";
  }
  if (sheet.format.kind === "json") {
    return `[json${sheet.format.path ? `:${sheet.format.path}` : ""}]`;
  }
  const format = sheet.format.alias ?? (sheet.format.delimiter === "\t" ? "\\t" : sheet.format.delimiter);
  return `[${format}${sheet.format.noHeader ? ":noheader" : ""}]`;
}

function escapeDelimitedValue(value: string, delimiter: string): string {
  return value.includes(delimiter) || /["\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function emitMarkdownRow(row: EditorRow): string {
  return `| ${row.cells.map((cell) => cell.raw.replaceAll("|", "\\|")).join(" | ")} |`;
}

export function emitEditorSheetName(name: string): string {
  return sanitizeSheetName(name);
}

export function emitEditorRow(row: EditorRow): string {
  const cells = row.cells.map(emitEditorCell).join(" | ");
  if (row.kind === "header") {
    return `@header | ${cells} |`;
  }
  const rowPrefix = row.modifiers.length > 0 ? `${row.modifiers.map((modifier) => `[${modifier.raw}]`).join("")} ` : "";
  return `${rowPrefix}| ${cells} |`;
}

export function emitEditorCellsAsRow(cells: EditorCell[], sourceKind: "row" | "header" | "defaults"): string {
  const emitted = cells.map(emitEditorCell).join(" | ");
  if (sourceKind === "header") {
    return `@header | ${emitted} |`;
  }
  if (sourceKind === "defaults") {
    return `@defaults | ${emitted} |`;
  }
  return `| ${emitted} |`;
}

export function emitEditorCell(cell: EditorCell): string {
  if (isMergeToken(cell.raw)) {
    return cell.raw;
  }
  return `${sanitizeCellRaw(cell.raw)}${cell.modifiers.map((modifier) => `[${modifier.raw}]`).join("")}`;
}

export function emitEditorDefaultsRow(sheet: EditorSheet): string | undefined {
  const defaults = trimTrailingEmptyDefaults(sheet.defaults);
  if (defaults.length === 0) {
    return undefined;
  }
  return emitEditorCellsAsRow(defaults, "defaults");
}

function trimTrailingEmptyDefaults(cells: EditorCell[]): EditorCell[] {
  let end = cells.length;
  while (end > 0) {
    const cell = cells[end - 1];
    if (!cell || cell.raw.trim() !== "" || cell.modifiers.length > 0) {
      break;
    }
    end -= 1;
  }
  return cells.slice(0, end);
}

function sanitizeCellRaw(value: string): string {
  return value.replaceAll("|", " ");
}

function sanitizeSheetName(value: string): string {
  return value.replaceAll("[", "").replaceAll("]", "").trim() || DEFAULT_SHEET_NAME;
}
