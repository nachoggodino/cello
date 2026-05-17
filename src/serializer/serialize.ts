import type { CellNode, SheetFormat, WorkbookAst } from "../shared/types.js";

export function serialize(ast: WorkbookAst): string {
  const chunks: string[] = [];

  for (const [sheetIndex, sheet] of ast.sheets.entries()) {
    if (sheetIndex > 0) {
      chunks.push("");
    }
    chunks.push(`@sheet ${sheet.name}${formatToToken(sheet.format)}`);

    for (const row of sheet.rows) {
      chunks.push(stringifyRow(row));
    }
  }

  return chunks.join("\n");
}

function stringifyRow(row: WorkbookAst["sheets"][number]["rows"][number]): string {
  if (row.kind === "header") {
    return stringifyHeaderRow(row);
  }
  return stringifyDataRow(row);
}

function stringifyHeaderRow(row: WorkbookAst["sheets"][number]["rows"][number]): string {
  const cells = row.cells
    .filter((c) => c.kind !== "merge-left" && c.kind !== "merge-up")
    .map((c) => `${stringifyCellBase(c)}${stringifyModifiers(c.modifiers)}`)
    .join(" | ");
  return `@header | ${cells} |`;
}

function stringifyDataRow(row: WorkbookAst["sheets"][number]["rows"][number]): string {
  const cells = row.cells.map((cell) => stringifyCell(cell)).join(" | ");
  const rowPrefix = row.modifiers.length > 0 ? `${stringifyModifiers(row.modifiers)} ` : "";
  return `${rowPrefix}| ${cells} |`;
}

function formatToToken(format: SheetFormat): string {
  if (format.kind === "cello") {
    return "";
  }
  if (format.kind === "markdown") {
    return " [markdown]";
  }
  if (format.kind === "json") {
    return format.path ? ` [json:${format.path}]` : " [json]";
  }
  const delimiter = format.alias ? format.alias : format.delimiter === "\t" ? "\\t" : format.delimiter;
  const suffix = format.noHeader ? ":noheader" : "";
  return ` [${delimiter}${suffix}]`;
}

function stringifyCell(cell: CellNode): string {
  if (cell.kind === "merge-left") {
    return "<";
  }
  if (cell.kind === "merge-up") {
    return "^";
  }

  const base = stringifyCellBase(cell);
  return `${base}${stringifyModifiers(cell.modifiers)}`;
}

function stringifyCellBase(cell: CellNode): string {
  if (cell.kind === "formula" && cell.formula) {
    return cell.formula;
  }
  return stringifyScalar(cell.value);
}

function stringifyModifiers(modifiers: Array<{ raw: string }>): string {
  if (modifiers.length === 0) {
    return "";
  }
  return modifiers.map((m) => `[${m.raw}]`).join("");
}

function stringifyScalar(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }
  return String(value);
}

