import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "vitest";
import { render } from "../../src/renderer/render.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, "fixtures");

export interface RenderFixtureCase {
  name: string;
  title: string;
  covers: string[];
  contains?: string[];
  notContains?: string[];
}

export async function renderFixture(caseDef: RenderFixtureCase): Promise<{ actual: string; expected: string }> {
  const input = await readFixtureText(`${caseDef.name}.cel`);
  const expected = normalizeHtml(await readFixtureText(`${caseDef.name}.view.html`));
  const actual = extractWorkbookViewHtml(await render(input, { title: caseDef.title }));
  return { actual, expected };
}

export function assertRenderFixture(caseDef: RenderFixtureCase, html: string): void {
  for (const snippet of caseDef.contains ?? []) {
    expect(html).toContain(snippet);
  }
  for (const snippet of caseDef.notContains ?? []) {
    expect(html).not.toContain(snippet);
  }
}

export function assertRenderShape(actual: string, expected: string): void {
  expect(countTag(actual, "button")).toBe(countTag(expected, "button"));
  expect(countTag(actual, "section")).toBe(countTag(expected, "section"));
  expect(countTag(actual, "table")).toBe(countTag(expected, "table"));
  expect(countTag(actual, "tr")).toBe(countTag(expected, "tr"));
  expect(countTag(actual, "th")).toBe(countTag(expected, "th"));
  expect(countTag(actual, "td")).toBe(countTag(expected, "td"));
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
