import { describe, expect, it } from "vitest";
import { parse } from "../../../packages/core/src/parser/parse.js";
import { serialize } from "../../../packages/core/src/serializer/serialize.js";
import type { WorkbookAst } from "../../../packages/core/src/shared/types.js";
import { dataRow, headerRow, sheet, valueCell, workbook } from "../../helpers/ast.js";

function createWorkbook(format: WorkbookAst["sheets"][number]["format"], rows: WorkbookAst["sheets"][number]["rows"]) {
  return workbook([sheet({ name: "S", format, columns: ["Price", "Stock"], rows })]);
}

describe("serialize (unit-focused behavior)", () => {
  it("serializes json and delimited format tokens accurately", () => {
    const jsonAst = createWorkbook(
      { kind: "json", path: "$.items" },
      [
        {
          ...dataRow(1, [valueCell(1, 1, 1)])
        }
      ]
    );
    expect(serialize(jsonAst)).toContain("@sheet S [json:$.items]");

    const tsvAst = createWorkbook(
      { kind: "delimited", delimiter: "\t", noHeader: true },
      [
        {
          ...dataRow(1, [valueCell(1, 1, "a")])
        }
      ]
    );
    expect(serialize(tsvAst)).toContain("@sheet S [\\t:noheader]");
  });

  it("serializes header modifiers and data rows", () => {
    const ast = createWorkbook(
      { kind: "cello" },
      [
        headerRow(1, [{ name: "Price", modifiers: [{ raw: "€", key: "€" }, { raw: "2d", key: "2d" }] }]),
        dataRow(2, [valueCell(2, 1, 10)])
      ]
    );
    const out = serialize(ast);
    expect(out).toContain("@header | Price[€][2d] |");
    expect(out).toContain("\n| 10 |");
  });

  it("serializes column defaults declared outside the header", () => {
    const out = serialize(parse("@sheet S\n@header | Qty | Price | Total |\n@defaults | | | =Qty*Price |\n| 2 | 3 |"));
    expect(out).toContain("@header | Qty | Price | Total |");
    expect(out).toContain("@defaults |  |  | =Qty*Price |");
  });

  it("serializes literal defaults and formula cell modifiers", () => {
    const out = serialize(parse('@sheet S\n@header | Status | Amount |\n@defaults | "Pending" | |\n| | =SUM(A1:A1)[$][2d] |'));

    expect(out).toContain('@defaults | "Pending" |  |');
    expect(out).toContain("| Pending | =SUM(A1:A1)[$][2d] |");
  });

  it("serializes booleans and numbers as plain literals", () => {
    const ast = createWorkbook(
      { kind: "cello" },
      [
        dataRow(1, [valueCell(1, 1, true), valueCell(1, 2, 42)])
      ]
    );
    const out = serialize(ast);
    expect(out).toContain("| TRUE | 42 |");
  });

  it("serializes layout aliases and sheet modifiers", () => {
    const out = serialize(parse("@tone notes [color:#334155][bg:#f8fafc]\n@width description [width:large]\n\n@sheet Roadmap [columns:fit][rows:wrap]\n@header | Status[width:xshort] | Description[width:description] |\n[wrap][height:3] | ok | Long content |"));

    expect(out).toContain("@tone notes [color:#334155][bg:#f8fafc]");
    expect(out).toContain("@width description [width:large]");
    expect(out).toContain("@sheet Roadmap [columns:fit][rows:wrap]");
    expect(out).toContain("@header | Status[width:xshort] | Description[width:description] |");
    expect(out).toContain("[wrap][height:3] | ok | Long content |");
  });

  it("round-trips layout declarations through the parser", () => {
    const source = "@tone notes [color:#334155][bg:#f8fafc]\n@width description [width:large]\n@height note [height:3]\n\n@sheet Roadmap [columns:fit][rows:wrap]\n@header | Status[width:xshort] | Description[width:description] |\n[wrap][height:note] | ok[tone:notes] | Long content |";
    const first = parse(source);
    const second = parse(serialize(first));

    expect(second.aliases).toEqual(first.aliases);
    expect(second.sheets[0]?.layout).toEqual(first.sheets[0]?.layout);
    expect(second.sheets[0]?.columns.map((column) => column.modifiers)).toEqual(first.sheets[0]?.columns.map((column) => column.modifiers));
    expect(second.sheets[0]?.rows.map((row) => row.modifiers)).toEqual(first.sheets[0]?.rows.map((row) => row.modifiers));
  });
});
