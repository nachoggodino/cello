import { canonicalizeViewColumns } from "../../core/src/index.js";
import type { AliasDeclaration, Modifier, SheetFormat, SheetLayout, SheetView } from "../../core/src/index.js";
import type { EditorCell, EditorRow, EditorSheet, EditorWorkbook } from "./model.js";

export function sheetsEqual(left: EditorSheet[], right: EditorSheet[]): boolean {
  return left.length === right.length && left.every((sheet, index) => sheetEqual(sheet, right[index]));
}

export function persistedWorkbooksEqual(left: EditorWorkbook, right: EditorWorkbook): boolean {
  return (
    aliasesEqual(left.aliases ?? [], right.aliases ?? []) &&
    left.sheets.length === right.sheets.length &&
    left.sheets.every((sheet, index) => persistedSheetEqual(sheet, right.sheets[index]))
  );
}

function persistedSheetEqual(left: EditorSheet, right: EditorSheet | undefined): boolean {
  return Boolean(
    right &&
    left.name === right.name &&
    sheetFormatsEqual(left.format, right.format) &&
    sheetLayoutsEqual(left.layout, right.layout) &&
    viewsEqual(left.views, right.views) &&
    persistedRowsEqual(left.rows, right.rows) &&
    persistedCellsEqual(trimTrailingBlankCells(left.defaults), trimTrailingBlankCells(right.defaults))
  );
}

function persistedRowsEqual(left: EditorRow[], right: EditorRow[]): boolean {
  return left.length === right.length && left.every((row, index) => {
    const candidate = right[index];
    return Boolean(
      candidate &&
      row.kind === candidate.kind &&
      modifiersEqual(row.modifiers, candidate.modifiers) &&
      persistedCellsEqual(row.cells, candidate.cells)
    );
  });
}

function persistedCellsEqual(left: EditorCell[], right: EditorCell[]): boolean {
  return left.length === right.length && left.every((cell, index) => {
    const candidate = right[index];
    return Boolean(
      candidate &&
      cell.raw.trim() === candidate.raw.trim() &&
      modifiersEqual(cell.modifiers, candidate.modifiers)
    );
  });
}

function trimTrailingBlankCells(cells: EditorCell[]): EditorCell[] {
  let end = cells.length;
  while (end > 0) {
    const cell = cells[end - 1];
    if (!cell || cell.raw.trim().length > 0 || cell.modifiers.length > 0) {
      break;
    }
    end -= 1;
  }
  return cells.slice(0, end);
}

export function sheetEqual(left: EditorSheet | undefined, right: EditorSheet | undefined): boolean {
  return Boolean(
    left && right &&
    left.name === right.name &&
    sheetFormatsEqual(left.format, right.format) &&
    sheetLayoutsEqual(left.layout, right.layout) &&
    viewsEqual(left.views, right.views) &&
    rowsEqual(left.rows, right.rows) &&
    cellsEqual(left.defaults, right.defaults)
  );
}

export function viewsEqual(left: readonly SheetView[], right: readonly SheetView[]): boolean {
  return left.length === right.length && left.every((view, index) => {
    const candidate = right[index];
    const columns = canonicalizeViewColumns(view.columns);
    const candidateColumns = canonicalizeViewColumns(candidate?.columns ?? []);
    return Boolean(candidate && view.name === candidate.name && view.default === candidate.default &&
      columns.length === candidateColumns.length && columns.every((rule, colIndex) =>
        rule.filter === candidateColumns[colIndex]?.filter && rule.sort === candidateColumns[colIndex]?.sort));
  });
}

export function rowsEqual(left: EditorRow[], right: EditorRow[]): boolean {
  return left.length === right.length && left.every((row, index) => rowEqual(row, right[index]));
}

export function rowEqual(left: EditorRow | undefined, right: EditorRow | undefined): boolean {
  return Boolean(
    left && right &&
    left.kind === right.kind &&
    modifiersEqual(left.modifiers, right.modifiers) &&
    cellsEqual(left.cells, right.cells)
  );
}

export function cellsEqual(left: EditorCell[], right: EditorCell[]): boolean {
  return left.length === right.length && left.every((cell, index) => cellEqual(cell, right[index]));
}

export function cellEqual(left: EditorCell | undefined, right: EditorCell | undefined): boolean {
  return Boolean(left && right && left.raw === right.raw && modifiersEqual(left.modifiers, right.modifiers));
}

export function modifiersEqual(left: Modifier[], right: Modifier[]): boolean {
  return left.length === right.length && left.every((modifier, index) => {
    const candidate = right[index];
    return Boolean(
      candidate &&
      modifier.raw === candidate.raw &&
      modifier.key === candidate.key &&
      modifier.value === candidate.value
    );
  });
}

export function aliasesEqual(left: AliasDeclaration[], right: AliasDeclaration[]): boolean {
  return left.length === right.length && left.every((alias, index) => {
    const candidate = right[index];
    return Boolean(
      candidate &&
      alias.namespace === candidate.namespace &&
      alias.name === candidate.name &&
      modifiersEqual(alias.modifiers, candidate.modifiers)
    );
  });
}

export function sheetLayoutsEqual(left: SheetLayout | undefined, right: SheetLayout | undefined): boolean {
  return left?.columns === right?.columns && left?.rows === right?.rows;
}

function sheetFormatsEqual(left: SheetFormat, right: SheetFormat): boolean {
  if (left.kind !== right.kind) {
    return false;
  }
  if (left.kind === "delimited" && right.kind === "delimited") {
    return left.delimiter === right.delimiter && left.noHeader === right.noHeader && left.alias === right.alias;
  }
  if (left.kind === "json" && right.kind === "json") {
    return left.path === right.path;
  }
  return true;
}
