import { describe, expect, it } from "vitest";
import {
  columnLetter,
  escapeHtml,
  inferType,
  isCellModifier,
  isKnownModifier,
  parseModifier,
  parseSheetFormat,
  parseTrailingModifiers,
  splitDelimitedLine,
  workbookHasFormulas
} from "../../../packages/core/src/shared/utils.js";
import { parse } from "../../../packages/core/src/parser/parse.js";

describe("utils", () => {
  it("computes spreadsheet column letters", () => {
    expect(columnLetter(1)).toBe("A");
    expect(columnLetter(26)).toBe("Z");
    expect(columnLetter(27)).toBe("AA");
    expect(columnLetter(52)).toBe("AZ");
    expect(columnLetter(53)).toBe("BA");
  });

  it("escapes HTML special characters", () => {
    expect(escapeHtml(`a&b<c>"'`)).toBe("a&amp;b&lt;c&gt;&quot;&#39;");
  });

  it("parses trailing modifiers", () => {
    const parsed = parseTrailingModifiers("value[bold][bg:red]");
    expect(parsed.base).toBe("value");
    expect(parsed.modifiers).toHaveLength(2);
    expect(parsed.modifiers[0]).toMatchObject({ key: "bold", raw: "bold" });
    expect(parsed.modifiers[1]).toMatchObject({ key: "bg", value: "red", raw: "bg:red" });
  });

  it("parses individual modifier tokens", () => {
    expect(parseModifier("2d")).toMatchObject({ key: "2d", raw: "2d" });
    expect(parseModifier("€")).toMatchObject({ key: "€", raw: "€" });
    expect(parseModifier("%")).toMatchObject({ key: "%", raw: "%" });
    expect(parseModifier("red")).toMatchObject({ key: "red", raw: "red" });
    expect(parseModifier("tone:warn")).toMatchObject({ key: "tone", value: "warn", raw: "tone:warn" });
    expect(parseModifier("default:=Qty*Price")).toMatchObject({ key: "default", value: "=Qty*Price", raw: "default:=Qty*Price" });
    expect(parseModifier("bg:#eee")).toMatchObject({ key: "bg", value: "#eee" });
    expect(parseModifier("#bg:#111:#fff")).toMatchObject({ key: "bgfg", value: "#111:#fff" });
  });

  it("classifies known modifiers by valid scope", () => {
    expect(isCellModifier(parseModifier("bold"))).toBe(true);
    expect(isCellModifier(parseModifier("tone:warn"))).toBe(true);
    expect(isCellModifier(parseModifier("red"))).toBe(true);
    expect(isCellModifier(parseModifier("rebeccapurple"))).toBe(true);
    expect(isCellModifier(parseModifier("width:24"))).toBe(false);
    expect(isCellModifier(parseModifier("height:3"))).toBe(false);
    expect(isCellModifier(parseModifier("wrap"))).toBe(false);
    expect(isCellModifier(parseModifier("fit"))).toBe(false);

    expect(isKnownModifier(parseModifier("bold"))).toBe(true);
    expect(isKnownModifier(parseModifier("red"))).toBe(true);
    expect(isKnownModifier(parseModifier("width:24"))).toBe(true);
    expect(isKnownModifier(parseModifier("height:3"))).toBe(true);
    expect(isKnownModifier(parseModifier("wrap"))).toBe(true);
    expect(isKnownModifier(parseModifier("fit"))).toBe(true);
    expect(isKnownModifier(parseModifier("hello"))).toBe(false);
  });

  it("infers scalar types", () => {
    expect(inferType("42")).toMatchObject({ inferredType: "number", parsed: 42 });
    expect(inferType("TRUE")).toMatchObject({ inferredType: "boolean", parsed: true });
    expect(inferType("FALSE")).toMatchObject({ inferredType: "boolean", parsed: false });
    expect(inferType("2026-05-08")).toMatchObject({ inferredType: "date", parsed: "2026-05-08" });
    expect(inferType('"123"')).toMatchObject({ inferredType: "text", parsed: "123" });
    expect(inferType("hello")).toMatchObject({ inferredType: "text", parsed: "hello" });
    expect(inferType("")).toMatchObject({ inferredType: "empty", parsed: null });
  });

  it("parses supported sheet formats", () => {
    expect(parseSheetFormat(undefined)).toEqual({ kind: "cello" });
    expect(parseSheetFormat("csv")).toMatchObject({ kind: "delimited", delimiter: ",", noHeader: false, alias: "csv" });
    expect(parseSheetFormat("csv:noheader")).toMatchObject({ kind: "delimited", delimiter: ",", noHeader: true, alias: "csv" });
    expect(parseSheetFormat("\\t:noheader")).toMatchObject({ kind: "delimited", delimiter: "\t", noHeader: true });
    expect(parseSheetFormat("markdown")).toEqual({ kind: "markdown" });
    expect(parseSheetFormat("json:$.items")).toEqual({ kind: "json", path: "$.items" });
    expect(parseSheetFormat("unknown")).toEqual({ kind: "cello" });
  });

  it("splits delimited lines with quoted delimiters", () => {
    expect(splitDelimitedLine('A,"B,C",D', ",")).toEqual(["A", "B,C", "D"]);
    expect(splitDelimitedLine('"A""B";C', ";")).toEqual(['A"B', "C"]);
  });

  it("detects whether a workbook has formulas", () => {
    expect(workbookHasFormulas(parse("@sheet S\n| A | 1 |"))).toBe(false);
    expect(workbookHasFormulas(parse("@sheet S\n| A | =A1 |"))).toBe(true);
  });
});
