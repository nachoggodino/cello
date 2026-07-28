import type { AliasDeclaration, Modifier, SheetNode, WorkbookAst } from "./types.js";

export type WidthUnit = "ch" | "px";
export type HeightUnit = "lines" | "px" | "auto";
export type RowDisplayMode = "ellipsis" | "wrap";
export type WidthPresetName = "xshort" | "short" | "normal" | "large" | "xlarge";

export interface ResolvedWidth {
  kind: "fixed" | "fit";
  value?: number;
  unit?: WidthUnit;
}

export interface ResolvedHeight {
  kind: HeightUnit;
  value?: number;
}

export interface ResolvedRowLayout {
  mode: RowDisplayMode;
  height: ResolvedHeight;
}

export const WIDTH_PRESET_NAMES: WidthPresetName[] = ["xshort", "short", "normal", "large", "xlarge"];
export const ROW_HEIGHT_PRESETS = ["1", "2", "3", "5"] as const;
export const SHEET_LAYOUT_DEFAULT_SENTINEL = "default";
export const SHEET_COLUMNS_MODES = ["normal", "fit"] as const;
export const SHEET_ROWS_MODES = ["ellipsis", "wrap"] as const;
export const COLUMN_LAYOUT_KEYS = ["fit", "width"] as const;
export const ROW_LAYOUT_KEYS = ["wrap", "ellipsis", "height"] as const;

export const WIDTH_PRESETS: Record<WidthPresetName, ResolvedWidth> = {
  xshort: { kind: "fixed", value: 3, unit: "ch" },
  short: { kind: "fixed", value: 6, unit: "ch" },
  normal: { kind: "fixed", value: 12, unit: "ch" },
  large: { kind: "fixed", value: 36, unit: "ch" },
  xlarge: { kind: "fixed", value: 60, unit: "ch" }
};

export const DEFAULT_COLUMN_WIDTH: ResolvedWidth = { kind: "fixed", value: 12, unit: "ch" };
export const FIT_COLUMN_MIN_WIDTH = WIDTH_PRESETS.xshort;
export const FIT_COLUMN_MAX_WIDTH = WIDTH_PRESETS.xlarge;
export const DEFAULT_ROW_LAYOUT: ResolvedRowLayout = { mode: "ellipsis", height: { kind: "lines", value: 1 } };

export function resolveColumnWidth(workbook: WorkbookAst | { aliases?: AliasDeclaration[] }, sheet: SheetNode, columnIndex: number): ResolvedWidth {
  const columnModifiers = sheet.columns[columnIndex]?.modifiers ?? [];
  const explicitFit = findLastModifier(columnModifiers, "fit");
  const explicitWidth = findLastModifier(columnModifiers, "width");
  if (explicitFit) {
    return { kind: "fit" };
  }
  if (explicitWidth?.value) {
    return parseWidthValue(resolveAliasValue(workbook.aliases ?? [], "width", explicitWidth.value) ?? explicitWidth.value);
  }
  if (sheet.layout.columns === "fit") {
    return { kind: "fit" };
  }
  return DEFAULT_COLUMN_WIDTH;
}

export function resolveRowLayout(workbook: WorkbookAst | { aliases?: AliasDeclaration[] }, sheet: SheetNode, rowModifiers: Modifier[]): ResolvedRowLayout {
  let mode: RowDisplayMode = sheet.layout.rows ?? DEFAULT_ROW_LAYOUT.mode;
  let explicitHeight: ResolvedHeight | undefined;

  for (const modifier of rowModifiers) {
    if (modifier.key === "wrap") {
      mode = "wrap";
    }
    if (modifier.key === "ellipsis") {
      mode = "ellipsis";
    }
    if (modifier.key === "height" && modifier.value) {
      explicitHeight = parseHeightValue(resolveAliasValue(workbook.aliases ?? [], "height", modifier.value) ?? modifier.value);
    }
  }

  if (explicitHeight) {
    return { mode, height: explicitHeight };
  }
  if (mode === "wrap") {
    return { mode, height: { kind: "auto" } };
  }
  return DEFAULT_ROW_LAYOUT;
}

export function expandAliasModifiers(aliases: AliasDeclaration[] | undefined, modifier: Modifier): Modifier[] {
  if (modifier.key !== "tone" || !modifier.value) {
    return [modifier];
  }
  const alias = aliases?.find((candidate) => candidate.namespace === "tone" && candidate.name === modifier.value);
  return alias ? alias.modifiers : [modifier];
}

export function parseWidthValue(raw: string): ResolvedWidth {
  const value = raw.trim().toLowerCase();
  if (value === "fit") {
    return { kind: "fit" };
  }
  if (isWidthPresetName(value)) {
    return WIDTH_PRESETS[value];
  }
  const unitMatch = value.match(/^(\d+(?:\.\d+)?)(ch|px)$/);
  if (unitMatch) {
    return { kind: "fixed", value: Number(unitMatch[1]), unit: unitMatch[2] as WidthUnit };
  }
  if (/^\d+(?:\.\d+)?$/.test(value)) {
    return { kind: "fixed", value: Number(value), unit: "ch" };
  }
  return DEFAULT_COLUMN_WIDTH;
}

export function parseHeightValue(raw: string): ResolvedHeight {
  const value = raw.trim().toLowerCase();
  if (value === "auto") {
    return { kind: "auto" };
  }
  const pxMatch = value.match(/^(\d+(?:\.\d+)?)px$/);
  if (pxMatch) {
    return { kind: "px", value: Number(pxMatch[1]) };
  }
  if (/^\d+(?:\.\d+)?$/.test(value)) {
    return { kind: "lines", value: Number(value) };
  }
  return { kind: "lines", value: 1 };
}

function findLastModifier(modifiers: Modifier[], key: string): Modifier | undefined {
  for (let index = modifiers.length - 1; index >= 0; index -= 1) {
    if (modifiers[index]?.key === key) {
      return modifiers[index];
    }
  }
  return undefined;
}

function resolveAliasValue(aliases: AliasDeclaration[], namespace: "width" | "height", name: string): string | undefined {
  const alias = aliases.find((candidate) => candidate.namespace === namespace && candidate.name === name);
  return alias?.modifiers.find((modifier) => modifier.key === namespace)?.value;
}

export function isSheetColumnsMode(value: string | undefined): value is "normal" | "fit" {
  return Boolean(value && (SHEET_COLUMNS_MODES as readonly string[]).includes(value));
}

export function isSheetRowsMode(value: string | undefined): value is "ellipsis" | "wrap" {
  return Boolean(value && (SHEET_ROWS_MODES as readonly string[]).includes(value));
}

export function isWidthPresetName(value: string): value is WidthPresetName {
  return (WIDTH_PRESET_NAMES as readonly string[]).includes(value);
}

export function isLayoutModifierKey(key: string): boolean {
  return (
    (COLUMN_LAYOUT_KEYS as readonly string[]).includes(key) ||
    (ROW_LAYOUT_KEYS as readonly string[]).includes(key) ||
    key === "columns" ||
    key === "rows"
  );
}
