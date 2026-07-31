import { sheetLayoutToToken } from "../../core/src/index.js";
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
  const layoutToken = sheetLayoutToToken(sheet.layout);
  return `@sheet ${emitEditorSheetName(sheet.name)}${layoutToken ? ` ${layoutToken}` : ""}`;
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
