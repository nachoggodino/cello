import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { render } from "../../src/renderer/render.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, "fixtures");

type FixtureCase = {
  name: string;
  title: string;
  assertions: Array<(html: string) => void>;
};

const cases: FixtureCase[] = [
  {
    name: "native-bylaws",
    title: "Native BYLAWS",
    assertions: [
      (html) => expect(html).toContain('<span class="cello-bold">North</span>'),
      (html) => expect(html).toContain('style="background:#fff9c4"'),
      (html) => expect(html).toContain('style="font-style:italic"'),
      (html) => expect(html).toContain('style="font-weight:700"'),
      (html) => expect(html).toContain('<span class="cello-h1">TOTAL</span>'),
      (html) => expect(html).toContain('<span class="cello-h2">Revenue</span>'),
      (html) => expect(html).toContain("<del>legacy</del>"),
      (html) => expect(html).toContain(">25</td>"),
      (html) => expect(html).toContain("<td >2026-01-01</td>"),
      (html) => expect(html).toContain("<td >TRUE</td>")
    ]
  },
  {
    name: "format-matrix",
    title: "Format Matrix",
    assertions: [
      (html) => expect(html).toContain(">CsvData<"),
      (html) => expect(html).toContain(">Notes<"),
      (html) => expect(html).toContain(">JsonData<"),
      (html) => expect(html).toContain("<th >name</th>"),
      (html) => expect(html).toContain("<th >title</th>"),
      (html) => expect(html).toContain("<th >code</th>"),
      (html) => expect(html).toContain('<span class="cello-bold">Lead</span>'),
      (html) => expect(html).toContain("<td >32</td>"),
      (html) => expect(html).toContain("<td >false</td>")
    ]
  },
  {
    name: "merge-layout",
    title: "Merge Layout",
    assertions: [
      (html) => expect(html).toContain('colspan="3"'),
      (html) => expect(html).toContain('rowspan="2"'),
      (html) => expect(html).toContain("<td >Alcala</td>"),
      (html) => expect(html).toContain("<td >12</td>")
    ]
  }
];

describe("render e2e fixtures", () => {
  for (const fixture of cases) {
    it(`renders ${fixture.name} fixture exactly`, async () => {
      const input = await readFile(join(fixturesDir, `${fixture.name}.cel`), "utf8");
      const expected = normalizeHtml(await readFile(join(fixturesDir, `${fixture.name}.html`), "utf8"));

      const actual = normalizeHtml(await render(input, { title: fixture.title }));

      expect(actual).toBe(expected);
      for (const assertion of fixture.assertions) {
        assertion(actual);
      }
    });
  }
});

function normalizeHtml(html: string): string {
  return html.replace(/\r\n/g, "\n").trim();
}
