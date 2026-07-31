import { evaluate } from "../evaluator/evaluate.js";
import { resolveWorkbookIdentity } from "../shared/identity.js";
import { parse } from "../parser/parse.js";
import { CELLO_HEADING_STYLES, CELLO_TONE_COLORS, CELLO_TONE_NAMES, formatDisplayValue } from "../shared/display.js";
import {
  CELL_LAYOUT_METRICS,
  DEFAULT_COLUMN_WIDTH,
  expandAliasModifiers,
  fitCandidateValue,
  isFitCandidateCell,
  resolveColumnWidth,
  resolveRowLayout,
  widthOuterToCss
} from "../shared/layout.js";
import { getModifierStyleRules, getRowLayoutClasses, getRowLayoutStyleRules, getToneClasses } from "../shared/presentation.js";
import type { ResolvedRowLayout, ResolvedWidth } from "../shared/layout.js";
import type { CellNode, Modifier, RenderOptions, RowNode, SheetNode, WorkbookAst } from "../shared/types.js";
import { columnLetter, escapeHtml, workbookHasFormulas } from "../shared/utils.js";

const RENDER_ROW_INDEX_WIDTH_PX = 36;

/** Renders Cello source or a workbook AST as a safe HTML document or fragment. */
export async function render(input: string | WorkbookAst, options: RenderOptions = {}): Promise<string> {
  const parseOptions = {
    ...(options.strict === undefined ? {} : { strict: options.strict }),
    ...(options.baseDir === undefined ? {} : { baseDir: options.baseDir }),
    ...(options.readExternalSource === undefined ? {} : { readExternalSource: options.readExternalSource })
  };
  const parsed = typeof input === "string" ? parse(input, parseOptions) : input;
  const shouldEvaluate = options.evaluate !== false && workbookHasFormulas(parsed);
  const evaluated = shouldEvaluate ? await evaluate(parsed, parseOptions) : parsed;
  const identity = resolveWorkbookIdentity(evaluated);
  if (identity.ambiguous) {
    throw new Error("Cannot render a workbook with ambiguous sheet or alias identities.");
  }
  const workbookHtml = renderWorkbook(renderTabs(evaluated), renderSheets(evaluated));
  const nonce = options.nonce ?? createNonce();

  return options.format === "fragment"
    ? renderFragment(workbookHtml, options.interactive !== false, nonce)
    : renderDocument(options.title ?? "Cello Workbook", workbookHtml, options.interactive !== false, nonce);
}

