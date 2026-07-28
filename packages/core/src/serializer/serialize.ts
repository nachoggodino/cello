import type { CellNode, Modifier, SheetFormat, SheetNode, WorkbookAst } from "../shared/types.js";
import { sheetLayoutToToken, stringifyModifiers } from "../shared/serialization.js";

export function serialize(ast: WorkbookAst): string {
  const chunks: string[] = [];

  for (const alias of ast.aliases ?? []) {
    chunks.push(`@${alias.namespace} ${alias.name} ${stringifyModifiers(alias.modifiers)}`);
  }

  if ((ast.aliases ?? []).length > 0 && ast.sheets.length > 0) {
    chunks.push("");
  }

  for (const [sheetIndex, sheet] of ast.sheets.entries()) {
    if (sheetIndex > 0) {
      chunks.push("");
    }
    chunks.push(`@sheet ${sheet.name}${formatAndLayoutToToken(sheet)}`);

    for (const row of sheet.rows) {
      chunks.push(stringifyRow(row));
      if (row.kind === "header") {
        const defaultsRow = stringifyDefaultsRow(sheet, row);
        if (defaultsRow) {
          chunks.push(defaultsRow);
        }
      }
    }
  }

  return chunks.join("\n");
}

function formatAndLayoutToToken(sheet: SheetNode): string {
  const formatToken = formatToToken(sheet.format);
  const layoutToken = sheetLayoutToToken(sheet.layout);
  if (!layoutToken) {
    return formatToken;
  }
  return formatToken ? `${formatToken}${layoutToken}` : ` ${layoutToken}`;
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
    .map((c) => `${stringifyCellBase(c)}${stringifyModifiers(c.modifiers.filter((modifier) => modifier.key !== "default"))}`)
    .join(" | ");
  return `@header | ${cells} |`;
}

function stringifyDataRow(row: WorkbookAst["sheets"][number]["rows"][number]): string {
  const cells = row.cells.map((cell) => stringifyCell(cell)).join(" | ");
  const rowPrefix = row.modifiers.length > 0 ? `${stringifyModifiers(row.modifiers)} ` : "";
  return `${rowPrefix}| ${cells} |`;
}

function stringifyDefaultsRow(sheet: SheetNode, row: WorkbookAst["sheets"][number]["rows"][number]): string | undefined {
  const cells = sheet.columns.map((column) => {
    const columnDefault = findDefaultModifier(column.modifiers);
    if (!columnDefault) {
      return "";
    }
    return columnDefault.value ?? "";
  });

  if (!cells.some((cell) => cell.length > 0)) {
    return undefined;
  }

  return `@defaults | ${cells.join(" | ")} |`;
}

function findDefaultModifier(modifiers: Modifier[]): Modifier | undefined {
  return modifiers.find((modifier) => modifier.key === "default");
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
