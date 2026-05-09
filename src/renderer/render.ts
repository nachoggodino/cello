import { evaluate } from "../evaluator/evaluate.js";
import { parse } from "../parser/parse.js";
import type { CellNode, Modifier, RenderOptions, RowNode, SheetNode, WorkbookAst } from "../shared/types.js";
import { escapeHtml } from "../shared/utils.js";

export async function render(input: string | WorkbookAst, options: RenderOptions = {}): Promise<string> {
  const strictOptions = options.strict === undefined ? {} : { strict: options.strict };
  const parsed = typeof input === "string" ? parse(input, strictOptions) : input;
  const evaluated = await evaluate(parsed, strictOptions);

  return renderDocument(options.title ?? "Cello Workbook", renderTabs(evaluated), renderSheets(evaluated));
}

function renderDocument(title: string, tabs: string, sheetsHtml: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    .cello-workbook { font-family: Inter, Segoe UI, Arial, sans-serif; color: #111827; }
    .cello-tabs { display: flex; gap: 8px; overflow-x: auto; margin-bottom: 12px; }
    .cello-tab { border: 1px solid #d1d5db; background: #ffffff; padding: 6px 10px; border-radius: 6px; cursor: pointer; }
    .cello-tab.active { background: #111827; color: #ffffff; border-color: #111827; }
    .cello-sheet { display: none; }
    .cello-sheet.active { display: block; }
    table { border-collapse: collapse; width: max-content; max-width: none; }
    th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; vertical-align: top; white-space: nowrap; }
    th { background: #f3f4f6; font-weight: 600; }
    .cello-bold { font-weight: 700; }
    .cello-italic { font-style: italic; }
    .cello-h1 { font-size: 1.25rem; font-weight: 700; }
    .cello-h2 { font-size: 1.1rem; font-weight: 700; }
  </style>
</head>
<body>
  <div class="cello-workbook">
    <div class="cello-tabs">${tabs}</div>
    ${sheetsHtml}
  </div>
  <script>
    const tabs = Array.from(document.querySelectorAll(".cello-tab"));
    const sheets = Array.from(document.querySelectorAll(".cello-sheet"));
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const id = tab.getAttribute("data-sheet");
        tabs.forEach((t) => t.classList.toggle("active", t === tab));
        sheets.forEach((s) => s.classList.toggle("active", s.getAttribute("data-sheet") === id));
      });
    });
  </script>
</body>
</html>`;
}

function renderTabs(workbook: WorkbookAst): string {
  return workbook.sheets
    .map((sheet, idx) => `<button class="cello-tab ${idx === 0 ? "active" : ""}" data-sheet="${idx}">${escapeHtml(sheet.name)}</button>`)
    .join("");
}

function renderSheets(workbook: WorkbookAst): string {
  return workbook.sheets.map((sheet, idx) => renderSheet(sheet, idx)).join("");
}

function renderSheet(sheet: SheetNode, idx: number): string {
  return `<section class="cello-sheet ${idx === 0 ? "active" : ""}" data-sheet="${idx}"><table><tbody>${renderRows(sheet)}</tbody></table></section>`;
}

function renderRows(sheet: SheetNode): string {
  return sheet.rows.map((row) => renderRow(row, sheet)).join("");
}

function renderRow(row: RowNode, sheet: SheetNode): string {
  const cells = row.cells
    .filter((cell) => cell.kind !== "merge-left" && cell.kind !== "merge-up")
    .map((cell) => renderCell(cell, row.kind === "header", collectModifiers(cell, row, sheet)))
    .join("");
  return `<tr>${cells}</tr>`;
}

function renderCell(cell: CellNode, header: boolean, modifiers: Modifier[]): string {
  const tag = header ? "th" : "td";
  const formatted = formatInline(String(cell.computed ?? cell.value ?? ""));
  const attrs = buildCellAttributes(cell, modifiers);

  return `<${tag} ${attrs}>${formatted}</${tag}>`;
}

function collectModifiers(cell: CellNode, row: RowNode, sheet: SheetNode): Modifier[] {
  const columnModifiers = row.kind === "header" ? [] : (sheet.columns[cell.col - 1]?.modifiers ?? []);
  return [...columnModifiers, ...row.modifiers, ...cell.modifiers];
}

function buildCellAttributes(cell: CellNode, modifiers: Modifier[]): string {
  return [
    cell.colspan > 1 ? `colspan="${cell.colspan}"` : "",
    cell.rowspan > 1 ? `rowspan="${cell.rowspan}"` : "",
    buildStyleAttribute(modifiers)
  ]
    .filter(Boolean)
    .join(" ");
}

function formatInline(raw: string): string {
  if (raw.startsWith("## ")) {
    return `<span class="cello-h1">${escapeHtml(raw.slice(3))}</span>`;
  }
  if (raw.startsWith("# ")) {
    return `<span class="cello-h2">${escapeHtml(raw.slice(2))}</span>`;
  }

  let out = escapeHtml(raw);
  out = out.replace(/\*([^*]+)\*/g, "<span class=\"cello-bold\">$1</span>");
  out = out.replace(/_([^_]+)_/g, "<span class=\"cello-italic\">$1</span>");
  out = out.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  return out;
}

function buildStyleAttribute(modifiers: Modifier[]): string {
  const style = modifiers
    .map((mod) => {
      if (mod.key === "bold") {
        return "font-weight:700";
      }
      if (mod.key === "italic") {
        return "font-style:italic";
      }
      if (mod.key === "bg" && mod.value) {
        return `background:${mod.value}`;
      }
      if (mod.key.startsWith("#")) {
        return `color:${mod.key}`;
      }
      if (mod.key === "color" && mod.value) {
        return `color:${mod.value}`;
      }
      return "";
    })
    .filter(Boolean)
    .join(";");

  return style ? `style="${style}"` : "";
}
