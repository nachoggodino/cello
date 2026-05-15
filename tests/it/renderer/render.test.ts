import { describe, expect, it } from "vitest";
import { render } from "../../../src/renderer/render.js";

describe("render", () => {
  it("renders full html document with tab controls", async () => {
    const html = await render("@sheet One\n| A |\n@sheet Two\n| B |", { title: "Workbook" });
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("<title>Workbook</title>");
    expect(html).toContain('class="cello-tab active"');
    expect(html).toContain('data-sheet="0"');
    expect(html).toContain('data-sheet="1"');
    expect(html).toContain("cello:active-sheet:");
    expect(html).toContain("activateSheet(window.localStorage.getItem(activeSheetStorageKey))");
  });

  it("renders inline formatting and cell styles", async () => {
    const html = await render(
      "@sheet S\n| *Bold* | _Italic_ | ~~Gone~~ |\n| value[bg:red][bold] | # Big | ## Bigger |\n| mix[#bg:#111:#eee] |"
    );
    expect(html).toContain('<span class="cello-bold">Bold</span>');
    expect(html).toContain('<span class="cello-italic">Italic</span>');
    expect(html).toContain("<del>Gone</del>");
    expect(html).toContain("background:red");
    expect(html).toContain("background:#111;color:#eee");
    expect(html).toContain("font-weight:700");
    expect(html).toContain('<span class="cello-h2">Big</span>');
    expect(html).toContain('<span class="cello-h1">Bigger</span>');
  });

  it("renders merge spans as table attributes", async () => {
    const html = await render("@sheet M\n| A | 1 | < |\n| ^ | 2 | 3 |");
    expect(html).toContain('colspan="2"');
    expect(html).toContain('rowspan="2"');
    expect(html).toContain("th[colspan], th[rowspan], td[colspan], td[rowspan] { text-align: center; vertical-align: middle; }");
  });

  it("can render formula text without evaluation", async () => {
    const html = await render("@sheet S\n| 1 | 2 | =A1+B1 |", { evaluate: false });
    expect(html).toContain("<td >=A1+B1</td>");
    expect(html).not.toContain("<td >3</td>");
  });
});
