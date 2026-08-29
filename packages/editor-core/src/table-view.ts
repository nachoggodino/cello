import { projectTableView } from "../../core/src/index.js";
import type { TableViewCellValue, TableViewRow, ViewColumnRule } from "../../core/src/index.js";
import type { ComputedCellValues, EditorCell, EditorSheet, EditorWorkbook } from "./model.js";
import { getCellAddressKey } from "./evaluation.js";
import { getCellFormattedDisplayText, getVisibleColumnCount } from "./selectors.js";

export function projectEditorSheetView(
  sheet: EditorSheet,
  sheetIndex: number,
  rules: readonly ViewColumnRule[],
  computedValues: ComputedCellValues,
  workbook: Pick<EditorWorkbook, "aliases">
) {
  const rows: TableViewRow[] = sheet.rows.map((row, rowIndex) => ({
    rowIndex,
    header: row.kind === "header",
    cells: Array.from({ length: getVisibleColumnCount(sheet) }, (_, colIndex) => {
      const cell = row.cells[colIndex] ?? { raw: "", modifiers: [] };
      const computed = computedValues[getCellAddressKey({ sheetIndex, rowIndex, colIndex })];
      return toTableViewValue(
        cell,
        getCellFormattedDisplayText(sheet, rowIndex, colIndex, computed, workbook),
        computed
      );
    })
  }));
  return projectTableView(rows, rules);
}

export function hasEditorVerticalMerges(sheet: EditorSheet): boolean {
  return sheet.rows.some((row) => row.cells.some((cell) => cell.raw === "^"));
}

function toTableViewValue(
  cell: EditorCell,
  display: string,
  computed: string | number | boolean | null | undefined
): TableViewCellValue {
  if (cell.raw.startsWith("=") && computed !== undefined) return typedValue(display, computed);
  const trimmed = cell.raw.trim();
  if (!trimmed) return { display, type: "empty", value: null };
  if (trimmed === "TRUE" || trimmed === "FALSE") return { display, type: "boolean", value: trimmed === "TRUE" };
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return { display, type: "date", value: trimmed };
  const number = Number(trimmed);
  if (Number.isFinite(number)) return { display, type: "number", value: number };
  return { display, type: "text", value: trimmed.replace(/^"|"$/g, "") };
}

function typedValue(display: string, value: string | number | boolean | null): TableViewCellValue {
  if (value === null) return { display, type: "empty", value };
  if (typeof value === "number") return { display, type: "number", value };
  if (typeof value === "boolean") return { display, type: "boolean", value };
  return { display, type: "text", value };
}
