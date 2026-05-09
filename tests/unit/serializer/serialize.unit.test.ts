import { describe, expect, it } from "vitest";
import { serialize } from "../../../src/serializer/serialize.js";
import type { WorkbookAst } from "../../../src/shared/types.js";

function createWorkbook(format: WorkbookAst["sheets"][number]["format"], rows: WorkbookAst["sheets"][number]["rows"]): WorkbookAst {
  return {
    version: "1.0",
    diagnostics: [],
    sheets: [
      {
        name: "S",
        format,
        rows,
        columns: [
          { index: 1, letter: "A", name: "Price", modifiers: [], hidden: false },
          { index: 2, letter: "B", name: "Stock", modifiers: [], hidden: false }
        ]
      }
    ]
  };
}

describe("serialize (unit-focused behavior)", () => {
  it("serializes json and delimited format tokens accurately", () => {
    const jsonAst = createWorkbook(
      { kind: "json", path: "$.items" },
      [
        {
          index: 1,
          kind: "data",
          sourceLine: 1,
          modifiers: [],
          cells: [
            {
              row: 1,
              col: 1,
              raw: "1",
              kind: "value",
              inferredType: "number",
              value: 1,
              modifiers: [],
              colspan: 1,
              rowspan: 1
            }
          ]
        }
      ]
    );
    expect(serialize(jsonAst)).toContain("@sheet S [json:$.items]");

    const tsvAst = createWorkbook(
      { kind: "delimited", delimiter: "\t", noHeader: true },
      [
        {
          index: 1,
          kind: "data",
          sourceLine: 1,
          modifiers: [],
          cells: [
            {
              row: 1,
              col: 1,
              raw: "a",
              kind: "value",
              inferredType: "text",
              value: "a",
              modifiers: [],
              colspan: 1,
              rowspan: 1
            }
          ]
        }
      ]
    );
    expect(serialize(tsvAst)).toContain("@sheet S [\\t:noheader]");
  });

  it("serializes header modifiers and data rows", () => {
    const ast = createWorkbook(
      { kind: "cello" },
      [
        {
          index: 1,
          kind: "header",
          sourceLine: 1,
          modifiers: [],
          cells: [
            {
              row: 1,
              col: 1,
              raw: "Price",
              kind: "value",
              inferredType: "text",
              value: "Price",
              modifiers: [{ raw: "€", key: "€" }, { raw: "2d", key: "2d" }],
              colspan: 1,
              rowspan: 1
            }
          ]
        },
        {
          index: 2,
          kind: "data",
          sourceLine: 2,
          modifiers: [],
          cells: [
            {
              row: 2,
              col: 1,
              raw: "10",
              kind: "value",
              inferredType: "number",
              value: 10,
              modifiers: [],
              colspan: 1,
              rowspan: 1
            }
          ]
        }
      ]
    );
    const out = serialize(ast);
    expect(out).toContain("-Price[€][2d]-");
    expect(out).toContain("\n| 10 |");
  });

  it("serializes booleans and numbers as plain literals", () => {
    const ast = createWorkbook(
      { kind: "cello" },
      [
        {
          index: 1,
          kind: "data",
          sourceLine: 1,
          modifiers: [],
          cells: [
            {
              row: 1,
              col: 1,
              raw: "TRUE",
              kind: "value",
              inferredType: "boolean",
              value: true,
              modifiers: [],
              colspan: 1,
              rowspan: 1
            },
            {
              row: 1,
              col: 2,
              raw: "42",
              kind: "value",
              inferredType: "number",
              value: 42,
              modifiers: [],
              colspan: 1,
              rowspan: 1
            }
          ]
        }
      ]
    );
    const out = serialize(ast);
    expect(out).toContain("| TRUE | 42 |");
  });
});