function renderDocument(title: string, workbookHtml: string, interactive: boolean, nonce: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="referrer" content="no-referrer" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: vscode-webview-resource:; style-src 'unsafe-inline'; script-src 'nonce-${escapeHtml(nonce)}'; connect-src 'none'; font-src 'none'; base-uri 'none'; form-action 'none'" />
  <title>${escapeHtml(title)}</title>
  ${renderStyles()}
</head>
<body>
  ${workbookHtml}
  ${interactive ? renderScript(nonce) : ""}
</body>
</html>`;
}

function renderFragment(workbookHtml: string, interactive: boolean, nonce: string): string {
  return `${renderStyles()}
  ${workbookHtml}
  ${interactive ? renderScript(nonce) : ""}`;
}

function renderStyles(): string {
  return `<style>
    .cello-workbook {
      font-family: Inter, Segoe UI, Arial, sans-serif;
      color: #111827;
      --cello-cell-padding-inline: ${CELL_LAYOUT_METRICS.paddingInlinePx}px;
      --cello-cell-padding-block: ${CELL_LAYOUT_METRICS.paddingBlockPx}px;
      --cello-line-height: ${CELL_LAYOUT_METRICS.lineHeightPx}px;
      ${renderToneVariables()}
    }
    .cello-tabs { display: flex; gap: 8px; overflow-x: auto; margin-bottom: 12px; }
    .cello-tab { border: 1px solid #d1d5db; background: #ffffff; padding: 6px 10px; border-radius: 6px; cursor: pointer; }
    .cello-tab.active { background: #111827; color: #ffffff; border-color: #111827; }
    .cello-sheet { display: none; }
    .cello-sheet.active { display: block; }
    table { border-collapse: collapse; width: max-content; max-width: none; table-layout: auto; }
    th, td { border: 1px solid #e5e7eb; padding: var(--cello-cell-padding-block) var(--cello-cell-padding-inline); text-align: left; vertical-align: middle; white-space: nowrap; box-sizing: border-box; line-height: var(--cello-line-height); }
    .cello-cell-content { display: block; min-width: 0; }
    .cello-ellipsis:not(.cello-line-clamp) .cello-cell-content { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .cello-wrap .cello-cell-content { white-space: normal; overflow-wrap: anywhere; }
    .cello-fixed-height .cello-cell-content { max-height: var(--cello-content-height); overflow: auto; }
    .cello-line-clamp.cello-ellipsis .cello-cell-content { display: -webkit-box; line-height: var(--cello-line-height); -webkit-box-orient: vertical; -webkit-line-clamp: var(--cello-line-clamp); overflow: hidden; }
    .cello-fit-measure-row { visibility: collapse; }
    .cello-fit-measure-row th { height: 0; padding-block: 0; border-block: 0; line-height: 0; }
    .cello-fit-measure-row .cello-cell-content { line-height: var(--cello-line-height); }
    th[colspan], th[rowspan], td[colspan], td[rowspan] { text-align: center; vertical-align: middle; }
    th { background: #f3f4f6; font-weight: 600; }
    .cello-corner-index, .cello-column-index, .cello-row-index { background: #f9fafb; color: #6b7280; font-size: 0.75rem; font-weight: 600; text-align: center; }
    .cello-corner-index, .cello-row-index { min-width: 36px; }
    .cello-bold { font-weight: 700; }
    .cello-italic { font-style: italic; }
    .cello-strike { text-decoration: line-through; }
    ${renderHeadingClasses()}
    ${renderToneClasses()}
	  </style>`;
}

function renderToneVariables(): string {
  return CELLO_TONE_NAMES.map(
    (tone) => `--cello-tone-${tone}-color: ${CELLO_TONE_COLORS[tone].color};
      --cello-tone-${tone}-background: ${CELLO_TONE_COLORS[tone].background};`
  ).join("\n      ");
}

function renderToneClasses(): string {
  return CELLO_TONE_NAMES.map((tone) => `.cello-tone-${tone} { color: var(--cello-tone-${tone}-color); background: var(--cello-tone-${tone}-background); }`).join("\n    ");
}

function renderHeadingClasses(): string {
  return CELLO_HEADING_STYLES.map((heading) => `.${heading.className} { font-size: ${heading.fontSize}; font-weight: 700; }`).join("\n    ");
}

function createNonce(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function renderWorkbook(tabs: string, sheetsHtml: string): string {
  return `<div class="cello-workbook">
    <div class="cello-tabs">${tabs}</div>
    ${sheetsHtml}
  </div>`;
}

function renderScript(nonce: string): string {
  return `<script nonce="${escapeHtml(nonce)}">
    (() => {
    const currentScript = document.currentScript;
    const root = currentScript?.previousElementSibling;
    if (!(root instanceof HTMLElement) || !root.classList.contains("cello-workbook")) {
      return;
    }
    const tabs = Array.from(root.querySelectorAll(".cello-tab"));
    const sheets = Array.from(root.querySelectorAll(".cello-sheet"));
    function activateSheet(id) {
      const nextTab = tabs.find((tab) => tab.getAttribute("data-sheet") === id) ?? tabs[0];
      if (!nextTab) {
        return;
      }
      const nextId = nextTab.getAttribute("data-sheet");
      tabs.forEach((tab) => tab.classList.toggle("active", tab === nextTab));
      sheets.forEach((sheet) => sheet.classList.toggle("active", sheet.getAttribute("data-sheet") === nextId));
    }
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        activateSheet(tab.getAttribute("data-sheet"));
      });
    });
    activateSheet(tabs.find((tab) => tab.classList.contains("active"))?.getAttribute("data-sheet"));
    })();
  </script>`;
}

function renderTabs(workbook: WorkbookAst): string {
  return workbook.sheets
    .map((sheet, idx) => `<button class="cello-tab ${idx === 0 ? "active" : ""}" data-sheet="${escapeHtml(sheet.name)}">${escapeHtml(sheet.name)}</button>`)
    .join("");
}

function renderSheets(workbook: WorkbookAst): string {
  return workbook.sheets
    .map(
      (sheet, idx) =>
        `<section class="cello-sheet ${idx === 0 ? "active" : ""}" data-sheet="${escapeHtml(sheet.name)}"><table>${renderColGroup(workbook, sheet)}${renderTableHead(workbook, sheet)}<tbody>${sheet.rows
          .map((row) => renderRow(row, sheet, workbook))
          .join("")}</tbody></table></section>`
    )
    .join("");
}

function renderColGroup(workbook: WorkbookAst, sheet: SheetNode): string {
  const cols = Array.from({ length: getSheetColumnCount(sheet) }, (_, idx) => {
    const width = resolveColumnWidth(workbook, sheet, idx);
    return `<col${width.kind === "fit" ? "" : ` style="${columnWidthToCss(width)}"`}>`;
  }).join("");
  return `<colgroup><col style="width:${RENDER_ROW_INDEX_WIDTH_PX}px">${cols}</colgroup>`;
}

function renderTableHead(workbook: WorkbookAst, sheet: SheetNode): string {
  const columns = Array.from({ length: getSheetColumnCount(sheet) }, (_, idx) => `<th class="cello-column-index">${columnLetter(idx + 1)}</th>`).join("");
  return `<thead><tr><th class="cello-corner-index"></th>${columns}</tr>${renderFitMeasureRows(workbook, sheet)}</thead>`;
}

function renderFitMeasureRows(workbook: WorkbookAst, sheet: SheetNode): string {
  const columnCount = getSheetColumnCount(sheet);
  const columns = Array.from({ length: columnCount }, (_, colIndex) => ({
    fit: resolveColumnWidth(workbook, sheet, colIndex).kind === "fit",
    candidates: [] as FitMeasureCell[]
  }));

  for (const row of sheet.rows) {
    for (const cell of row.cells) {
      const colIndex = cell.col - 1;
      const column = columns[colIndex];
      if (!column?.fit || !isFitCandidateCell(cell)) {
        continue;
      }
      const modifiers = collectModifiers(cell, row, sheet, workbook);
      const value = fitCandidateValue(cell, modifiers);
      if (value === undefined) {
        continue;
      }
      column.candidates.push({ value, modifiers });
    }
  }

  const rowCount = Math.max(0, ...columns.map((column) => column.candidates.length));
  if (rowCount === 0) {
    return "";
  }

  return Array.from({ length: rowCount }, (_, rowIndex) => {
    const cells = columns.map((column) => renderFitMeasureCell(column.candidates[rowIndex])).join("");
    return `<tr class="cello-fit-measure-row"><th></th>${cells}</tr>`;
  }).join("");
}

interface FitMeasureCell {
  value: string;
  modifiers: Modifier[];
}

function renderRow(row: RowNode, sheet: SheetNode, workbook: WorkbookAst): string {
  const header = row.kind === "header";
  const rowLayout = resolveRowLayout(workbook, sheet, row.modifiers);
  const cells = row.cells
    .filter(isRenderableCell)
    .map((cell) => renderCell(cell, header, collectModifiers(cell, row, sheet, workbook), rowLayout))
    .join("");
  return `<tr><th class="cello-row-index" scope="row">${row.index}</th>${cells}</tr>`;
}

function renderCell(cell: CellNode, header: boolean, modifiers: Modifier[], rowLayout: ResolvedRowLayout): string {
  const tag = header ? "th" : "td";
  const formatted = formatInline(formatDisplayValue(renderCellValue(cell), modifiers));
  const attrs = buildCellAttributes(cell, modifiers, rowLayout);
  const body = `<span class="cello-cell-content">${formatted}</span>`;

  return `<${tag} ${attrs}>${body}</${tag}>`;
}

function renderFitMeasureCell(candidate: FitMeasureCell | undefined): string {
  if (!candidate) {
    return "<th></th>";
  }
  const className = buildClassAttribute(candidate.modifiers, { mode: "ellipsis", height: { kind: "auto" } });
  const style = buildStyleAttribute(candidate.modifiers, { mode: "ellipsis", height: { kind: "auto" } });
  const attrs = [className, style].filter(Boolean).join(" ");
  return `<th${attrs ? ` ${attrs}` : ""}><span class="cello-cell-content">${formatInline(candidate.value)}</span></th>`;
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

function collectModifiers(cell: CellNode, row: RowNode, sheet: SheetNode, workbook: WorkbookAst): Modifier[] {
  const columnModifiers = row.kind === "header" ? [] : (sheet.columns[cell.col - 1]?.modifiers ?? []);
  return [...columnModifiers, ...row.modifiers, ...cell.modifiers].flatMap((modifier) => expandAliasModifiers(workbook.aliases, modifier));
}

function buildCellAttributes(cell: CellNode, modifiers: Modifier[], rowLayout: ResolvedRowLayout): string {
  const className = buildClassAttribute(modifiers, rowLayout);
  const style = buildStyleAttribute(modifiers, rowLayout);

  return [cell.colspan > 1 ? `colspan="${cell.colspan}"` : "", cell.rowspan > 1 ? `rowspan="${cell.rowspan}"` : "", className, style].filter(Boolean).join(" ");
}

function formatInline(raw: string): string {
  for (const heading of CELLO_HEADING_STYLES) {
    if (raw.startsWith(heading.prefix)) {
      return `<span class="${heading.className}">${escapeHtml(raw.slice(heading.prefix.length))}</span>`;
    }
  }

  let out = escapeHtml(raw);
  out = out.replace(/\*([^*]+)\*/g, '<span class="cello-bold">$1</span>');
  out = out.replace(/_([^_]+)_/g, '<span class="cello-italic">$1</span>');
  out = out.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  return out;
}

function buildStyleAttribute(modifiers: Modifier[], rowLayout: ResolvedRowLayout): string {
  const style = [...getModifierStyleRules(modifiers), ...getRowLayoutStyleRules(rowLayout)].filter(Boolean).join(";");

  return style ? `style="${style}"` : "";
}

function buildClassAttribute(modifiers: Modifier[], rowLayout: ResolvedRowLayout): string {
  const classes = [...getRowLayoutClasses(rowLayout), ...getToneClasses(modifiers)];
  return classes.length > 0 ? `class="${classes.join(" ")}"` : "";
}

function isRenderableCell(cell: CellNode): boolean {
  return cell.kind !== "merge-left" && cell.kind !== "merge-up";
}

function getSheetColumnCount(sheet: SheetNode): number {
  const maxRenderedColumn = Math.max(0, ...sheet.rows.flatMap((row) => row.cells.filter(isRenderableCell).map((cell) => cell.col + Math.max(cell.colspan, 1) - 1)));
  return Math.max(sheet.columns.length, maxRenderedColumn);
}

function columnWidthToCss(width: ResolvedWidth): string {
  const resolved = width.kind === "fit" ? DEFAULT_COLUMN_WIDTH : width;
  return `width:${widthOuterToCss(resolved)}`;
}
