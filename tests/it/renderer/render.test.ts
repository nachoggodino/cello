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

  it("renders numeric display modifiers from columns, rows and cells", async () => {
    const html = await render(
      "@sheet S\n-Item-Price[€][2d]-Margin[%][1d]-Units[0d]-\n" +
        "row_discount[0d] | Discount | 1.2 | 0.125 | 3.8 |\n" +
        "| Regular | 2[£][0d] | 0.5[2d] | 4.2 |"
    );

    expect(html).toContain("<td >€1</td>");
    expect(html).toContain("<td >13%</td>");
    expect(html).toContain("<td >4</td>");
    expect(html).toContain("<td >£2</td>");
    expect(html).toContain("<td >50.00%</td>");
  });

  it("renders evaluated column default formulas", async () => {
    const html = await render("@sheet S\n-Qty-Price-Total[default:=Qty*Price][€][2d]-\n| 2 | 3 |\n| 4 | 5 | 99 |");

    expect(html).toContain("<td >€6.00</td>");
    expect(html).toContain("<td >€99.00</td>");
  });

  it("renders spreadsheet coordinate chrome around sheets", async () => {
    const html = await render("@sheet S\n-Name-Amount-\n| Ada | 5 |");
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
});
