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

export function parseViewFilter(source: string): ParsedViewFilter | undefined {
  const query = source.trim();
  if (!query) return undefined;
  const lower = query.toLocaleLowerCase();
  if (lower === "is:blank") return { kind: "blank", source: query };
  if (lower === "is:notblank") return { kind: "not-blank", source: query };
  const comparison = query.match(/^(>=|<=|>|<)\s*(.+)$/);
  if (comparison) {
    const operand = Number(comparison[2]);
    if (!Number.isFinite(operand)) return undefined;
    return { kind: "compare", source: query, operator: comparison[1] as ">" | ">=" | "<" | "<=", operand };
  }
  if (query.startsWith("=")) return { kind: "exact", source: query, operand: query.slice(1).trim() };
  return { kind: query.includes("*") ? "wildcard" : "contains", source: query, operand: query };
}

export function matchesViewFilter(cell: TableViewCellValue, source: string): boolean {
  const filter = parseViewFilter(source);
  if (!filter) return source.trim().length === 0;
  const display = cell.display.trim();
  if (filter.kind === "blank") return display.length === 0 || cell.value === null;
  if (filter.kind === "not-blank") return display.length > 0 && cell.value !== null;
  if (filter.kind === "compare") {
    const value = typeof cell.value === "number" ? cell.value : Number(cell.value);
    const operand = filter.operand as number;
    if (!Number.isFinite(value)) return false;
    if (filter.operator === ">") return value > operand;
    if (filter.operator === ">=") return value >= operand;
    if (filter.operator === "<") return value < operand;
    return value <= operand;
  }
  const normalized = display.toLocaleLowerCase();
  const operand = String(filter.operand ?? "").toLocaleLowerCase();
  if (filter.kind === "exact") return normalized === operand;
  if (filter.kind === "contains") return normalized.includes(operand);
  const pattern = operand.split("*").map(escapeRegExp).join(".*");
  return new RegExp(`^${pattern}$`, "iu").test(display);
}

export function projectTableView(rows: readonly TableViewRow[], rules: readonly ViewColumnRule[]): TableViewProjection {
  const activeFilters = rules.flatMap((rule, colIndex) => rule.filter ? [{ colIndex, source: rule.filter }] : []);
  const sort = rules.flatMap((rule, colIndex) => rule.sort ? [{ colIndex, direction: rule.sort }] : [])[0];
  const visible: number[] = [];
  let hiddenRowCount = 0;
  for (const section of splitSections(rows)) {
    if (section.header) visible.push(section.header.rowIndex);
    const matching = section.data.filter((row) => activeFilters.every(({ colIndex, source }) =>
      matchesViewFilter(row.cells[colIndex] ?? emptyCell, source)));
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
  return left.display.localeCompare(right.display, undefined, { numeric: true, sensitivity: "base" });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
