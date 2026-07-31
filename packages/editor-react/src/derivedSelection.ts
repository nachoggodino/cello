import { getCellAt, getCellModifierSourceText } from "../../editor-core/src/internal.js";
import type { CellRange, EditorSheet } from "../../editor-core/src/internal.js";
import { getRangeAddresses } from "./selection.js";

export type ModifierScope = "cell" | "row" | "column";

export function getSelectionModifierSources(sheet: EditorSheet, range: CellRange, scope: ModifierScope): string[] {
  if (scope === "row") {
    return Array.from({ length: range.endRow - range.startRow + 1 }, (_, offset) => formatModifierSource(sheet.rows[range.startRow + offset]?.modifiers ?? []));
  }
  if (scope === "column") {
    const header = sheet.rows.find((row) => row.kind === "header");
    return Array.from({ length: range.endCol - range.startCol + 1 }, (_, offset) => formatModifierSource(header?.cells[range.startCol + offset]?.modifiers ?? []));
  }
  return getRangeAddresses(range).map((address) => getCellModifierSourceText(getCellAt(sheet, address.rowIndex, address.colIndex)));
}

export function getCommonValue(values: string[]): string | undefined {
  const first = values[0];
  return first !== undefined && values.every((value) => value === first) ? first : undefined;
}

function formatModifierSource(modifiers: Array<{ raw: string }>): string {
  return modifiers.map((modifier) => `[${modifier.raw}]`).join("");
}
