export interface ClipboardPayload {
  html: string;
  plainText: string;
}

interface CopiedCell {
  colspan: number;
  rowspan: number;
  tagName: "td" | "th";
  text: string;
}

interface CopiedRow {
  cells: CopiedCell[];
  section: "body" | "head";
}

const clipboardStyleProperties = [
  "background-color",
  "border",
  "border-bottom",
  "border-collapse",
  "border-left",
  "border-right",
  "border-top",
  "color",
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "max-width",
  "min-width",
  "padding",
  "text-align",
  "text-decoration",
  "vertical-align",
  "white-space",
  "width"
] as const;

export function buildActiveSheetClipboardPayloadFromHtml(html: string, activeSheetName?: string): ClipboardPayload | null {
  if (!html) {
    return null;
  }

  const document = new DOMParser().parseFromString(html, "text/html");
  return buildActiveSheetClipboardPayload(document, activeSheetName);
}

export function buildActiveSheetClipboardPayload(document: Document, activeSheetName?: string): ClipboardPayload | null {
  const table = getActiveSheetTable(document, activeSheetName);
  if (!(table instanceof HTMLTableElement)) {
    return null;
  }

  const rows = extractCopiedRows(table);
  if (rows.length === 0) {
    return null;
  }

  return {
    html: serializeTableAsClipboardHtml(table),
    plainText: serializeCopiedRowsAsText(rows)
  };
}

export function serializeCopiedRowsAsHtml(rows: CopiedRow[]): string {
  const headRows = rows.filter((row) => row.section === "head");
  const bodyRows = rows.filter((row) => row.section === "body");
  const head = headRows.length > 0 ? `<thead>${headRows.map(serializeRowAsHtml).join("")}</thead>` : "";
  const body = bodyRows.length > 0 ? `<tbody>${bodyRows.map(serializeRowAsHtml).join("")}</tbody>` : "";
  return `<table>${head}${body}</table>`;
}

export function serializeCopiedRowsAsText(rows: CopiedRow[]): string {
  return rows.map((row) => row.cells.map((cell) => cell.text).join("\t")).join("\n");
}

function getActiveSheetTable(document: Document, activeSheetName?: string): HTMLTableElement | null {
  if (activeSheetName) {
    const activeSheet = Array.from(document.querySelectorAll(".cello-sheet")).find((sheet) => sheet.getAttribute("data-sheet") === activeSheetName);
    const table = activeSheet?.querySelector("table");
    if (table instanceof HTMLTableElement) {
      return table;
    }
  }

  const activeTable = document.querySelector(".cello-sheet.active table");
  return activeTable instanceof HTMLTableElement ? activeTable : null;
}

function serializeTableAsClipboardHtml(table: HTMLTableElement): string {
  const clone = table.cloneNode(true);
  if (!(clone instanceof HTMLTableElement)) {
    return wrapClipboardHtmlDocument(serializeCopiedRowsAsHtml(extractCopiedRows(table)));
  }

  inlineClipboardStyles(table, clone);
  stripPresentationChrome(clone);
  return wrapClipboardHtmlDocument(clone.outerHTML);
}

function wrapClipboardHtmlDocument(fragment: string): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
</head>
<body>
  <!--StartFragment-->${fragment}<!--EndFragment-->
</body>
</html>`;
}

function inlineClipboardStyles(originalRoot: Element, cloneRoot: Element): void {
  const originalElements = [originalRoot, ...Array.from(originalRoot.querySelectorAll("*"))];
  const cloneElements = [cloneRoot, ...Array.from(cloneRoot.querySelectorAll("*"))];

  for (let index = 0; index < originalElements.length; index += 1) {
    const original = originalElements[index];
    const clone = cloneElements[index];
    if (!(original instanceof HTMLElement) || !(clone instanceof HTMLElement)) {
      continue;
    }

    const computed = original.ownerDocument.defaultView?.getComputedStyle(original);
    if (!computed) {
      continue;
    }

    for (const property of clipboardStyleProperties) {
      const value = computed.getPropertyValue(property);
      if (value) {
        clone.style.setProperty(property, value);
      }
    }
  }
}

function stripPresentationChrome(table: HTMLTableElement): void {
  table.querySelectorAll(".cello-corner-index, .cello-column-index, .cello-row-index").forEach((node) => {
    node.remove();
  });
  table.querySelector("colgroup col")?.remove();
  table.querySelectorAll("tr").forEach((row) => {
    if (row.children.length === 0) {
      row.remove();
    }
  });
  table.querySelectorAll("thead, tbody").forEach((section) => {
    if (section.children.length === 0) {
      section.remove();
    }
  });
  if (!table.tBodies.length && !table.tHead) {
    const body = table.ownerDocument.createElement("tbody");
    while (table.firstChild) {
      body.appendChild(table.firstChild);
    }
    table.appendChild(body);
  }
}

function extractCopiedRows(table: HTMLTableElement): CopiedRow[] {
  return Array.from(table.tBodies.item(0)?.rows ?? [])
    .map((row) => {
      const cells = Array.from(row.cells)
        .filter((cell) => !cell.classList.contains("cello-row-index"))
        .map((cell): CopiedCell => ({
          colspan: cell.colSpan,
          rowspan: cell.rowSpan,
          tagName: cell.tagName.toLowerCase() === "th" ? "th" : "td",
          text: normalizeCellText(cell.textContent)
        }));

      if (cells.length === 0) {
        return null;
      }

      return {
        cells,
        section: cells.every((cell) => cell.tagName === "th") ? "head" : "body"
      } satisfies CopiedRow;
    })
    .filter((row): row is CopiedRow => row !== null);
}

function serializeRowAsHtml(row: CopiedRow): string {
  return `<tr>${row.cells
    .map((cell) => {
      const attrs = [cell.colspan > 1 ? ` colspan="${cell.colspan}"` : "", cell.rowspan > 1 ? ` rowspan="${cell.rowspan}"` : ""].join("");
      return `<${cell.tagName}${attrs}>${escapeHtml(cell.text)}</${cell.tagName}>`;
    })
    .join("")}</tr>`;
}

function normalizeCellText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .trim();
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
