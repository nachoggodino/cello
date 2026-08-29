import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { render } from "../../../packages/core/src/renderer/render.js";

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
    expect(html).toContain("activateSheet(");
    expect(html).not.toContain("postMessage");
    expect(html).not.toContain("cello:active-sheet:");
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
      "@sheet S\n| *Bold* | _Italic_ | ~~Gone~~ |\n| value[bg:red][bold] | # Big | ## Bigger |\n| mix[#bg:#111:#eee] | named[red] | ### Small[strike] |"
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
    expect(html).toContain('<td class="cello-wrap" style="text-decoration:line-through"><span class="cello-cell-content"><span class="cello-h3">Small</span></span></td>');
  });

  it("does not render unsafe color modifier values into style attributes", async () => {
    const html = await render('@sheet S\n| x[bg:red" autofocus="x][color:blue" onclick="x][#not-a-color] | y[#bg:#111:" autofocus="x] |');

    expect(html).not.toContain("autofocus");
    expect(html).not.toContain("onclick");
    expect(html).not.toContain('style="background:red"');
    expect(html).not.toContain("not-a-color");
  });

  it("renders supported tone modifiers as overridable css classes", async () => {
    const html = await render(
      "@sheet S\n@header | Name[tone:accent] | State |\n[tone:muted] | muted | ok[tone:ok] |\n| warn[tone:warn] | error[tone:error] |\n| info[tone:info][bg:black] | plain |"
    );

    expect(html).toContain("--cello-tone-ok-background");
    expect(html).toContain(".cello-tone-accent { color: var(--cello-tone-accent-color); background: var(--cello-tone-accent-background); }");
    expect(html).toContain('<th class="cello-wrap cello-tone-accent"><span class="cello-cell-content">Name</span></th>');
    expect(html).toContain('<td class="cello-wrap cello-tone-accent cello-tone-muted"><span class="cello-cell-content">muted</span></td>');
    expect(html).toContain('<td class="cello-wrap cello-tone-muted cello-tone-ok"><span class="cello-cell-content">ok</span></td>');
    expect(html).toContain('<td class="cello-wrap cello-tone-accent cello-tone-warn"><span class="cello-cell-content">warn</span></td>');
    expect(html).toContain('<td class="cello-wrap cello-tone-error"><span class="cello-cell-content">error</span></td>');
    expect(html).toContain('<td class="cello-wrap cello-tone-accent cello-tone-info" style="background:black"><span class="cello-cell-content">info</span></td>');
  });

  it("renders layout aliases, column widths, fit columns, and row wrapping", async () => {
    const html = await render(
      "@tone notes [color:#334155][bg:#f8fafc]\n@width description [width:large]\n@height note [height:3]\n@sheet Roadmap [columns:fit][rows:wrap]\n@header | Status[width:xshort] | Description[width:description] | Wide[width:xxlarge] | Fit[fit] |\n[wrap][height:note] | ok[tone:notes] | Long content | Very wide | Wider content for fit |"
    );

    expect(html).toContain("width:calc(3ch + 16px)");
    expect(html).toContain("width:calc(36ch + 16px)");
    expect(html).toContain("width:calc(120ch + 16px)");
    expect(html).toContain("cello-wrap cello-fixed-height");
    expect(html).toContain("--cello-line-clamp:3");
    expect(html).toContain("--cello-content-height:60px");
    expect(html).toContain("color:#334155");
    expect(html).toContain("background:#f8fafc");
  });

  it("fits columns from computed unmerged values including headers and formulas", async () => {
    const html = await render(
      "@sheet S [columns:fit]\n@header | Amount[€][2d] | Note | Merged |\n| 12.5 | ok | tiny |\n| =SUM(Amount) | longer literal | very very long merged source | < |\n| 7[%] | < | fit |"
    );

    expect(html).toContain("table-layout: auto");
    expect(html).toContain("<colgroup><col style=\"width:36px\"><col><col><col><col></colgroup>");
    expect(html).toContain(".cello-fit-measure-row { visibility: collapse; }");
    expect(html).toContain("cello-fit-measure-row");
    expect(html).toContain("€12.50");
    expect(html).toContain("longer literal");
    expect(html).not.toContain("width:calc(29ch + 16px)");
  });

  it("uses formula computed values for fit width", async () => {
    const html = await render("@sheet S [columns:fit]\n@header | Formula |\n| =10000000000000 |");

    expect(html).toContain("<colgroup><col style=\"width:36px\"><col></colgroup>");
    expect(html).toContain(">10000000000000<");
    expect(html).not.toContain("=10000000000000");
  });

  it("formats formula fit values and keeps only fake modifiers in literal fit values", async () => {
    const html = await render("@sheet S [columns:fit]\n@header | F | Literal |\n| =SUM(2+2)[$][bold] | hello world[fake][italic] |");

    expect(html).toContain("<colgroup><col style=\"width:36px\"><col><col></colgroup>");
    expect(html).toContain("$4");
    expect(html).toContain("hello world[fake]");
    expect(html).not.toContain("=SUM(2+2)");
  });

  it("does not measure column layout modifiers as visible fit text", async () => {
    const html = await render("@sheet S\n@header | [fit] |\n| ok |");

    expect(html).toContain("cello-fit-measure-row");
    expect(html).not.toContain("[fit]");
  });

  it("falls back for unknown layout values and supports multi-line ellipsis clamps", async () => {
    const html = await render("@sheet S\n@header | A[width:unknown] |\n[ellipsis][height:3] | Long content that should be clamped across lines |\n[wrap][height:unknown] | Unknown height falls back |");

    expect(html).toContain("width:calc(12ch + 16px)");
    expect(html).toContain(".cello-ellipsis:not(.cello-line-clamp) .cello-cell-content");
    expect(html).toContain('class="cello-ellipsis cello-fixed-height cello-line-clamp"');
    expect(html).toContain("--cello-line-clamp:3");
    expect(html).toContain("--cello-line-clamp:1");
    expect(html).not.toContain(".cello-ellipsis .cello-cell-content { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }");
  });

  it("renders numeric display modifiers from columns, rows and cells", async () => {
    const html = await render(
      "@sheet S\n@header | Item | Price[€][2d] | Margin[%][1d] | Units[0d] |\n" +
        "[0d] | Discount | 1.2 | 0.125 | 3.8 |\n" +
        "| Regular | 2[£][0d] | 0.5[2d] | 4.2 |"
    );

    expect(html).toContain('<span class="cello-cell-content">€1</span>');
    expect(html).toContain('<span class="cello-cell-content">13%</span>');
    expect(html).toContain('<span class="cello-cell-content">4</span>');
    expect(html).toContain('<span class="cello-cell-content">£2</span>');
    expect(html).toContain('<span class="cello-cell-content">50.00%</span>');
  });

  it("renders evaluated column default formulas", async () => {
    const html = await render("@sheet S\n@header | Qty | Price | Total[€][2d] |\n@defaults | | | =Qty*Price |\n| 2 | 3 |\n| 4 | 5 | 99 |");

    expect(html).toContain('<span class="cello-cell-content">€6.00</span>');
    expect(html).toContain('<span class="cello-cell-content">€99.00</span>');
    expect(html).not.toContain("@defaults");
  });

  it("renders literal defaults and formula-cell numeric modifiers", async () => {
    const html = await render(
      '@sheet S\n@header | Status | Amount |\n@defaults | "Pending" | |\n| | 2 |\n| Done | 3 |\n[bold] | Total | =SUM(Amount)[$][2d] |'
    );

    expect(html).toContain('<span class="cello-cell-content">Pending</span>');
    expect(html).toContain('<span class="cello-cell-content">Done</span>');
    expect(html).toContain('<td class="cello-wrap" style="font-weight:700"><span class="cello-cell-content">$5.00</span></td>');
  });

  it("renders spreadsheet coordinate chrome around sheets", async () => {
    const html = await render("@sheet S\n@header | Name | Amount |\n| Ada | 5 |");
    expect(html).toContain('<thead><tr><th class="cello-corner-index"></th><th class="cello-column-index"><span class="cello-column-index-inner"><span>A</span>');
    expect(html).toContain('<span class="cello-column-index-inner"><span>B</span>');
    expect(html).toContain('data-source-row="1" data-header="true"');
    expect(html).toContain('<th class="cello-wrap"><span class="cello-cell-content">Name</span></th>');
    expect(html).toContain('data-source-row="2" data-header="false"');
    expect(html).toContain('<td class="cello-wrap"><span class="cello-cell-content">Ada</span></td>');
  });

  it("extends column letters to rendered row width", async () => {
    const html = await render("@sheet S\n| A | B | C |");
    expect(html).toContain('<span class="cello-column-index-inner"><span>C</span>');
  });

  it("renders merge spans as table attributes", async () => {
    const html = await render("@sheet M\n| A | 1 | < |\n| ^ | 2 | 3 |");
    expect(html).toContain('colspan="2"');
    expect(html).toContain('rowspan="2"');
    expect(html).toContain("th[colspan], th[rowspan], td[colspan], td[rowspan] { text-align: center; vertical-align: middle; }");
  });

  it("can render formula text without evaluation", async () => {
    const html = await render("@sheet S\n| 1 | 2 | =A1+B1 |", { evaluate: false });
    expect(html).toContain('<span class="cello-cell-content">=A1+B1</span>');
    expect(html).not.toContain('<span class="cello-cell-content">3</span>');
  });

  it("can render a non-interactive document without scripts", async () => {
    const html = await render("@sheet One\n| A |\n@sheet Two\n| B |", { interactive: false });

    expect(html).toContain('<div class="cello-tabs">');
    expect(html).not.toContain("<script>");
  });

  it("renders saved views and interactive column controls without rendering declarations as rows", async () => {
    const html = await render([
      "@sheet Sales",
      "@view Madrid [default] | @where mad | @sort desc |",
      "@header | City | Amount |",
      "| Madrid | 120 |",
      "| Bilbao | 80 |"
    ].join("\n"));

    expect(html).toContain('class="cello-view-button active"');
    expect(html).toContain('<option value="Madrid" data-rules=');
    expect(html).toContain('class="cello-column-filter" data-col="0"');
    expect(html).toContain('data-source-row="1" data-header="true"');
    expect(html).toContain('data-source-row="3" data-header="false"');
    expect(html).not.toContain('<td class="cello-wrap"><span class="cello-cell-content">@view');
  });

  it("disables interactive table views when a vertical merge is present", async () => {
    const html = await render("@sheet Sales\n@view All [default] | @where nomatch |\n| Madrid | 1 |\n| ^ | 2 |");

    expect(html).toContain('class="cello-view-button" aria-pressed="false" disabled');
    expect(html).toContain('class="cello-view-select" aria-label="Saved view" disabled');
    expect(html).toContain("Filters unavailable: vertical merges");
    const dom = new JSDOM(html, { runScripts: "dangerously" });
    expect(Array.from(dom.window.document.querySelectorAll<HTMLTableRowElement>("tbody tr")).every((row) => !row.hidden)).toBe(true);
    expect(dom.window.document.querySelector(".cello-view-count")?.textContent).toBe("2 rows");
    dom.window.close();
  });

  it("runs saved filters and sorting in the self-contained HTML", async () => {
    const html = await render([
      "@sheet Sales",
      "@view Madrid [default] | @where mad | @sort desc |",
      "@header | City | Amount |",
      "| Madrid | 100 |",
      "| Madrid | 200 |",
      "| Madrid | |",
      "| Bilbao | 300 |"
    ].join("\n"));
    const dom = new JSDOM(html, { runScripts: "dangerously" });
    const rows = Array.from(dom.window.document.querySelectorAll<HTMLTableRowElement>("tbody tr"));

    expect(rows.filter((row) => !row.hidden).map((row) => row.dataset.sourceRow)).toEqual(["1", "3", "2", "4"]);
    expect(rows.find((row) => row.dataset.sourceRow === "5")?.hidden).toBe(true);
    expect(dom.window.document.querySelector(".cello-view-count")?.textContent).toBe("3 of 4 rows");

    const selector = dom.window.document.querySelector<HTMLSelectElement>(".cello-view-select");
    expect(selector).toBeTruthy();
    selector!.value = "";
    selector!.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    expect(rows.every((row) => !row.hidden)).toBe(true);
    expect(dom.window.document.querySelector(".cello-view-count")?.textContent).toBe("4 rows");
    dom.window.close();
  });
});
