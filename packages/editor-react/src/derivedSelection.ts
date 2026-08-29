import {
  getCellAt,
  getCellModifierSourceText
} from "@nachoggodino/cello/editor-core";
import type {
  CellRange,
  EditorSheet
} from "@nachoggodino/cello/editor-core";

export type ModifierScope = "cell" | "row" | "column";

export function getSelectionModifierSources(
  sheet: EditorSheet,
  range: CellRange,
  scope: ModifierScope,
  rowIndices: readonly number[] = Array.from(
    { length: range.endRow - range.startRow + 1 },
    (_, offset) => range.startRow + offset
  )
): string[] {
  if (scope === "row") {
    return rowIndices.map((rowIndex) => formatModifierSource(sheet.rows[rowIndex]?.modifiers ?? []));
  }
  if (scope === "column") {
    const header = sheet.rows.find((row) => row.kind === "header");
    return Array.from(
      { length: range.endCol - range.startCol + 1 },
      (_, offset) =>
        formatModifierSource(
          header?.cells[range.startCol + offset]?.modifiers ?? []
        )
    );
  }
  return rowIndices.flatMap((rowIndex) => Array.from(
    { length: range.endCol - range.startCol + 1 },
    (_, offset) => getCellModifierSourceText(getCellAt(sheet, rowIndex, range.startCol + offset))
  ));
}

export function getCommonValue(values: string[]): string | undefined {
  const first = values[0];
  return first !== undefined && values.every((value) => value === first)
    ? first
    : undefined;
}

function formatModifierSource(modifiers: Array<{ raw: string }>): string {
  return modifiers.map((modifier) => `[${modifier.raw}]`).join("");
}
