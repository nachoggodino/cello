import { describe, expect, it } from "vitest";
import { render } from "../../../src/renderer/render.js";

describe("render", () => {
  it("renders full html document with tab controls", async () => {
    const html = await render("@sheet One\n| A |\n@sheet Two\n| B |", { title: "Workbook" });
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("<html lang=\"en\">");
    expect(html).toContain("<head>");
    expect(html).toContain("<body>");
    expect(html).toContain("<title>Workbook</title>");
    expect(html).toContain("<style>");
    expect(html).toContain('class="cello-tab active"');
    expect(html).toContain('data-sheet="One"');
    expect(html).toContain('data-sheet="Two"');
    expect(html).toContain("cello:active-sheet:");
    expect(html).toContain("activateSheet(readStoredSheet())");
  });

  it("renders embeddable html fragments without document wrappers", async () => {
    const html = await render("@sheet One\n| A |\n@sheet Two\n| B |", { format: "fragment" });

    expect(html).not.toContain("<!doctype html>");
    expect(html).not.toContain("<html");
    expect(html).not.toContain("<head>");
    expect(html).not.toContain("<body>");
    expect(html).not.toContain("<title>");
    expect(html).toContain("<style>");
    expect(html).toContain('<div class="cello-workbook">');
    expect(html).toContain("<script>");
    expect(html).toContain("document.currentScript");
    expect(html).toContain('data-sheet="Two"');
  });

  it("renders inline formatting and cell styles", async () => {
    const html = await render(
      "@sheet S\n| *Bold* | _Italic_ | ~~Gone~~ |\n| value[bg:red][bold] | # Big | ## Bigger |\n| mix[#bg:#111:#eee] | named[red] |"
    );
    expect(html).toContain('<span class="cello-bold">Bold</span>');
    expect(html).toContain('<span class="cello-italic">Italic</span>');
    expect(html).toContain("<del>Gone</del>");
    expect(html).toContain("background:red");
    expect(html).toContain("background:#111;color:#eee");
    expect(html).toContain("font-weight:700");
    expect(html).toContain("color:red");
    expect(html).toContain('<span class="cello-h2">Big</span>');
    expect(html).toContain('<span class="cello-h1">Bigger</span>');
  });

  it("renders supported tone modifiers as overridable css classes", async () => {
    const html = await render(
      "@sheet S\n@header | Name[tone:accent] | State |\n[tone:muted] | muted | ok[tone:ok] |\n| warn[tone:warn] | error[tone:error] |\n| info[tone:info][bg:black] | plain |"
    );

    expect(html).toContain("--cello-tone-ok-background");
    expect(html).toContain(".cello-tone-accent { color: var(--cello-tone-accent-color); background: var(--cello-tone-accent-background); }");
    expect(html).toContain('<th class="cello-tone-accent">Name</th>');
    expect(html).toContain('<td class="cello-tone-accent cello-tone-muted">muted</td>');
    expect(html).toContain('<td class="cello-tone-muted cello-tone-ok">ok</td>');
    expect(html).toContain('<td class="cello-tone-accent cello-tone-warn">warn</td>');
    expect(html).toContain('<td class="cello-tone-error">error</td>');
    expect(html).toContain('<td class="cello-tone-accent cello-tone-info" style="background:black">info</td>');
  });

  it("renders numeric display modifiers from columns, rows and cells", async () => {
    const html = await render(
      "@sheet S\n@header | Item | Price[€][2d] | Margin[%][1d] | Units[0d] |\n" +
        "[0d] | Discount | 1.2 | 0.125 | 3.8 |\n" +
        "| Regular | 2[£][0d] | 0.5[2d] | 4.2 |"
    );

    expect(html).toContain("<td >€1</td>");
    expect(html).toContain("<td >13%</td>");
    expect(html).toContain("<td >4</td>");
    expect(html).toContain("<td >£2</td>");
    expect(html).toContain("<td >50.00%</td>");
  });

  it("renders evaluated column default formulas", async () => {
    const html = await render("@sheet S\n@header | Qty | Price | Total[€][2d] |\n@defaults | | | =Qty*Price |\n| 2 | 3 |\n| 4 | 5 | 99 |");

    expect(html).toContain("<td >€6.00</td>");
    expect(html).toContain("<td >€99.00</td>");
    expect(html).not.toContain("@defaults");
  });

  it("renders spreadsheet coordinate chrome around sheets", async () => {
    const html = await render("@sheet S\n@header | Name | Amount |\n| Ada | 5 |");
    expect(html).toContain('<thead><tr><th class="cello-corner-index"></th><th class="cello-column-index">A</th><th class="cello-column-index">B</th></tr></thead>');
    expect(html).toContain('<tr><th class="cello-row-index" scope="row">1</th><th >Name</th><th >Amount</th></tr>');
    expect(html).toContain('<tr><th class="cello-row-index" scope="row">2</th><td >Ada</td><td >5</td></tr>');
  });

  it("extends column letters to rendered row width", async () => {
    const html = await render("@sheet S\n| A | B | C |");
    expect(html).toContain('<th class="cello-column-index">C</th>');
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

  it("can render a non-interactive document without scripts", async () => {
    const html = await render("@sheet One\n| A |\n@sheet Two\n| B |", { interactive: false });

    expect(html).toContain('<div class="cello-tabs">');
    expect(html).not.toContain("<script>");
  });
});
