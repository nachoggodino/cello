import { describe, expect, it } from "vitest";
import { parse } from "../../../src/parser/parse.js";

describe("parse", () => {
  it("parses native sheets, headers, row modifiers and formulas", () => {
    const text = `
// comment
@sheet Main
@header | Product | Price[€][2d] | Total |
[bold] | Apple | 1.2 | =B2*2 |
`.trim();

    const ast = parse(text);
    expect(ast.sheets).toHaveLength(1);
    const sheet = ast.sheets[0];
    expect(sheet.name).toBe("Main");
    expect(sheet.rows[0].kind).toBe("header");
    expect(sheet.columns[1]).toMatchObject({ name: "Price", letter: "B" });
    expect(sheet.columns[1]?.modifiers).toEqual([
      { key: "€", raw: "€" },
      { key: "2d", raw: "2d" }
    ]);

    const dataRow = sheet.rows[1];
    expect(dataRow.modifiers[0]).toMatchObject({ key: "bold" });
    expect(dataRow.cells[2]).toMatchObject({ kind: "formula", formula: "=B2*2" });
  });

  it("handles horizontal and vertical merges", () => {
    const text = `
@sheet Merge
@header | Label | Value | Extra |
| Region A | 10 | < |
| ^ | 12 | 3 |
`.trim();

    const ast = parse(text);
    const sheet = ast.sheets[0];
    const firstData = sheet.rows[1];
    const secondData = sheet.rows[2];

    expect(firstData.cells[1]).toMatchObject({ colspan: 2 });
    expect(firstData.cells[0]).toMatchObject({ rowspan: 2 });
    expect(secondData.cells[0]).toMatchObject({ kind: "merge-up" });
  });

  it("parses csv with first line as header by default", () => {
    const text = `
@sheet Data [csv]
name,age
Ana,25
`.trim();
    const ast = parse(text);
    const sheet = ast.sheets[0];
    expect(sheet.format).toMatchObject({ kind: "delimited", delimiter: ",", noHeader: false });
    expect(sheet.rows[0].kind).toBe("header");
    expect(sheet.columns[0].name).toBe("name");
    expect(sheet.rows[1].cells[0].value).toBe("Ana");
    expect(sheet.rows[1].cells[1].value).toBe(25);
  });

  it("parses csv:noheader with generated column letters", () => {
    const text = `
@sheet Data [csv:noheader]
Ana,25
`.trim();
    const ast = parse(text);
    const sheet = ast.sheets[0];
    expect(sheet.rows[0].kind).toBe("data");
    expect(sheet.columns[0]).toMatchObject({ letter: "A" });
    expect(sheet.columns[1]).toMatchObject({ letter: "B" });
    expect("name" in sheet.columns[0]).toBe(false);
    expect("name" in sheet.columns[1]).toBe(false);
  });

  it("parses markdown format and skips separator row", () => {
    const text = `
@sheet Md [markdown]
| name | city |
| ---- | ---- |
| Ana  | Madrid |
`.trim();
    const ast = parse(text);
    const sheet = ast.sheets[0];
    expect(sheet.rows.filter((r) => r.kind === "header")).toHaveLength(1);
    expect(sheet.rows.filter((r) => r.kind === "data")).toHaveLength(1);
    expect(sheet.rows[1].cells[1].value).toBe("Madrid");
  });

  it("parses json sheet and emits header + data rows", () => {
    const text = `
@sheet JsonData [json]
[
  {"name":"Ana","age":25},
  {"name":"Luis","age":32}
]
`.trim();
    const ast = parse(text);
    const sheet = ast.sheets[0];
    expect(sheet.rows.some((r) => r.kind === "header")).toBe(true);
    const dataRows = sheet.rows.filter((r) => r.kind === "data");
    expect(dataRows).toHaveLength(2);
    expect(dataRows[0].cells[0].value).toBe("Ana");
    expect(dataRows[0].cells[1].value).toBe(25);
  });

  it("falls back on invalid json sheet with diagnostic", () => {
    const text = `
@sheet Broken [json]
{ invalid json }
`.trim();
    const ast = parse(text);
    expect(ast.diagnostics.some((d) => d.message.includes("JSON parse failed"))).toBe(true);
    expect(ast.sheets[0].rows.filter((r) => r.kind === "data")).toHaveLength(1);
  });

  it("creates anonymous sheet and warns on non-row lines", () => {
    const text = `
unstructured text
| A | B |
`.trim();
    const ast = parse(text, { anonymousSheetName: "Anon" });
    expect(ast.sheets[0].name).toBe("Anon");
    expect(ast.diagnostics.some((d) => d.message.includes("Skipped non-row line"))).toBe(true);
  });
});
