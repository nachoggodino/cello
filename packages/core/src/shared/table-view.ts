import type { InferredType, SheetNode, SheetView, ViewColumnRule, ViewSortDirection } from "./types.js";

export interface TableViewCellValue {
  display: string;
  type: InferredType;
  value: string | number | boolean | null;
}

export interface TableViewRow {
  rowIndex: number;
  header: boolean;
  cells: TableViewCellValue[];
}

export interface TableViewProjection {
  visibleRowIndices: number[];
  hiddenRowCount: number;
}

export interface ParsedViewFilter {
  kind: "contains" | "wildcard" | "compare" | "exact" | "blank" | "not-blank";
  source: string;
  operator?: ">" | ">=" | "<" | "<=";
  operand?: number | string;
}

interface ActiveViewFilter {
  colIndex: number;
  filter: ParsedViewFilter;
}

const viewCollator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

export function parseViewFilter(source: string): ParsedViewFilter | undefined {
  const query = source.trim();
  if (!query) return undefined;
  const lower = normalizeViewText(query);
  if (lower === "is:blank") return { kind: "blank", source: query };
  if (lower === "is:notblank") return { kind: "not-blank", source: query };
  const comparison = query.match(/^(>=|<=|>|<)\s*(.*)$/);
  if (comparison) {
    const sourceOperand = comparison[2]?.trim() ?? "";
    const operand = Number(sourceOperand);
    if (!sourceOperand || !Number.isFinite(operand)) return undefined;
    return { kind: "compare", source: query, operator: comparison[1] as ">" | ">=" | "<" | "<=", operand };
  }
  if (query.startsWith("=")) return { kind: "exact", source: query, operand: query.slice(1).trim() };
  return { kind: query.includes("*") ? "wildcard" : "contains", source: query, operand: query };
}

export function matchesViewFilter(cell: TableViewCellValue, source: string): boolean {
  const filter = parseViewFilter(source);
  if (!filter) return source.trim().length === 0;
  return matchesParsedViewFilter(cell, filter);
}

function matchesParsedViewFilter(cell: TableViewCellValue, filter: ParsedViewFilter): boolean {
  const display = cell.display.trim();
  if (filter.kind === "blank") return display.length === 0 || cell.value === null;
  if (filter.kind === "not-blank") return display.length > 0 && cell.value !== null;
  if (filter.kind === "compare") {
    if (cell.type !== "number" || typeof cell.value !== "number") return false;
    const value = cell.value;
    const operand = filter.operand as number;
    if (!Number.isFinite(value)) return false;
    if (filter.operator === ">") return value > operand;
    if (filter.operator === ">=") return value >= operand;
    if (filter.operator === "<") return value < operand;
    return value <= operand;
  }
  const normalized = normalizeViewText(display);
  const operand = normalizeViewText(String(filter.operand ?? ""));
  if (filter.kind === "exact") return normalized === operand;
  if (filter.kind === "contains") return normalized.includes(operand);
  const pattern = operand.split("*").map(escapeRegExp).join(".*");
  return new RegExp(`^${pattern}$`, "u").test(normalized);
}

export function projectTableView(rows: readonly TableViewRow[], rules: readonly ViewColumnRule[]): TableViewProjection {
  const activeFilters = rules.flatMap((rule, colIndex): ActiveViewFilter[] => {
    if (!rule.filter) return [];
    const filter = parseViewFilter(rule.filter);
    return filter ? [{ colIndex, filter }] : [];
  });
  const sort = rules.flatMap((rule, colIndex) => rule.sort ? [{ colIndex, direction: rule.sort }] : [])[0];
  const visible: number[] = [];
  let hiddenRowCount = 0;
  for (const section of splitSections(rows)) {
    if (section.header) visible.push(section.header.rowIndex);
    const matching = section.data.filter((row) => activeFilters.every(({ colIndex, filter }) =>
      matchesParsedViewFilter(row.cells[colIndex] ?? emptyCell, filter)));
    hiddenRowCount += section.data.length - matching.length;
    if (sort) matching.sort((left, right) => compareRows(left, right, sort.colIndex, sort.direction));
    visible.push(...matching.map((row) => row.rowIndex));
  }
  return { visibleRowIndices: visible, hiddenRowCount };
}

export function hasVerticalMerges(sheet: Pick<SheetNode, "rows">): boolean {
  return sheet.rows.some((row) => row.cells.some((cell) => cell.kind === "merge-up" || cell.rowspan > 1));
}

export function findDefaultView(views: readonly SheetView[]): SheetView | undefined {
  return views.find((view) => view.default);
}

/** Returns the source-canonical rules without semantically empty trailing columns. */
export function canonicalizeViewColumns(rules: readonly ViewColumnRule[]): ViewColumnRule[] {
  let end = rules.length;
  while (end > 0 && !rules[end - 1]?.filter && !rules[end - 1]?.sort) end -= 1;
  return rules.slice(0, end).map((rule) => ({ ...rule }));
}

const emptyCell: TableViewCellValue = { display: "", type: "empty", value: null };

function splitSections(rows: readonly TableViewRow[]): Array<{ header?: TableViewRow; data: TableViewRow[] }> {
  const sections: Array<{ header?: TableViewRow; data: TableViewRow[] }> = [];
  let current: { header?: TableViewRow; data: TableViewRow[] } = { data: [] };
  for (const row of rows) {
    if (row.header) {
      if (current.header || current.data.length > 0) sections.push(current);
      current = { header: row, data: [] };
    } else {
      current.data.push(row);
    }
  }
  if (current.header || current.data.length > 0) sections.push(current);
  return sections;
}

function compareRows(left: TableViewRow, right: TableViewRow, colIndex: number, direction: ViewSortDirection): number {
  const a = left.cells[colIndex] ?? emptyCell;
  const b = right.cells[colIndex] ?? emptyCell;
  const aBlank = a.value === null || a.display.trim() === "";
  const bBlank = b.value === null || b.display.trim() === "";
  if (aBlank !== bBlank) return aBlank ? 1 : -1;
  const compared = compareValues(a, b);
  return (direction === "asc" ? compared : -compared) || left.rowIndex - right.rowIndex;
}

function compareValues(left: TableViewCellValue, right: TableViewCellValue): number {
  if (typeof left.value === "number" && typeof right.value === "number") return left.value - right.value;
  if (typeof left.value === "boolean" && typeof right.value === "boolean") return Number(left.value) - Number(right.value);
  return viewCollator.compare(left.display, right.display);
}

function normalizeViewText(value: string): string {
  return value.toLowerCase();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
