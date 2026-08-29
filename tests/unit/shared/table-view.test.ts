import { describe, expect, it } from "vitest";
import {
  canonicalizeViewColumns,
  matchesViewFilter,
  parseViewFilter,
  projectTableView,
  type TableViewCellValue,
  type TableViewRow
} from "../../../packages/core/src/shared/table-view.js";

const text = (value: string): TableViewCellValue => ({ display: value, type: "text", value });
const number = (value: number): TableViewCellValue => ({ display: String(value), type: "number", value });
const blank: TableViewCellValue = { display: "", type: "empty", value: null };
const boolean = (value: boolean): TableViewCellValue => ({ display: value ? "TRUE" : "FALSE", type: "boolean", value });

describe("table views", () => {
  it("supports contains, wildcard, exact, blank, and numeric comparison filters", () => {
    expect(matchesViewFilter(text("Madrid"), "mad")).toBe(true);
    expect(matchesViewFilter(text("Madrid"), "m*d")).toBe(true);
    expect(matchesViewFilter(text("Madrid"), "=madrid")).toBe(true);
    expect(matchesViewFilter(blank, "is:blank")).toBe(true);
    expect(matchesViewFilter(text("Madrid"), "is:notblank")).toBe(true);
    expect(matchesViewFilter(number(101), ">100")).toBe(true);
    expect(matchesViewFilter(text("not a number"), ">100")).toBe(false);
    expect(matchesViewFilter(text("101"), ">100")).toBe(false);
    expect(matchesViewFilter(boolean(true), ">0")).toBe(false);
    expect(matchesViewFilter(blank, ">=-1")).toBe(false);
    expect(matchesViewFilter(number(-1.5), "<-1.25")).toBe(true);
    expect(matchesViewFilter(number(1000), ">=1e3")).toBe(true);
    expect(parseViewFilter(">large")).toBeUndefined();
    expect(parseViewFilter(">")).toBeUndefined();
  });

  it("matches text deterministically without depending on the process locale", () => {
    expect(matchesViewFilter(text("İstanbul"), "istanbul")).toBe(false);
    expect(matchesViewFilter(text("Istanbul"), "ISTANBUL")).toBe(true);
    expect(matchesViewFilter(text("a.b"), "a.*")).toBe(true);
    expect(matchesViewFilter(text("axb"), "a.*")).toBe(false);
  });

  it("canonicalizes semantically empty trailing view columns", () => {
    expect(canonicalizeViewColumns([{ filter: "mad" }, {}, {}])).toEqual([{ filter: "mad" }]);
    expect(canonicalizeViewColumns([{}, { sort: "asc" }, {}])).toEqual([{}, { sort: "asc" }]);
  });

  it("keeps headers fixed and stably sorts each repeated-header section with blanks last", () => {
    const rows: TableViewRow[] = [
      { rowIndex: 0, header: true, cells: [text("Name"), text("Score")] },
      { rowIndex: 1, header: false, cells: [text("Beta"), number(2)] },
      { rowIndex: 2, header: false, cells: [text("Alpha"), number(2)] },
      { rowIndex: 3, header: false, cells: [text("Empty"), blank] },
      { rowIndex: 4, header: true, cells: [text("Name"), text("Score")] },
      { rowIndex: 5, header: false, cells: [text("Gamma"), number(1)] },
      { rowIndex: 6, header: false, cells: [text("Delta"), number(3)] }
    ];

    expect(projectTableView(rows, [{}, { sort: "desc" }])).toEqual({
      visibleRowIndices: [0, 1, 2, 3, 4, 6, 5],
      hiddenRowCount: 0
    });
  });

  it("combines column filters with AND and reports hidden rows", () => {
    const rows: TableViewRow[] = [
      { rowIndex: 0, header: false, cells: [text("Madrid"), number(120)] },
      { rowIndex: 1, header: false, cells: [text("Madrid"), number(80)] },
      { rowIndex: 2, header: false, cells: [text("Bilbao"), number(140)] }
    ];

    expect(projectTableView(rows, [{ filter: "mad" }, { filter: ">100" }])).toEqual({
      visibleRowIndices: [0],
      hiddenRowCount: 2
    });
  });

  it("filters and sorts repeated-header sections independently, including consecutive headers", () => {
    const rows: TableViewRow[] = [
      { rowIndex: 0, header: true, cells: [text("Name"), text("Score")] },
      { rowIndex: 1, header: true, cells: [text("Name"), text("Score")] },
      { rowIndex: 2, header: false, cells: [text("Match B"), number(2)] },
      { rowIndex: 3, header: false, cells: [text("Skip"), number(9)] },
      { rowIndex: 4, header: true, cells: [text("Name"), text("Score")] },
      { rowIndex: 5, header: false, cells: [text("Match A"), number(1)] },
      { rowIndex: 6, header: false, cells: [text("Match C"), number(3)] }
    ];

    expect(projectTableView(rows, [{ filter: "match" }, { sort: "desc" }])).toEqual({
      visibleRowIndices: [0, 1, 2, 4, 6, 5],
      hiddenRowCount: 1
    });
  });
});
