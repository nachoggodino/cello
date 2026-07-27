import { describe, expect, it } from "vitest";
import { format } from "../../../packages/core/src/formatter/format.js";

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
});
