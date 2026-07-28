import type { SheetLayout } from "./types.js";

export function stringifyModifiers(modifiers: Array<{ raw: string }>): string {
  return modifiers.map((modifier) => `[${modifier.raw}]`).join("");
}

export function sheetLayoutToModifiers(layout: SheetLayout | undefined): Array<{ raw: string }> {
  return [
    layout?.columns ? { raw: `columns:${layout.columns}` } : undefined,
    layout?.rows ? { raw: `rows:${layout.rows}` } : undefined
  ].filter((modifier): modifier is { raw: string } => Boolean(modifier));
}

export function sheetLayoutToToken(layout: SheetLayout | undefined): string {
  return stringifyModifiers(sheetLayoutToModifiers(layout));
}
