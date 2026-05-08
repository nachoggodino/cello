import { evaluate } from "../evaluator/evaluate.js";
import { parse } from "../parser/parse.js";
import type { CellNode, RenderOptions, WorkbookAst } from "../shared/types.js";
import { escapeHtml } from "../shared/utils.js";

export async function render(input: string | WorkbookAst, options: RenderOptions = {}): Promise<string> {
  const strictOptions = options.strict === undefined ? {} : { strict: options.strict };
  const parsed = typeof input === "string" ? parse(input, strictOptions) : input;
  const evaluated = await evaluate(parsed, strictOptions);

  const title = options.title ?? "Cello Workbook";
  const tabs = evaluated.sheets
    .map((sheet, idx) => `<button class="cello-tab ${idx === 0 ? "active" : ""}" data-sheet="${idx}">${escapeHtml(sheet.name)}</button>`)
    .join("");

  const sheetsHtml = evaluated.sheets
    .map((sheet, idx) => {
      const rows = sheet.rows
        .map((row) => {
          const cells = row.cells
            .filter((cell) => cell.kind !== "merge-left" && cell.kind !== "merge-up")
            .map((cell) => renderCell(cell, row.kind === "header"))
            .join("");
          return `<tr>${cells}</tr>`;
        })
        .join("");

      return `<section class="cello-sheet ${idx === 0 ? "active" : ""}" data-sheet="${idx}"><table><tbody>${rows}</tbody></table></section>`;
    })
    .join("");

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
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; vertical-align: top; }
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

function renderCell(cell: CellNode, header: boolean): string {
  const tag = header ? "th" : "td";
  const rawText = cell.computed ?? cell.value ?? "";
  const formatted = formatInline(String(rawText));
  const style = buildStyle(cell);
  const attrs = [
    cell.colspan > 1 ? `colspan="${cell.colspan}"` : "",
    cell.rowspan > 1 ? `rowspan="${cell.rowspan}"` : "",
    style ? `style="${style}"` : ""
  ]
    .filter(Boolean)
    .join(" ");

  return `<${tag} ${attrs}>${formatted}</${tag}>`;
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

function buildStyle(cell: CellNode): string {
  const styles: string[] = [];
  for (const mod of cell.modifiers) {
    if (mod.key === "bold") {
      styles.push("font-weight:700");
    } else if (mod.key === "italic") {
      styles.push("font-style:italic");
    } else if (mod.key === "bg" && mod.value) {
      styles.push(`background:${mod.value}`);
    } else if (mod.key.startsWith("#")) {
      styles.push(`color:${mod.key}`);
    } else if (mod.key === "color" && mod.value) {
      styles.push(`color:${mod.value}`);
    }
  }
  return styles.join(";");
}

