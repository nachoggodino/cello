import type { EditorCell, EditorRow, EditorWorkbook } from "./model.js";
import { DEFAULT_SHEET_NAME } from "./options.js";
import { isMergeToken } from "./source.js";

export function serializeEditorWorkbook(workbook: EditorWorkbook): string {
  return workbook.sheets
    .map((sheet) => {
      const normalizedRows = trimTrailingEmptyRows(sheet.rows).map(trimTrailingEmptyCells);
      const lines = [`@sheet ${sanitizeSheetName(sheet.name)}`];

      for (const row of normalizedRows) {
        lines.push(serializeRow(row));
        if (row.kind === "header") {
          const defaults = serializeDefaultsRow(sheet);
          if (defaults) {
            lines.push(defaults);
          }
        }
      }

      if (!normalizedRows.some((row) => row.kind === "header")) {
        const defaults = serializeDefaultsRow(sheet);
        if (defaults) {
          lines.push(defaults);
        }
      }

      return lines.join("\n");
    })
    .join("\n\n");
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

function serializeRow(row: EditorRow): string {
  const cells = row.cells.map(serializeCell).join(" | ");
  if (row.kind === "header") {
    return `@header | ${cells} |`;
  }
  const rowPrefix = row.modifiers.length > 0 ? `${row.modifiers.map((modifier) => `[${modifier.raw}]`).join("")} ` : "";
  return `${rowPrefix}| ${cells} |`;
}

function serializeCell(cell: EditorCell): string {
  if (isMergeToken(cell.raw)) {
    return cell.raw;
  }
  return `${sanitizeCellRaw(cell.raw)}${cell.modifiers.map((modifier) => `[${modifier.raw}]`).join("")}`;
}

function serializeDefaultsRow(sheet: EditorWorkbook["sheets"][number]): string | undefined {
  const defaults = trimTrailingEmptyCells({ kind: "data", modifiers: [], cells: sheet.defaults ?? [] }).cells;
  if (defaults.length === 0) {
    return undefined;
  }
  return `@defaults | ${defaults.map(serializeCell).join(" | ")} |`;
}

function sanitizeCellRaw(value: string): string {
  return value.replaceAll("|", " ");
}

function sanitizeSheetName(value: string): string {
  return value.replaceAll("[", "").replaceAll("]", "").trim() || DEFAULT_SHEET_NAME;
}
