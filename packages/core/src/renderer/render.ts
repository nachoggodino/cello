import { evaluate } from "../evaluator/evaluate.js";
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
import { hasVerticalMerges } from "../shared/table-view.js";
import { columnLetter, escapeHtml, workbookHasFormulas } from "../shared/utils.js";

const RENDER_ROW_INDEX_WIDTH_PX = 36;

export async function render(input: string | WorkbookAst, options: RenderOptions = {}): Promise<string> {
  const parseOptions = {
    ...(options.strict === undefined ? {} : { strict: options.strict }),
    ...(options.baseDir === undefined ? {} : { baseDir: options.baseDir }),
    ...(options.readExternalSource === undefined ? {} : { readExternalSource: options.readExternalSource })
  };
  const parsed = typeof input === "string" ? parse(input, parseOptions) : input;
  const shouldEvaluate = options.evaluate !== false && workbookHasFormulas(parsed);
  const evaluated = shouldEvaluate ? await evaluate(parsed, parseOptions) : parsed;
  const interactive = options.interactive !== false;
  const workbookHtml = renderWorkbook(renderTabs(evaluated), renderSheets(evaluated, interactive));

  return options.format === "fragment"
    ? renderFragment(workbookHtml, interactive)
    : renderDocument(options.title ?? "Cello Workbook", workbookHtml, interactive);
}

function renderDocument(title: string, workbookHtml: string, interactive: boolean): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  ${renderStyles()}
</head>
<body>
  ${workbookHtml}
  ${interactive ? renderScript() : ""}
