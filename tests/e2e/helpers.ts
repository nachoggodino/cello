import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "vitest";
import { parse } from "../../src/parser/parse.js";
import { render } from "../../src/renderer/render.js";
import type { CellNode, WorkbookAst } from "../../src/shared/types.js";

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
  const workbook = parse(input);
  const actual = extractWorkbookViewHtml(await render(input, { title: caseDef.title }));
  return { actual, workbook };
}

export function assertRenderFixture(caseDef: RenderFixtureCase, html: string): void {
  for (const snippet of caseDef.contains ?? []) {
    expect(html).toContain(snippet);
  }
  for (const snippet of caseDef.notContains ?? []) {
    expect(html).not.toContain(snippet);
  }
}

export function assertRenderShape(actual: string, workbook: WorkbookAst): void {
  const expectedRows = workbook.sheets.flatMap((sheet) => sheet.rows);
  expect(countTag(actual, "button")).toBe(workbook.sheets.length);
  expect(countTag(actual, "section")).toBe(workbook.sheets.length);
  expect(countTag(actual, "table")).toBe(workbook.sheets.length);
  expect(countTag(actual, "tr")).toBe(expectedRows.length);
  expect(countTag(actual, "th")).toBe(expectedRows.filter((row) => row.kind === "header").flatMap((row) => visibleCells(row.cells)).length);
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

  const scriptTagStart = fullDocumentHtml.indexOf("<script>", start);
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
