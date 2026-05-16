import { evaluate } from "../evaluator/evaluate.js";
import { parse } from "../parser/parse.js";
import type { CellNode, Modifier, RenderOptions, RowNode, SheetNode, WorkbookAst } from "../shared/types.js";
import { columnLetter, escapeHtml, workbookHasFormulas } from "../shared/utils.js";

export async function render(input: string | WorkbookAst, options: RenderOptions = {}): Promise<string> {
  const parseOptions = {
    ...(options.strict === undefined ? {} : { strict: options.strict }),
    ...(options.baseDir === undefined ? {} : { baseDir: options.baseDir })
  };
  const parsed = typeof input === "string" ? parse(input, parseOptions) : input;
  const shouldEvaluate = options.evaluate !== false && workbookHasFormulas(parsed);
  const evaluated = shouldEvaluate ? await evaluate(parsed, parseOptions) : parsed;

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
    th[colspan], th[rowspan], td[colspan], td[rowspan] { text-align: center; vertical-align: middle; }
    th { background: #f3f4f6; font-weight: 600; }
    .cello-corner-index, .cello-column-index, .cello-row-index { background: #f9fafb; color: #6b7280; font-size: 0.75rem; font-weight: 600; text-align: center; }
    .cello-corner-index, .cello-row-index { min-width: 36px; }
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
    const activeSheetStorageKey = "cello:active-sheet:" + window.location.pathname;
    function activateSheet(id) {
      const nextTab = tabs.find((tab) => tab.getAttribute("data-sheet") === id) ?? tabs[0];
      if (!nextTab) {
        return;
      }
      const nextId = nextTab.getAttribute("data-sheet");
      tabs.forEach((tab) => tab.classList.toggle("active", tab === nextTab));
      sheets.forEach((sheet) => sheet.classList.toggle("active", sheet.getAttribute("data-sheet") === nextId));
      window.localStorage.setItem(activeSheetStorageKey, nextId);
    }
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        activateSheet(tab.getAttribute("data-sheet"));
      });
    });
    activateSheet(window.localStorage.getItem(activeSheetStorageKey));
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
  return workbook.sheets
    .map(
      (sheet, idx) =>
        `<section class="cello-sheet ${idx === 0 ? "active" : ""}" data-sheet="${idx}"><table>${renderColumnIndexRow(sheet)}<tbody>${sheet.rows
          .map((row) => renderRow(row, sheet))
          .join("")}</tbody></table></section>`
    )
    .join("");
}

function renderColumnIndexRow(sheet: SheetNode): string {
  const columns = Array.from({ length: getSheetColumnCount(sheet) }, (_, idx) => `<th class="cello-column-index">${columnLetter(idx + 1)}</th>`).join("");
  return `<thead><tr><th class="cello-corner-index"></th>${columns}</tr></thead>`;
}

function renderRow(row: RowNode, sheet: SheetNode): string {
  const header = row.kind === "header";
  const cells = row.cells.filter(isRenderableCell).map((cell) => renderCell(cell, header, collectModifiers(cell, row, sheet))).join("");
  return `<tr><th class="cello-row-index" scope="row">${row.index}</th>${cells}</tr>`;
}

function renderCell(cell: CellNode, header: boolean, modifiers: Modifier[]): string {
  const tag = header ? "th" : "td";
  const formatted = formatInline(String(renderCellValue(cell)));
  const attrs = buildCellAttributes(cell, modifiers);

  return `<${tag} ${attrs}>${formatted}</${tag}>`;
}

function renderCellValue(cell: CellNode): string | number | boolean | null {
  if (cell.computed !== undefined) {
    return cell.computed;
  }
  if (cell.kind === "formula" && cell.formula) {
    return cell.formula;
  }
  return cell.value;
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
  const style = modifiers.map(toStyleRule).filter(Boolean).join(";");

  return style ? `style="${style}"` : "";
}

function isRenderableCell(cell: CellNode): boolean {
  return cell.kind !== "merge-left" && cell.kind !== "merge-up";
}

function getSheetColumnCount(sheet: SheetNode): number {
  const maxRenderedColumn = Math.max(
    0,
    ...sheet.rows.flatMap((row) =>
      row.cells
        .filter(isRenderableCell)
        .map((cell) => cell.col + Math.max(cell.colspan, 1) - 1)
    )
  );
  return Math.max(sheet.columns.length, maxRenderedColumn);
}

function toStyleRule(mod: Modifier): string {
  if (mod.key === "bold") {
    return "font-weight:700";
  }
  if (mod.key === "italic") {
    return "font-style:italic";
  }
  if (mod.key === "bg" && mod.value) {
    return `background:${mod.value}`;
  }
  if (mod.key === "bgfg" && mod.value) {
    const [background = "", foreground = ""] = mod.value.split(":");
    return [background ? `background:${background}` : "", foreground ? `color:${foreground}` : ""].filter(Boolean).join(";");
  }
  if (mod.key.startsWith("#")) {
    return `color:${mod.key}`;
  }
  if (mod.key === "color" && mod.value) {
    return `color:${mod.value}`;
  }
  return "";
}