</body>
</html>`;
}

function renderFragment(workbookHtml: string, interactive: boolean): string {
  return `${renderStyles()}
  ${workbookHtml}
  ${interactive ? renderScript() : ""}`;
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
    .cello-viewbar { display:flex; align-items:center; gap:8px; min-height:36px; margin-bottom:8px; color:#6b7280; font-size:12px; }
    .cello-view-button, .cello-view-select, .cello-column-filter, .cello-filter-popover button, .cello-filter-popover input { font:inherit; }
    .cello-view-button, .cello-view-select, .cello-column-filter, .cello-filter-popover button { border:1px solid #d1d5db; border-radius:4px; color:#374151; background:#fff; cursor:pointer; }
    .cello-view-button { min-height:30px; padding:5px 9px; font-weight:600; }
    .cello-view-button.active, .cello-column-filter.active, .cello-filter-popover button.active { border-color:#e7662f; color:#9a3412; background:#fff7ed; }
    .cello-view-select { min-height:30px; padding:4px 28px 4px 8px; }
    .cello-view-count { margin-left:auto; font-variant-numeric:tabular-nums; }
    .cello-view-warning { color:#9a3412; }
    .cello-column-index { position:relative; }
    .cello-column-index-inner { display:flex; align-items:center; justify-content:center; gap:3px; }
    .cello-column-filter { display:none; width:22px; height:22px; padding:0; align-items:center; justify-content:center; }
    .cello-view-enabled .cello-column-filter { display:inline-flex; }
    .cello-column-filter svg { width:12px; height:12px; fill:currentColor; }
    .cello-filter-popover { position:fixed; z-index:30; width:min(260px, calc(100vw - 24px)); padding:10px; border:1px solid #d1d5db; border-radius:6px; background:#fff; box-shadow:0 6px 8px rgba(17,24,39,.14); }
    .cello-filter-popover[hidden] { display:none; }
    .cello-filter-popover label { display:grid; gap:5px; color:#4b5563; font-size:12px; font-weight:600; }
    .cello-filter-popover input { width:100%; min-height:34px; padding:6px 8px; border:1px solid #d1d5db; border-radius:4px; color:#111827; }
    .cello-filter-actions { display:flex; gap:6px; margin-top:8px; }
    .cello-filter-actions button { flex:1; min-height:30px; padding:5px 7px; }
    .cello-view-button:focus-visible, .cello-view-select:focus-visible, .cello-column-filter:focus-visible, .cello-filter-popover button:focus-visible, .cello-filter-popover input:focus-visible { outline:2px solid #e7662f; outline-offset:2px; }
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
  return CELLO_TONE_NAMES.map((tone) => `--cello-tone-${tone}-color: ${CELLO_TONE_COLORS[tone].color};
      --cello-tone-${tone}-background: ${CELLO_TONE_COLORS[tone].background};`).join("\n      ");
}

function renderToneClasses(): string {
  return CELLO_TONE_NAMES.map((tone) => `.cello-tone-${tone} { color: var(--cello-tone-${tone}-color); background: var(--cello-tone-${tone}-background); }`).join("\n    ");
}

function renderHeadingClasses(): string {
  return CELLO_HEADING_STYLES.map((heading) => `.${heading.className} { font-size: ${heading.fontSize}; font-weight: 700; }`).join("\n    ");
}

function renderWorkbook(tabs: string, sheetsHtml: string): string {
  return `<div class="cello-workbook">
    <div class="cello-tabs">${tabs}</div>
    ${sheetsHtml}
  </div>`;
}

function renderScript(): string {
  return `<script>
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
    function wildcardMatch(value, pattern) {
      const parts = pattern.split("*");
      let offset = 0;
      if (!pattern.startsWith("*") && !value.startsWith(parts[0] || "")) return false;
      for (const part of parts) {
        if (!part) continue;
        const found = value.indexOf(part, offset);
        if (found < 0) return false;
        offset = found + part.length;
      }
      return pattern.endsWith("*") || value.endsWith(parts[parts.length - 1] || "");
    }
    function parseFilter(source) {
      const query = source.trim();
      if (!query) return null;
      const lower = query.toLocaleLowerCase();
      if (lower === "is:blank" || lower === "is:notblank") return { kind:lower };
      const comparison = query.match(/^(>=|<=|>|<)\\s*(.+)$/);
      if (comparison) {
        const operand = Number(comparison[2]);
        return Number.isFinite(operand) ? { kind:"compare", operator:comparison[1], operand } : { kind:"invalid" };
      }
      if (query.startsWith("=")) return { kind:"exact", operand:query.slice(1).trim().toLocaleLowerCase() };
      return { kind:query.includes("*") ? "wildcard" : "contains", operand:lower };
    }
    function matches(cell, source) {
      const filter = parseFilter(source);
      if (!filter) return true;
      if (filter.kind === "invalid") return false;
      const text = String(cell?.text ?? "").trim();
      if (filter.kind === "is:blank") return text === "" || cell?.value === null;
      if (filter.kind === "is:notblank") return text !== "" && cell?.value !== null;
      if (filter.kind === "compare") {
        const value = typeof cell?.value === "number" ? cell.value : Number(cell?.value);
        if (!Number.isFinite(value)) return false;
        if (filter.operator === ">") return value > filter.operand;
        if (filter.operator === ">=") return value >= filter.operand;
        if (filter.operator === "<") return value < filter.operand;
        return value <= filter.operand;
      }
      const normalized = text.toLocaleLowerCase();
      if (filter.kind === "exact") return normalized === filter.operand;
      if (filter.kind === "contains") return normalized.includes(filter.operand);
      return wildcardMatch(normalized, filter.operand);
    }
    function isBlank(cell) {
      return cell?.value === null || String(cell?.text ?? "").trim() === "";
    }
    function compareCells(a, b) {
      if (typeof a?.value === "number" && typeof b?.value === "number") return a.value - b.value;
      if (typeof a?.value === "boolean" && typeof b?.value === "boolean") return Number(a.value) - Number(b.value);
      return String(a?.text ?? "").localeCompare(String(b?.text ?? ""), undefined, { numeric:true, sensitivity:"base" });
    }
    root.querySelectorAll(".cello-sheet").forEach((sheet) => {
      const table = sheet.querySelector("table");
      const tbody = table?.tBodies[0];
      const toggle = sheet.querySelector(".cello-view-button");
      const selector = sheet.querySelector(".cello-view-select");
      const count = sheet.querySelector(".cello-view-count");
      if (!table || !tbody || !toggle) return;
      const originalRows = Array.from(tbody.rows);
      if (toggle.disabled) {
        if (count) count.textContent = originalRows.filter((row) => row.dataset.header !== "true").length + " rows";
        return;
      }
      let enabled = toggle.classList.contains("active");
      let rules = [];
      const readValues = (row) => JSON.parse(row.dataset.celloValues || "[]");
      const apply = () => {
        table.classList.toggle("cello-view-enabled", enabled);
        const filters = rules.flatMap((rule, colIndex) => rule?.filter ? [{ colIndex, source:rule.filter }] : []);
        const sort = rules.flatMap((rule, colIndex) => rule?.sort ? [{ colIndex, direction:rule.sort }] : [])[0];
        let shown = 0;
        let total = 0;
        let section = [];
        const flush = () => {
          const matching = section.filter((row) => !enabled || filters.every((filter) => matches(readValues(row)[filter.colIndex], filter.source)));
          total += section.length;
          shown += matching.length;
           if (enabled && sort) matching.sort((a, b) => {
             const aCell = readValues(a)[sort.colIndex];
             const bCell = readValues(b)[sort.colIndex];
             if (isBlank(aCell) !== isBlank(bCell)) return isBlank(aCell) ? 1 : -1;
             const compared = compareCells(aCell, bCell);
            return (sort.direction === "asc" ? compared : -compared) || Number(a.dataset.sourceRow) - Number(b.dataset.sourceRow);
          });
          matching.forEach((row) => { row.hidden = false; tbody.append(row); });
          section.filter((row) => !matching.includes(row)).forEach((row) => { row.hidden = true; tbody.append(row); });
          section = [];
        };
        originalRows.forEach((row) => {
          if (row.dataset.header === "true") { flush(); row.hidden = false; tbody.append(row); }
          else section.push(row);
        });
        flush();
        if (count) count.textContent = enabled ? shown + " of " + total + " rows" : total + " rows";
        toggle.classList.toggle("active", enabled);
        toggle.setAttribute("aria-pressed", String(enabled));
        table.querySelectorAll(".cello-column-filter").forEach((button) => {
          const rule = rules[Number(button.dataset.col)] || {};
          const active = enabled && Boolean(rule.filter || rule.sort);
          button.classList.toggle("active", active);
          button.setAttribute("aria-label", (active ? "Edit active" : "Set") + " filter and sort for column " + button.dataset.label);
        });
      };
      const chooseView = () => {
        const option = selector?.selectedOptions[0];
        rules = option?.dataset.rules ? JSON.parse(option.dataset.rules) : [];
        enabled = Boolean(option?.value);
        apply();
      };
      selector?.addEventListener("change", chooseView);
      if (selector?.value) chooseView();
      toggle.addEventListener("click", () => { enabled = !enabled; apply(); });
      table.querySelectorAll(".cello-column-filter").forEach((trigger) => {
        const popover = trigger.nextElementSibling;
        if (!(popover instanceof HTMLElement)) return;
        const input = popover.querySelector("input");
        const colIndex = Number(trigger.dataset.col);
         trigger.addEventListener("click", () => {
           const open = popover.hidden;
           root.querySelectorAll(".cello-filter-popover").forEach((item) => { item.hidden = true; item.previousElementSibling?.setAttribute("aria-expanded", "false"); });
           if (!open) return;
           const rect = trigger.getBoundingClientRect();
           popover.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 272)) + "px";
           popover.style.top = Math.max(8, Math.min(rect.bottom + 5, window.innerHeight - 150)) + "px";
           popover.hidden = false; trigger.setAttribute("aria-expanded", "true");
           if (input) { input.value = rules[colIndex]?.filter || ""; input.focus(); input.select(); }
           popover.querySelectorAll("[data-sort]").forEach((button) => button.classList.toggle("active", button.dataset.sort === (rules[colIndex]?.sort || "")));
        });
        const commit = () => {
          rules[colIndex] = { ...(rules[colIndex] || {}), ...(input?.value.trim() ? { filter:input.value.trim() } : {}) };
          if (!input?.value.trim()) delete rules[colIndex].filter;
          enabled = true; if (selector) selector.value = ""; apply();
        };
        input?.addEventListener("input", commit);
        popover.querySelectorAll("[data-sort]").forEach((button) => button.addEventListener("click", () => {
          const direction = button.dataset.sort;
          rules = rules.map((rule) => ({ ...rule, sort:undefined }));
          rules[colIndex] = { ...(rules[colIndex] || {}), ...(direction ? { sort:direction } : {}) };
           enabled = true; if (selector) selector.value = ""; apply();
           popover.hidden = true; trigger.setAttribute("aria-expanded", "false");
         }));
         popover.addEventListener("keydown", (event) => {
           if (event.key === "Escape") { popover.hidden = true; trigger.setAttribute("aria-expanded", "false"); trigger.focus(); }
         });
      });
      document.addEventListener("mousedown", (event) => {
        if (!(event.target instanceof Element) || event.target.closest(".cello-filter-popover, .cello-column-filter")) return;
        sheet.querySelectorAll(".cello-filter-popover").forEach((item) => { item.hidden = true; item.previousElementSibling?.setAttribute("aria-expanded", "false"); });
      });
      apply();
    });
    })();
  </script>`;
}

function renderTabs(workbook: WorkbookAst): string {
  return workbook.sheets
    .map((sheet, idx) => `<button class="cello-tab ${idx === 0 ? "active" : ""}" data-sheet="${escapeHtml(sheet.name)}">${escapeHtml(sheet.name)}</button>`)
    .join("");
}

function renderSheets(workbook: WorkbookAst, interactive: boolean): string {
  return workbook.sheets
    .map(
      (sheet, idx) =>
        `<section class="cello-sheet ${idx === 0 ? "active" : ""}" data-sheet="${escapeHtml(sheet.name)}">${interactive ? renderViewBar(sheet) : ""}<table>${renderColGroup(workbook, sheet)}${renderTableHead(workbook, sheet, interactive)}<tbody>${sheet.rows
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

function renderTableHead(workbook: WorkbookAst, sheet: SheetNode, interactive: boolean): string {
  const columns = Array.from({ length: getSheetColumnCount(sheet) }, (_, idx) => `<th class="cello-column-index">${interactive ? renderColumnFilter(idx) : columnLetter(idx + 1)}</th>`).join("");
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
  const cells = row.cells.filter(isRenderableCell).map((cell) => renderCell(cell, header, collectModifiers(cell, row, sheet, workbook), rowLayout)).join("");
  return `<tr data-source-row="${row.index}" data-header="${header}" data-cello-values="${escapeHtml(serializeRowValues(row, sheet, workbook))}"><th class="cello-row-index" scope="row">${row.index}</th>${cells}</tr>`;
}

function renderViewBar(sheet: SheetNode): string {
  const defaultView = sheet.views.find((view) => view.default);
  const options = [`<option value="">All rows</option>`, ...sheet.views.map((view) =>
    `<option value="${escapeHtml(view.name)}" data-rules="${escapeHtml(JSON.stringify(view.columns))}"${view === defaultView ? " selected" : ""}>${escapeHtml(view.name)}</option>`)].join("");
  const warning = hasVerticalMerges(sheet) ? `<span class="cello-view-warning">Filters unavailable: vertical merges</span>` : "";
  const disabled = hasVerticalMerges(sheet);
  return `<div class="cello-viewbar"><button type="button" class="cello-view-button${defaultView && !disabled ? " active" : ""}" aria-pressed="${Boolean(defaultView && !disabled)}"${disabled ? " disabled" : ""}>Filter &amp; sort</button>${sheet.views.length ? `<select class="cello-view-select" aria-label="Saved view"${disabled ? " disabled" : ""}>${options}</select>` : ""}${warning}<span class="cello-view-count"></span></div>`;
}

function renderColumnFilter(colIndex: number): string {
  const label = columnLetter(colIndex + 1);
  return `<span class="cello-column-index-inner"><span>${label}</span><button type="button" class="cello-column-filter" data-col="${colIndex}" data-label="${label}" aria-label="Set filter and sort for column ${label}" aria-expanded="false" aria-haspopup="dialog"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 3h12l-4.7 5.3v3.8l-2.6 1.3V8.3L2 3z"/></svg></button><span class="cello-filter-popover" role="dialog" aria-label="Filter and sort column ${label}" hidden><label>Filter ${label}<input type="text" placeholder="Contains, *wildcard*, >100" aria-label="Filter column ${label}"></label><span class="cello-filter-actions"><button type="button" data-sort="">No sort</button><button type="button" data-sort="asc">A–Z</button><button type="button" data-sort="desc">Z–A</button></span></span></span>`;
}

function serializeRowValues(row: RowNode, sheet: SheetNode, workbook: WorkbookAst): string {
  const values = Array.from({ length: getSheetColumnCount(sheet) }, () => ({ text: "", value: null as string | number | boolean | null }));
  for (const cell of row.cells) {
    if (!isRenderableCell(cell)) continue;
    const value = renderCellValue(cell);
    const text = formatDisplayValue(value, collectModifiers(cell, row, sheet, workbook));
    values[cell.col - 1] = { text, value };
  }
  return JSON.stringify(values);
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

  return [
    cell.colspan > 1 ? `colspan="${cell.colspan}"` : "",
    cell.rowspan > 1 ? `rowspan="${cell.rowspan}"` : "",
    className,
    style
  ]
    .filter(Boolean)
    .join(" ");
}

function formatInline(raw: string): string {
  for (const heading of CELLO_HEADING_STYLES) {
    if (raw.startsWith(heading.prefix)) {
      return `<span class="${heading.className}">${escapeHtml(raw.slice(heading.prefix.length))}</span>`;
    }
  }

  let out = escapeHtml(raw);
  out = out.replace(/\*([^*]+)\*/g, "<span class=\"cello-bold\">$1</span>");
  out = out.replace(/_([^_]+)_/g, "<span class=\"cello-italic\">$1</span>");
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

function columnWidthToCss(width: ResolvedWidth): string {
  const resolved = width.kind === "fit" ? DEFAULT_COLUMN_WIDTH : width;
  return `width:${widthOuterToCss(resolved)}`;
}
