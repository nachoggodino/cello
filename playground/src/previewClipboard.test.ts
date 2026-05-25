import { describe, expect, it } from "vitest";
import { serializeCopiedRowsAsHtml, serializeCopiedRowsAsText } from "./previewClipboard";

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
});
