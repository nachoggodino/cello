import { describe, expect, it } from "vitest";
import { serialize } from "../../../src/serializer/serialize.js";
import type { WorkbookAst } from "../../../src/shared/types.js";
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
});
