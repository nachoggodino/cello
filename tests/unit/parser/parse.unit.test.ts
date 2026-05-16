import { describe, expect, it } from "vitest";
import { parse } from "../../../src/parser/parse.js";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("parse (unit-focused edge cases)", () => {
  it("ignores blank lines and preserves compact row numbering", () => {
    const ast = parse("@sheet S\n| A |\n\n| B |");
    const sheet = ast.sheets[0];
    expect(sheet.rows[0].index).toBe(1);
    expect(sheet.rows[1]).toMatchObject({ kind: "data", index: 2 });
    expect(sheet.rows).toHaveLength(2);
  });

  it("marks hidden column from header modifier", () => {
    const ast = parse("@sheet S\n-Visible-Hidden[hidden]-\n| x | y |");
    const sheet = ast.sheets[0];
    expect(sheet.columns[0]).toMatchObject({ name: "Visible", hidden: false });
    expect(sheet.columns[1]).toMatchObject({ name: "Hidden", hidden: true });
  });

  it("parses row names with multiple modifiers", () => {
    const ast = parse("@sheet S\nrow_1[bold][bg:#eee] | A | 1 |");
    const row = ast.sheets[0].rows[0];
    expect(row.name).toBe("row_1");
    expect(row.modifiers).toHaveLength(2);
    expect(row.modifiers[0].key).toBe("bold");
    expect(row.modifiers[1]).toMatchObject({ key: "bg", value: "#eee" });
  });

  it("fills empty column cells from column default formulas", () => {
    const ast = parse("@sheet S\n-Qty-Price-Total[default:=Qty*Price]-\n| 2 | 3 |\n| 4 | 5 | 99 |");
    const sheet = ast.sheets[0];
    const firstDataRow = sheet.rows[1];
    const secondDataRow = sheet.rows[2];

    expect(sheet.columns[2]?.modifiers).toEqual([{ key: "default", value: "=Qty*Price", raw: "default:=Qty*Price" }]);
    expect(firstDataRow.cells[2]).toMatchObject({ kind: "formula", formula: "=Qty*Price", col: 3 });
    expect(secondDataRow.cells[2]).toMatchObject({ kind: "value", value: 99, col: 3 });
  });

  it("does not treat row or cell default modifiers as generated formulas", () => {
    const ast = parse("@sheet S\n-Qty-Price-Total-\nrow_1[default:=Qty*Price] | 2 | 3 |\n| 4 | 5 | [default:=Qty*Price] |");
    const sheet = ast.sheets[0];

    expect(sheet.rows[1].cells).toHaveLength(2);
    expect(sheet.rows[2].cells[2]).toMatchObject({ kind: "empty" });
    expect(sheet.rows[2].cells[2].formula).toBeUndefined();
  });

  it("preserves formula cells including trailing modifier-like text", () => {
    const ast = parse("@sheet S\n| =A1+B1[bold] |");
    const cell = ast.sheets[0].rows[0].cells[0];
    expect(cell.kind).toBe("formula");
    expect(cell.formula).toBe("=A1+B1[bold]");
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
});
