import type { CellNode, SheetFormat, WorkbookAst } from "../shared/types.js";

export function serialize(ast: WorkbookAst): string {
  const chunks: string[] = [];

  for (const [sheetIndex, sheet] of ast.sheets.entries()) {
    if (sheetIndex > 0) {
      chunks.push("");
    }
    chunks.push(`@sheet ${sheet.name}${formatToToken(sheet.format)}`);

    for (const row of sheet.rows) {
      if (row.kind === "blank") {
        chunks.push("");
        continue;
      }

      if (row.kind === "header") {
        const header = `-${row.cells
          .filter((c) => c.kind !== "merge-left" && c.kind !== "merge-up")
          .map((c) => `${stringifyCellBase(c)}${stringifyModifiers(c.modifiers)}`)
          .join("-")}-`;
        chunks.push(header);
        continue;
      }

      const cells = row.cells.map((cell) => stringifyCell(cell)).join(" | ");
      const rowPrefix = row.name ? `${row.name}${stringifyModifiers(row.modifiers)} ` : "";
      chunks.push(`${rowPrefix}| ${cells} |`);
    }
  }

  return chunks.join("\n");
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
  if (cell.value === null || cell.value === undefined) {
    return "";
  }
  if (typeof cell.value === "string") {
    return cell.value;
  }
  if (typeof cell.value === "number") {
    return String(cell.value);
  }
  if (typeof cell.value === "boolean") {
    return cell.value ? "TRUE" : "FALSE";
  }
  return String(cell.value);
}

function stringifyModifiers(modifiers: Array<{ raw: string }>): string {
  if (modifiers.length === 0) {
    return "";
  }
  return modifiers.map((m) => `[${m.raw}]`).join("");
}

