import { describe, expect, it } from "vitest";
import { format } from "../../../packages/core/src/formatter/format.js";
import { formatSource } from "../../../packages/core/src/formatter/source-layout.js";
import { parse } from "../../../packages/core/src/parser/parse.js";

describe("format", () => {
  it("aligns contiguous native cello table blocks", () => {
    const source = [
      "@sheet Report",
      "@header | KPI | Amount[€][2d] | Units |",
      "| Sales | =SUM(Sales!amount[*]) | =SUM(Sales!units[*]) |",
      "[bold] | Total | 100 | 20 |"
    ].join("\n");

    expect(format(source)).toBe(
      [
        "@sheet Report",
        "@header | KPI   | Amount[€][2d]         | Units                |",
        "        | Sales | =SUM(Sales!amount[*]) | =SUM(Sales!units[*]) |",
        "[bold]  | Total | 100                   | 20                   |"
      ].join("\n")
    );
  });

  it("preserves comments, blank lines, and non-cello sheet bodies", () => {
    const source = [
      "// keep",
      "@sheet Report",
      "@header | A | B |",
      "| 1 | 2 |",
      "",
      "@sheet Raw [csv]",
      "a,b",
      "1,2"
    ].join("\n");

    expect(format(source)).toBe(
      [
        "// keep",
        "@sheet Report",
        "@header | A | B |",
        "        | 1 | 2 |",
        "",
        "@sheet Raw [csv]",
        "a,b",
        "1,2"
      ].join("\n")
    );
  });

  it("leaves unsupported row prefixes untouched", () => {
    const source = "@sheet Report\nA1 | bad | row |\n| ok | row |";
    expect(format(source)).toBe("@sheet Report\nA1 | bad | row |\n| ok | row |");
  });

  it("is idempotent", () => {
    const source = "@sheet Report\n@header | A | B |\n| 1 | 22 |";
    const once = format(source);
    expect(format(once)).toBe(once);
  });

  it("compacts structural table whitespace while retaining outer pipes", () => {
    const source = [
      "@sheet Report",
      "@header   | KPI   | Amount |",
      "          | Sales | 5      |",
      "[bold]    | Total | 5      |"
    ].join("\n");

    expect(formatSource(source, { layout: "compact" })).toBe([
      "@sheet Report",
      "@header |KPI|Amount|",
      "|Sales|5|",
      "[bold]|Total|5|"
    ].join("\n"));
  });

  it("does not materialize omitted cells while pretty-printing", () => {
    const source = [
      "@sheet Report",
      "@header | Name | Status | Total |",
      "@defaults | | Pending | =1 |",
      "| Ada |"
    ].join("\n");
    const pretty = formatSource(source, { layout: "pretty" });

    expect(pretty.split("\n")[3]).toBe("          | Ada  |");
    expect(parse(pretty)).toEqual(parse(source));
  });

  it("formats only table blocks intersecting a requested range", () => {
    const source = "@sheet Report\n| A | 1 |\n\n| B | 22 |";
    const secondBlock = source.indexOf("| B");

    expect(formatSource(source, {
      layout: "compact",
      range: { start: secondBlock, end: secondBlock }
    })).toBe("@sheet Report\n| A | 1 |\n\n|B|22|");
  });

  it("preserves CRLF and unrelated malformed source", () => {
    const source = "@sheet Report\r\n@header | A | B |\r\nnot a row\r\n| 1 | 2 |\r\n";
    const compact = formatSource(source, { layout: "compact" });

    expect(compact).toBe("@sheet Report\r\n@header |A|B|\r\nnot a row\r\n|1|2|\r\n");
    expect(formatSource(compact, { layout: "compact" })).toBe(compact);
  });
});
