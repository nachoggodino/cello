import { describe, expect, it } from "vitest";
import {
  matchesViewFilter,
  parseViewFilter,
  projectTableView,
  type TableViewCellValue,
  type TableViewRow
} from "../../../packages/core/src/shared/table-view.js";

const text = (value: string): TableViewCellValue => ({ display: value, type: "text", value });
const number = (value: number): TableViewCellValue => ({ display: String(value), type: "number", value });
const blank: TableViewCellValue = { display: "", type: "empty", value: null };

describe("table views", () => {
  it("supports contains, wildcard, exact, blank, and numeric comparison filters", () => {
    expect(matchesViewFilter(text("Madrid"), "mad")).toBe(true);
    expect(matchesViewFilter(text("Madrid"), "m*d")).toBe(true);
    expect(matchesViewFilter(text("Madrid"), "=madrid")).toBe(true);
    expect(matchesViewFilter(blank, "is:blank")).toBe(true);
    expect(matchesViewFilter(text("Madrid"), "is:notblank")).toBe(true);
    expect(matchesViewFilter(number(101), ">100")).toBe(true);
    expect(matchesViewFilter(text("not a number"), ">100")).toBe(false);
    expect(parseViewFilter(">large")).toBeUndefined();
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
});
