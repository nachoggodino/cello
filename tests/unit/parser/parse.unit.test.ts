import { describe, expect, it } from "vitest";
import { parse, parseDocument } from "../../../packages/core/src/parser/parse.js";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("parse (unit-focused edge cases)", () => {
  it("builds source locations from the same decisions as tolerant parsing", () => {
    const source = "@sheet One\n| A |\n@sheet\n| B |\n@sheet Two\n| C |";
    const document = parseDocument(source);

    expect(document.workbook.sheets).toHaveLength(2);
    expect(document.sourceMap.sheets).toHaveLength(2);
    expect(document.sourceMap.sheets[0]?.rows).toHaveLength(2);
    expect(document.sourceMap.sheets[1]?.rows).toHaveLength(1);
    expect(document.sourceMap.sheets[1]?.declaration?.line).toBe(5);
  });

  it("keeps CRLF outside source spans while preserving exact offsets", () => {
    const source = "@sheet Report\r\n| Ada | 5 |\r\n";
    const document = parseDocument(source);
    const sheet = document.sourceMap.sheets[0];
    const row = sheet?.rows[0];

    expect(source.slice(sheet?.declaration?.lineSpan.start, sheet?.declaration?.lineSpan.end)).toBe("@sheet Report");
    expect(source.slice(row?.lineSpan.start, row?.lineSpan.end)).toBe("| Ada | 5 |");
    expect(row?.cells.map((cell) => source.slice(cell.span.start, cell.span.end))).toEqual(["Ada", "5"]);
  });

  it("preserves anonymous-sheet mapping around comments and aliases", () => {
    const source = "// comment\n@tone note [bold]\n\n| A | B |";
    const document = parseDocument(source);

    expect(document.workbook.sheets).toHaveLength(1);
    expect(document.sourceMap.sheets).toHaveLength(1);
    expect(document.sourceMap.sheets[0]?.declaration).toBeUndefined();
    expect(document.sourceMap.sheets[0]?.rows[0]?.line).toBe(4);
  });

  it("records external directives as read-only source locations", () => {
    const source = "@sheet Imported\n-> data.cel";
    const document = parseDocument(source, { readExternalSource: () => "| A |" });
    const sheet = document.sourceMap.sheets[0];

    expect(sheet?.editable).toBe(false);
    expect(sheet?.externalSources).toEqual([{
      path: "data.cel",
      line: 2,
      lineSpan: { start: 16, end: 27 }
    }]);
  });

  it("distinguishes explicit, empty, omitted, and default-derived cell provenance", () => {
    const source = [
      "@sheet Report",
      "@header | Name | Status | Total | Note |",
      "@defaults | | Pending | =1 | |",
      "| Ada | |"
    ].join("\n");
    const document = parseDocument(source);
    const row = document.sourceMap.sheets[0]?.rows[1];

    expect(row?.cells.map((cell) => ({
      sourceKind: cell.sourceKind,
      valueOrigin: cell.valueOrigin,
      defaultText: cell.defaultSpan ? source.slice(cell.defaultSpan.start, cell.defaultSpan.end) : undefined
    }))).toEqual([
      { sourceKind: "explicit-value", valueOrigin: "explicit", defaultText: undefined },
      { sourceKind: "explicit-empty", valueOrigin: "default-derived", defaultText: "Pending" },
      { sourceKind: "omitted", valueOrigin: "default-derived", defaultText: "=1" },
      { sourceKind: "omitted", valueOrigin: "absent", defaultText: undefined }
    ]);
  });

  it("ignores blank lines and preserves compact row numbering", () => {
    const ast = parse("@sheet S\n| A |\n\n| B |");
    const sheet = ast.sheets[0];
    expect(sheet.rows[0].index).toBe(1);
    expect(sheet.rows[1]).toMatchObject({ kind: "data", index: 2 });
    expect(sheet.rows).toHaveLength(2);
  });

  it("marks hidden column from header modifier", () => {
    const ast = parse("@sheet S\n@header | Visible | Hidden[hidden] |\n| x | y |");
    const sheet = ast.sheets[0];
    expect(sheet.columns[0]).toMatchObject({ name: "Visible", hidden: false });
    expect(sheet.columns[1]).toMatchObject({ name: "Hidden", hidden: true });
  });

  it("parses row-level modifiers before the first pipe", () => {
    const ast = parse("@sheet S\n[bold][bg:#eee] | A | 1 |");
    const row = ast.sheets[0].rows[0];
    expect(row.modifiers).toHaveLength(2);
    expect(row.modifiers[0].key).toBe("bold");
    expect(row.modifiers[1]).toMatchObject({ key: "bg", value: "#eee" });
  });

  it("parses project aliases and sheet layout modifiers", () => {
    const ast = parse(
      "@tone notes [color:#334155][bg:#f8fafc]\n@width description [width:large]\n@height note [height:3]\n@sheet Roadmap [columns:fit][rows:wrap]\n@header | Status[width:xshort] | Description[width:description] |\n[wrap][height:note] | ok | Long content |"
    );

    expect(ast.aliases).toEqual([
      {
        namespace: "tone",
        name: "notes",
        modifiers: [
          { raw: "color:#334155", key: "color", value: "#334155" },
          { raw: "bg:#f8fafc", key: "bg", value: "#f8fafc" }
        ]
      },
      { namespace: "width", name: "description", modifiers: [{ raw: "width:large", key: "width", value: "large" }] },
      { namespace: "height", name: "note", modifiers: [{ raw: "height:3", key: "height", value: "3" }] }
    ]);
    expect(ast.sheets[0]).toMatchObject({ name: "Roadmap", layout: { columns: "fit", rows: "wrap" } });
    expect(ast.sheets[0].columns[1]?.modifiers).toEqual([{ raw: "width:description", key: "width", value: "description" }]);
    expect(ast.sheets[0].rows[1]?.modifiers).toEqual([
      { raw: "wrap", key: "wrap" },
      { raw: "height:note", key: "height", value: "note" }
    ]);
  });

  it("warns for invalid alias declarations", () => {
    const ast = parse("@tone notes\n@width [width:large]\n@sheet S\n| A |");

    expect(ast.aliases).toHaveLength(0);
    expect(ast.diagnostics.map((diagnostic) => diagnostic.message)).toEqual([
      "Invalid @tone alias declaration.",
      "Invalid @width alias declaration."
    ]);
  });

  it("parses sheet format and layout modifiers together", () => {
    const ast = parse("@sheet Data [csv][columns:fit][rows:wrap]\nname,amount\nAda,5");

    expect(ast.sheets[0]?.format).toMatchObject({ kind: "delimited", delimiter: ",", alias: "csv" });
    expect(ast.sheets[0]?.layout).toEqual({ columns: "fit", rows: "wrap" });
  });

  it("does not treat text before the first pipe as a row reference", () => {
    const ast = parse("@sheet S\nrow_1[bold] | A | 1 |");
    const row = ast.sheets[0].rows[0];
    expect(row.modifiers).toHaveLength(0);
    expect(row.cells[0].value).toBe("A");
    expect(ast.diagnostics[0]?.message).toContain("Row references are not supported");
  });

  it("fills empty column cells from column default formulas and literal values", () => {
    const ast = parse(
      '@sheet S\n@header | Status | Qty | Price | Total |\n@defaults | "Pending" | | | =Qty*Price |\n| | 2 | 3 |\n| Done | 4 | 5 | 99 |'
    );
    const sheet = ast.sheets[0];
    const firstDataRow = sheet.rows[1];
    const secondDataRow = sheet.rows[2];

    expect(sheet.rows).toHaveLength(3);
    expect(sheet.columns[0]?.modifiers).toEqual([{ key: "default", value: '"Pending"', raw: 'default:"Pending"' }]);
    expect(sheet.columns[3]?.modifiers).toEqual([{ key: "default", value: "=Qty*Price", raw: "default:=Qty*Price" }]);
    expect(firstDataRow.cells[0]).toMatchObject({ kind: "value", value: "Pending", col: 1 });
    expect(firstDataRow.cells[3]).toMatchObject({ kind: "formula", formula: "=Qty*Price", col: 4 });
    expect(secondDataRow.cells[0]).toMatchObject({ kind: "value", value: "Done", col: 1 });
    expect(secondDataRow.cells[3]).toMatchObject({ kind: "value", value: 99, col: 4 });
  });

  it("parses modifiers attached to formula cells without stripping named row selectors", () => {
    const ast = parse("@sheet S\n| =SUM(A1:A2)[$][2d] | =Orders!Units[2] |");
    const formatted = ast.sheets[0].rows[0].cells[0];
    const singleRowRef = ast.sheets[0].rows[0].cells[1];

    expect(formatted).toMatchObject({ kind: "formula", formula: "=SUM(A1:A2)" });
    expect(formatted.modifiers).toEqual([
      { key: "$", raw: "$" },
      { key: "2d", raw: "2d" }
    ]);
    expect(singleRowRef).toMatchObject({ kind: "formula", formula: "=Orders!Units[2]" });
    expect(singleRowRef.modifiers).toHaveLength(0);
  });

  it("does not treat header, row, or cell default modifiers as generated formulas", () => {
    const ast = parse("@sheet S\n@header | Qty | Price | Total[default:=Qty*Price] |\n[default:=Qty*Price] | 2 | 3 |\n| 4 | 5 | [default:=Qty*Price] |");
    const sheet = ast.sheets[0];

    expect(sheet.columns[2]?.modifiers).toHaveLength(0);
    expect(sheet.rows[1].cells).toHaveLength(2);
    expect(sheet.rows[2].cells[2]).toMatchObject({ kind: "empty" });
    expect(sheet.rows[2].cells[2].formula).toBeUndefined();
  });

  it("parses trailing cell modifiers on formula cells", () => {
    const ast = parse("@sheet S\n| =A1+B1[bold] |");
    const cell = ast.sheets[0].rows[0].cells[0];
    expect(cell.kind).toBe("formula");
    expect(cell.formula).toBe("=A1+B1");
    expect(cell.modifiers).toEqual([{ key: "bold", raw: "bold" }]);
  });

  it("parses bare named color modifiers on formula cells", () => {
    const ast = parse("@sheet S\n| =A1[red] | =B1[color:blue] |");

    expect(ast.sheets[0].rows[0].cells[0]).toMatchObject({
      kind: "formula",
      formula: "=A1",
      modifiers: [{ key: "red", raw: "red" }]
    });
    expect(ast.sheets[0].rows[0].cells[1]).toMatchObject({
      kind: "formula",
      formula: "=B1",
      modifiers: [{ key: "color", value: "blue", raw: "color:blue" }]
    });
    expect(ast.diagnostics).toEqual([]);
  });

  it("keeps unknown trailing formula bracket tokens as formula text without diagnostics", () => {
    const ast = parse("@sheet S\n| =A1[hello] |");
    const cell = ast.sheets[0].rows[0].cells[0];

    expect(cell).toMatchObject({ kind: "formula", formula: "=A1[hello]" });
    expect(cell.modifiers).toEqual([]);
    expect(ast.diagnostics).toEqual([]);
  });

  it("warns for known layout modifiers in trailing formula cell position", () => {
    const ast = parse("@sheet S\n| =A1[width:24] | =B1[height:3] | =C1[wrap] | =D1[fit] |");

    expect(ast.sheets[0].rows[0].cells.map((cell) => cell.formula)).toEqual([
      "=A1[width:24]",
      "=B1[height:3]",
      "=C1[wrap]",
      "=D1[fit]"
    ]);
    expect(ast.sheets[0].rows[0].cells.flatMap((cell) => cell.modifiers)).toEqual([]);
    expect(ast.diagnostics.map((diagnostic) => diagnostic.message)).toEqual([
      "Formula cell modifier [width:24] is a known Cello modifier, but it is not valid on cells. Keeping it as formula text.",
      "Formula cell modifier [height:3] is a known Cello modifier, but it is not valid on cells. Keeping it as formula text.",
      "Formula cell modifier [wrap] is a known Cello modifier, but it is not valid on cells. Keeping it as formula text.",
      "Formula cell modifier [fit] is a known Cello modifier, but it is not valid on cells. Keeping it as formula text."
    ]);
  });

  it("warns for known layout modifiers in default-applied formula cells", () => {
    const ast = parse("@sheet S\n@header | Total |\n@defaults | =A1[width:24] |\n| |");
    const cell = ast.sheets[0].rows[1].cells[0];

    expect(cell).toMatchObject({ kind: "formula", formula: "=A1[width:24]" });
    expect(cell.modifiers).toEqual([]);
    expect(ast.diagnostics.map((diagnostic) => diagnostic.message)).toEqual([
      "Formula cell modifier [width:24] is a known Cello modifier, but it is not valid on cells. Keeping it as formula text."
    ]);
  });

  it("warns and skips non-row lines in native cello sheets", () => {
    const ast = parse("@sheet S\nnot a row\n| ok |");
    expect(ast.diagnostics).toHaveLength(1);
    expect(ast.diagnostics[0]).toMatchObject({
      level: "warning",
      sheet: "S",
      line: 2
    });
    expect(ast.sheets[0].rows).toHaveLength(1);
  });

  it("supports explicit delimiter formats and noheader flag", () => {
    const ast = parse("@sheet S [;:noheader]\na;1");
    const sheet = ast.sheets[0];
    expect(sheet.format).toMatchObject({ kind: "delimited", delimiter: ";", noHeader: true });
    expect(sheet.rows[0].kind).toBe("data");
    expect(sheet.rows[0].cells[0].value).toBe("a");
  });

  it("gracefully handles orphan merge tokens", () => {
    const ast = parse("@sheet S\n| < |\n| ^ |");
    const sheet = ast.sheets[0];
    expect(sheet.rows[0].cells[0]).toMatchObject({ kind: "merge-left", colspan: 0, rowspan: 0 });
    expect(sheet.rows[1].cells[0]).toMatchObject({ kind: "merge-up", colspan: 0, rowspan: 0 });
  });

  it("handles json arrays of objects with nested values stringified", () => {
    const ast = parse('@sheet J [json]\n[{"a":1,"meta":{"x":2}}]');
    const row = ast.sheets[0].rows.find((r) => r.kind === "data");
    expect(row?.cells[0].value).toBe(1);
    expect(row?.cells[1].value).toBe('{"x":2}');
  });

  it("loads external source files via -> path for sheet content", () => {
    const dir = mkdtempSync(join(tmpdir(), "cello-parse-"));
    const source = join(dir, "data.csv");
    writeFileSync(source, "name,amount\nAna,12\nLuis,7\n", "utf8");

    const ast = parse("@sheet Data [csv]\n-> ./data.csv", { baseDir: dir });
    expect(ast.sheets[0].rows[0].kind).toBe("header");
    expect(ast.sheets[0].rows[1].cells[0].value).toBe("Ana");
    expect(ast.sheets[0].rows[2].cells[1].value).toBe(7);
  });

  it("supports an explicit external source loader", () => {
    const ast = parse("@sheet Data [csv]\n-> ./data.csv", {
      baseDir: "/workbook",
      readExternalSource: (path, context) => {
        expect(path).toBe("./data.csv");
        expect(context).toEqual({ baseDir: "/workbook", resolvedPath: "/workbook/data.csv" });
        return "name,amount\nAna,12";
      }
    });

    expect(ast.diagnostics).toHaveLength(0);
    expect(ast.sheets[0].rows[1].cells[0].value).toBe("Ana");
  });
});
