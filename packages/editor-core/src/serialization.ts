import { sheetLayoutToToken, stringifyModifiers } from "../../core/src/index.js";
import type { EditorCell, EditorRow, EditorWorkbook } from "./model.js";
import { DEFAULT_SHEET_NAME } from "./options.js";
import { isMergeToken } from "./source.js";

export function serializeEditorWorkbook(workbook: EditorWorkbook): string {
  const aliasLines = (workbook.aliases ?? []).map((alias) => `@${alias.namespace} ${alias.name} ${stringifyModifiers(alias.modifiers)}`);
  const sheetText = workbook.sheets
    .map((sheet) => {
      const lines = [serializeEditorSheetDeclaration(sheet)];

      for (const row of sheet.rows) {
        lines.push(serializeEditorRow(row));
        if (row.kind === "header") {
          const defaults = serializeEditorDefaultsRow(sheet);
          if (defaults) {
            lines.push(defaults);
          }
        }
      }

      if (!sheet.rows.some((row) => row.kind === "header")) {
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
  const defaults = trimTrailingEmptyDefaults(sheet.defaults ?? []);
  if (defaults.length === 0) {
    return undefined;
  }
  return serializeEditorCellsAsRow(defaults, "defaults");
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
