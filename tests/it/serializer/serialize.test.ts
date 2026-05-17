import { describe, expect, it } from "vitest";
import { parse } from "../../../src/parser/parse.js";
import { serialize } from "../../../src/serializer/serialize.js";

describe("serialize", () => {
  it("serializes native rows, row modifiers and merge tokens", () => {
    const text = "@sheet Main\n@header | Label | Value |\n[bold] | A | 1 |\n| B | < |\n| ^ | 2 |";
    const ast = parse(text);
    const out = serialize(ast);

    expect(out).toContain("@sheet Main");
    expect(out).toContain("@header | Label | Value |");
    expect(out).toContain("[bold] | A | 1 |");
    expect(out).toContain("| B | < |");
    expect(out).toContain("| ^ | 2 |");
  });

  it("serializes format tokens", () => {
    const text = "@sheet Csv [csv]\na,b\n1,2\n@sheet Md [markdown]\n| x | y |\n| - | - |\n| 1 | 2 |";
    const ast = parse(text);
    const out = serialize(ast);

    expect(out).toContain("@sheet Csv [csv]");
    expect(out).toContain("@sheet Md [markdown]");
  });

  it("roundtrips through parse -> serialize -> parse preserving structure", () => {
    const source = "@sheet One\n| A | 1 |\n\n@sheet Two [csv]\nname,age\nAna,25";
    const ast1 = parse(source);
    const ser = serialize(ast1);
    const ast2 = parse(ser);

    expect(ast2.sheets).toHaveLength(ast1.sheets.length);
    expect(ast2.sheets[0].rows.length).toBeGreaterThan(0);
    expect(ast2.sheets[1].name).toBe("Two");
  });
});

