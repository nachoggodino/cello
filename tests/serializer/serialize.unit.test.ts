import { describe, expect, it } from "vitest";
import { parse } from "../../src/parser/parse.js";
import { serialize } from "../../src/serializer/serialize.js";

describe("serialize (unit-focused behavior)", () => {
  it("serializes json and delimited format tokens accurately", () => {
    const jsonAst = parse('@sheet J [json:$.items]\n[{"a":1}]');
    expect(serialize(jsonAst)).toContain("@sheet J [json:$.items]");

    const tsvAst = parse("@sheet T [\\t:noheader]\na\t1");
    expect(serialize(tsvAst)).toContain("@sheet T [\\t:noheader]");
  });

  it("serializes header modifiers and ignores blank lines", () => {
    const ast = parse("@sheet S\n-Price[€][2d]-\n| 10 |\n\n| 11 |");
    const out = serialize(ast);
    expect(out).toContain("-Price[€][2d]-");
    expect(out).not.toContain("\n\n| 11 |");
    expect(out).toContain("\n| 10 |\n| 11 |");
  });

  it("serializes booleans and numbers as plain literals", () => {
    const ast = parse("@sheet S\n| TRUE | 42 |");
    const out = serialize(ast);
    expect(out).toContain("| TRUE | 42 |");
  });
});

