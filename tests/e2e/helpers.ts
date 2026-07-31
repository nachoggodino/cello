import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "vitest";
import { parse } from "../../packages/core/src/parser/parse.js";
import { render } from "../../packages/core/src/renderer/render.js";
import type { CellNode, WorkbookAst } from "../../packages/core/src/shared/types.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, "fixtures");

export interface RenderFixtureCase {
  name: string;
  title: string;
  covers: string[];
  contains?: string[];
  notContains?: string[];
}

export async function renderFixture(caseDef: RenderFixtureCase): Promise<{ actual: string; workbook: WorkbookAst }> {
  const input = await readFixtureText(`${caseDef.name}.cel`);
  const externalOptions = {
    baseDir: process.cwd(),
    readExternalSource: (_path: string, context: { resolvedPath: string }) => readFileSync(context.resolvedPath, "utf8")
  };
  const workbook = parse(input, externalOptions);
  const actual = extractWorkbookViewHtml(await render(input, { ...externalOptions, title: caseDef.title }));
  return { actual, workbook };
}

export function assertRenderFixture(caseDef: RenderFixtureCase, html: string): void {
  for (const snippet of caseDef.contains ?? []) {
    expect(containsSnippet(html, snippet), `expected rendered HTML to contain ${snippet}`).toBe(true);
  }
  for (const snippet of caseDef.notContains ?? []) {
    expect(containsSnippet(html, snippet), `expected rendered HTML not to contain ${snippet}`).toBe(false);
  }
}

function containsSnippet(html: string, snippet: string): boolean {
  if (html.includes(snippet)) {
    return true;
  }
  return legacyCellSnippetAlternatives(snippet).some((alternative) => html.includes(alternative));
}

function legacyCellSnippetAlternatives(snippet: string): string[] {
  const bareCell = snippet.match(/^<(td|th) >(.+)<\/\1>$/);
  if (bareCell) {
    const [, tag, content] = bareCell;
    return [
      `<${tag} class="cello-wrap"><span class="cello-cell-content">${content}</span></${tag}>`,
      `<${tag} class="cello-ellipsis"><span class="cello-cell-content">${content}</span></${tag}>`
    ];
  }

  const styledCell = snippet.match(/^<(td|th) style="([^"]+)">(.+)<\/\1>$/);
  if (styledCell) {
    const [, tag, style, content] = styledCell;
    return [
      `<${tag} class="cello-wrap" style="${style}"><span class="cello-cell-content">${content}</span></${tag}>`,
      `<${tag} class="cello-ellipsis" style="${style}"><span class="cello-cell-content">${content}</span></${tag}>`
    ];
  }

  const closingCell = snippet.match(/^>(.+)<\/(td|th)>$/);
  if (closingCell) {
    const [, content, tag] = closingCell;
    return [`>${content}</span></${tag}>`];
  }

  return [];
}

export function assertRenderShape(actual: string, workbook: WorkbookAst): void {
  const expectedRows = workbook.sheets.flatMap((sheet) => sheet.rows);
  const expectedCoordinateHeaders = workbook.sheets.reduce((count, sheet) => count + 1 + getSheetColumnCount(sheet), 0);
  const expectedRowHeaders = expectedRows.length;
  const expectedHeaderCells = expectedRows.filter((row) => row.kind === "header").flatMap((row) => visibleCells(row.cells)).length;
  expect(countTag(actual, "button")).toBe(workbook.sheets.length);
  expect(countTag(actual, "section")).toBe(workbook.sheets.length);
  expect(countTag(actual, "table")).toBe(workbook.sheets.length);
  expect(countTag(actual, "tr")).toBe(expectedRows.length + workbook.sheets.length);
  expect(countTag(actual, "th")).toBe(expectedCoordinateHeaders + expectedRowHeaders + expectedHeaderCells);
  expect(countTag(actual, "td")).toBe(expectedRows.filter((row) => row.kind === "data").flatMap((row) => visibleCells(row.cells)).length);
}

async function readFixtureText(name: string): Promise<string> {
  return readFile(join(fixturesDir, name), "utf8");
}

function normalizeHtml(html: string): string {
  return html.replace(/\r\n/g, "\n").trim();
}

function extractWorkbookViewHtml(fullDocumentHtml: string): string {
  const marker = '<div class="cello-workbook">';
  const start = fullDocumentHtml.indexOf(marker);
  if (start === -1) {
    throw new Error("Rendered HTML does not contain workbook container.");
  }

  const scriptTagStart = fullDocumentHtml.indexOf("<script ", start);
  if (scriptTagStart === -1) {
    throw new Error("Rendered HTML does not contain script section.");
  }

  return normalizeHtml(fullDocumentHtml.slice(start, scriptTagStart));
}

function countTag(html: string, tagName: string): number {
  const matches = html.match(new RegExp(`<${tagName}\\b`, "g"));
  return matches?.length ?? 0;
}

function visibleCells(cells: CellNode[]): CellNode[] {
  return cells.filter((cell) => cell.kind !== "merge-left" && cell.kind !== "merge-up");
}

function getSheetColumnCount(sheet: WorkbookAst["sheets"][number]): number {
  const maxRenderedColumn = Math.max(0, ...sheet.rows.flatMap((row) => visibleCells(row.cells).map((cell) => cell.col + Math.max(cell.colspan, 1) - 1)));
  return Math.max(sheet.columns.length, maxRenderedColumn);
}
