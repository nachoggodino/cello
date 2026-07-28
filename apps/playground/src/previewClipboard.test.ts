// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { buildActiveSheetClipboardPayloadFromHtml, serializeCopiedRowsAsHtml, serializeCopiedRowsAsText } from "./previewClipboard";

describe("preview clipboard", () => {
  it("serializes table rows as clipboard-friendly html", () => {
    const html = serializeCopiedRowsAsHtml([
      {
        section: "head",
        cells: [
          { colspan: 1, rowspan: 1, tagName: "th", text: "Name" },
          { colspan: 1, rowspan: 1, tagName: "th", text: "Amount" }
        ]
      },
      {
        section: "body",
        cells: [
          { colspan: 1, rowspan: 1, tagName: "td", text: "Ada" },
          { colspan: 2, rowspan: 1, tagName: "td", text: "5" }
        ]
      }
    ]);

    expect(html).toBe("<table><thead><tr><th>Name</th><th>Amount</th></tr></thead><tbody><tr><td>Ada</td><td colspan=\"2\">5</td></tr></tbody></table>");
  });

  it("serializes table rows as tab-separated text", () => {
    const text = serializeCopiedRowsAsText([
      {
        section: "head",
        cells: [
          { colspan: 1, rowspan: 1, tagName: "th", text: "Name" },
          { colspan: 1, rowspan: 1, tagName: "th", text: "Amount" }
        ]
      },
      {
        section: "body",
        cells: [
          { colspan: 1, rowspan: 1, tagName: "td", text: "Ada" },
          { colspan: 1, rowspan: 1, tagName: "td", text: "5" }
        ]
      }
    ]);

    expect(text).toBe("Name\tAmount\nAda\t5");
  });

  it("removes the row-index colgroup column from rich clipboard html", () => {
    const payload = buildActiveSheetClipboardPayloadFromHtml(`
      <section class="cello-sheet active" data-sheet="Report">
        <table>
          <colgroup>
            <col style="width:36px">
            <col style="width:100px">
            <col style="width:120px">
          </colgroup>
          <thead>
            <tr>
              <th class="cello-corner-index"></th>
              <th class="cello-column-index">A</th>
              <th class="cello-column-index">B</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th class="cello-row-index" scope="row">1</th>
              <td>Ada</td>
              <td>5</td>
            </tr>
          </tbody>
        </table>
      </section>
    `);

    expect(payload?.plainText).toBe("Ada\t5");
    expect(payload?.html).not.toContain("width:36px");
    expect(payload?.html).toContain("width:100px");
    expect(payload?.html).toContain("width:120px");
  });
});
