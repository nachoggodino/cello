import { sheetLayoutToToken, stringifyModifiers } from "../../core/src/index.js";
import type { EditorCell, EditorRow, EditorWorkbook } from "./model.js";
import { DEFAULT_SHEET_NAME } from "./options.js";
import { isMergeToken } from "./source.js";

export function serializeEditorWorkbook(workbook: EditorWorkbook): string {
  const aliasLines = (workbook.aliases ?? []).map((alias) => `@${alias.namespace} ${alias.name} ${stringifyModifiers(alias.modifiers)}`);
  const sheetText = workbook.sheets
    .map((sheet) => {
      const normalizedRows = trimTrailingEmptyRows(sheet.rows).map(trimTrailingEmptyCells);
      const lines = [serializeEditorSheetDeclaration(sheet)];

      for (const row of normalizedRows) {
        lines.push(serializeEditorRow(row));
        if (row.kind === "header") {
          const defaults = serializeEditorDefaultsRow(sheet);
          if (defaults) {
            lines.push(defaults);
          }
        }
      }

      if (!normalizedRows.some((row) => row.kind === "header")) {
        const defaults = serializeEditorDefaultsRow(sheet);
        if (defaults) {
          lines.push(defaults);
        }
      }

      return lines.join("\n");
    })
    .join("\n\n");
  return aliasLines.length > 0 ? `${aliasLines.join("\n")}\n\n${sheetText}` : sheetText;
}

function trimTrailingEmptyRows(rows: EditorRow[]): EditorRow[] {
  let end = rows.length;
  while (end > 0 && isEmptyRow(rows[end - 1])) {
    end -= 1;
  }
  return rows.slice(0, end);
}

function trimTrailingEmptyCells(row: EditorRow): EditorRow {
  let end = row.cells.length;
  while (end > 0 && isEmptyCell(row.cells[end - 1])) {
    end -= 1;
  }
  return {
    ...row,
    cells: row.cells.slice(0, end)
  };
}

function isEmptyRow(row: EditorRow | undefined): boolean {
  return Boolean(row) && row?.kind === "data" && row.modifiers.length === 0 && row.cells.every(isEmptyCell);
}

function isEmptyCell(cell: EditorCell | undefined): boolean {
  return Boolean(cell) && cell?.raw.trim() === "" && cell.modifiers.length === 0;
}

export function serializeEditorSheetDeclaration(sheet: EditorWorkbook["sheets"][number]): string {
  const layoutToken = sheetLayoutToToken(sheet.layout);
  return `@sheet ${sanitizeSheetName(sheet.name)}${layoutToken ? ` ${layoutToken}` : ""}`;
}

export function serializeEditorRow(row: EditorRow): string {
  const cells = row.cells.map(serializeEditorCell).join(" | ");
  if (row.kind === "header") {
    return `@header | ${cells} |`;
  }
  const rowPrefix = row.modifiers.length > 0 ? `${row.modifiers.map((modifier) => `[${modifier.raw}]`).join("")} ` : "";
  return `${rowPrefix}| ${cells} |`;
}

export function serializeEditorCellsAsRow(cells: EditorCell[], sourceKind: "row" | "header" | "defaults"): string {
  const serialized = cells.map(serializeEditorCell).join(" | ");
  if (sourceKind === "header") {
    return `@header | ${serialized} |`;
  }
  if (sourceKind === "defaults") {
    return `@defaults | ${serialized} |`;
  }
  return `| ${serialized} |`;
}

export function serializeEditorCell(cell: EditorCell): string {
  if (isMergeToken(cell.raw)) {
    return cell.raw;
  }
  return `${sanitizeCellRaw(cell.raw)}${cell.modifiers.map((modifier) => `[${modifier.raw}]`).join("")}`;
}

export function serializeEditorDefaultsRow(sheet: EditorWorkbook["sheets"][number]): string | undefined {
  const defaults = trimTrailingEmptyCells({ kind: "data", modifiers: [], cells: sheet.defaults ?? [] }).cells;
  if (defaults.length === 0) {
    return undefined;
  }
  return serializeEditorCellsAsRow(defaults, "defaults");
}

function sanitizeCellRaw(value: string): string {
  return value.replaceAll("|", " ");
}

function sanitizeSheetName(value: string): string {
  return value.replaceAll("[", "").replaceAll("]", "").trim() || DEFAULT_SHEET_NAME;
}
