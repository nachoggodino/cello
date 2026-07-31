import type { CellNode, InferredType, Modifier, RowNode, SheetFormat, SheetNode, WorkbookAst } from "../../packages/core/src/shared/types.js";

type Scalar = string | number | boolean | null;

export function workbook(sheets: SheetNode[]): WorkbookAst {
  return {
    version: "1.0",
    aliases: [],
    diagnostics: [],
    sheets
  };
}

export function sheet(options: { name: string; format?: SheetFormat; columns?: string[] | number; rows: RowNode[] }): SheetNode {
  const { name, format = { kind: "cello" }, columns = 0, rows } = options;
  const columnNames = Array.isArray(columns) ? columns : Array.from({ length: columns }, () => undefined);

  return {
    name,
    format,
    layout: {},
    columns: columnNames.map((columnName, index) => ({
      index: index + 1,
      letter: String.fromCharCode(65 + index),
      ...(columnName ? { name: columnName } : {}),
      modifiers: [],
      hidden: false
    })),
    rows
  };
}

export function dataRow(index: number, cells: CellNode[], options: Partial<Omit<RowNode, "index" | "kind" | "cells">> = {}): RowNode {
  return {
    index,
    kind: "data",
    sourceLine: options.sourceLine ?? index,
    modifiers: options.modifiers ?? [],
    cells
  };
}

export function headerRow(index: number, headers: Array<string | { name: string; modifiers?: Modifier[] }>): RowNode {
  return {
    index,
    kind: "header",
    sourceLine: index,
    modifiers: [],
    cells: headers.map((header, idx) => {
      const name = typeof header === "string" ? header : header.name;
      return valueCell(index, idx + 1, name, {
        modifiers: typeof header === "string" ? [] : (header.modifiers ?? []),
        inferredType: "text"
      });
    })
  };
}

export function valueCell(
  row: number,
  col: number,
  value: Scalar,
  overrides: Partial<Omit<CellNode, "row" | "col" | "raw" | "kind" | "value" | "inferredType" | "modifiers" | "colspan" | "rowspan">> & {
    inferredType?: InferredType;
    modifiers?: Modifier[];
  } = {}
): CellNode {
  const inferredType = overrides.inferredType ?? inferType(value);
  return {
    row,
    col,
    raw: value === null ? "" : String(value),
    kind: inferredType === "empty" ? "empty" : "value",
    inferredType,
    value,
    modifiers: overrides.modifiers ?? [],
    colspan: 1,
    rowspan: 1,
    ...overrides
  };
}

export function formulaCell(row: number, col: number, formula: string): CellNode {
  return {
    row,
    col,
    raw: formula,
    kind: "formula",
    inferredType: "text",
    value: formula,
    formula,
    modifiers: [],
    colspan: 1,
    rowspan: 1
  };
}

function inferType(value: Scalar): InferredType {
  if (value === null) {
    return "empty";
  }
  if (typeof value === "number") {
    return "number";
  }
  if (typeof value === "boolean") {
    return "boolean";
  }
  return "text";
}
