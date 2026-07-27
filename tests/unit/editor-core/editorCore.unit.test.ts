import { describe, expect, it } from "vitest";
import {
  addColumn,
  addRow,
  addSheet,
  createEditorWorkbook,
  DEFAULT_SHEET_NAME,
  ensureColumnHeaderRow,
  evaluateEditorWorkbookSource,
  getCellAddressKey,
  getCellAt,
  getCellDisplayText,
  getCellSourceText,
  getCellStyle,
  getCellToneClass,
  getColumnName,
  getDefaultCellAt,
  getInheritedModifierGroups,
  getRowAt,
  getScopedColorValue,
  getSelectedCell,
  getVisibleColumnCount,
  getVisibleRowCount,
  getVisualCellSpan,
  hasScopedModifier,
  isMergeToken,
  mergeCell,
  parseCellSource,
  rejectExternalSource,
  removeSheet,
  renameSheet,
  resolveEditorLayoutOptions,
  serializeEditorWorkbook,
  setCellColorModifier,
  setCellToneModifier,
  setColumnColorModifier,
  setRowColorModifier,
  setRowToneModifier,
  toggleCellModifier,
  toggleColumnModifier,
  toggleRowModifier,
  updateDefaultCellSource,
  updateCellRaw,
  updateCellSource
} from "@cello/editor-core";

describe("editor core", () => {
  it("loads native cello sheets and serializes editable cells", () => {
    const workbook = createEditorWorkbook("@sheet Report\n@header | Name | Amount |\n| Ada | 5 |\n| Total | =SUM(Amount) |");
    const updated = updateCellRaw(workbook, { sheetIndex: 0, rowIndex: 1, colIndex: 1 }, "7");

    expect(serializeEditorWorkbook(updated)).toContain("@header | Name | Amount");
    expect(serializeEditorWorkbook(updated)).toContain("| Ada | 7");
    expect(serializeEditorWorkbook(updated)).toContain("| Total | =SUM(Amount)");
  });

  it("loads all workbook sheets into the visual model", () => {
    const workbook = createEditorWorkbook(`
@sheet Native
| A |

@sheet Md [markdown]
| label | score |
|------|------:|
| quality | 9 |

@sheet Json [json]
[
  {"team":"A","bugs":2}
]
`.trim());

    expect(workbook.sheets.map((sheet) => sheet.name)).toEqual(["Native", "Md", "Json"]);
    expect(workbook.sheets[1]?.rows[0]?.kind).toBe("header");
    expect(workbook.sheets[2]?.rows[0]?.cells[0]?.raw).toBe("team");
    expect(workbook.sheets[2]?.rows[1]?.cells[0]?.raw).toBe("A");
  });

  it("creates a blank sheet for empty source", () => {
    expect(createEditorWorkbook("").sheets).toEqual([{ name: "Sheet1", rows: [], defaults: [] }]);
  });

  it("uses host-provided parse options for anonymous sheets and external sources", () => {
    const workbook = createEditorWorkbook("@sheet Imported\n-> data.cel", {
      anonymousSheetName: "Fallback",
      readExternalSource: (path) => {
        expect(path).toBe("data.cel");
        return "| Ada | 5 |";
      }
    });

    expect(serializeEditorWorkbook(workbook)).toBe("@sheet Imported\n| Ada | 5 |");
  });

  it("forwards parser options when creating editable workbooks", () => {
    const workbook = createEditorWorkbook("| Ada |", {
      anonymousSheetName: "Anon",
      baseDir: "/tmp",
      strict: false
    });

    expect(workbook.sheets[0]?.name).toBe("Anon");
  });

  it("does not load external sources without a host resolver", () => {
    expect(serializeEditorWorkbook(createEditorWorkbook("@sheet Imported\n-> data.cel"))).toBe("@sheet Imported");
    expect(() => rejectExternalSource("other.cel")).toThrow("other.cel");
  });

  it("writes style modifiers on normal cells", () => {
    const workbook = createEditorWorkbook("@sheet Report\n| Ada | 5 |");
    const selected = { sheetIndex: 0, rowIndex: 0, colIndex: 0 };
    const updated = setCellColorModifier(
      setCellColorModifier(toggleCellModifier(toggleCellModifier(workbook, selected, "bold"), selected, "italic"), selected, "color", "#123456"),
      selected,
      "bg",
      "#abcdef"
    );

    expect(serializeEditorWorkbook(updated)).toContain("Ada[bold][italic][color:#123456][bg:#abcdef]");
  });

  it("shows full cell source while keeping display text clean", () => {
    const workbook = createEditorWorkbook("@sheet Report\n| \"123\"[bold][color:#123456] |");
    const selected = getSelectedCell(workbook, { sheetIndex: 0, rowIndex: 0, colIndex: 0 });

    expect(getCellSourceText(selected)).toBe("\"123\"[bold][color:#123456]");
    expect(getCellDisplayText(selected)).toBe("\"123\"");
  });

  it("parses source text modifiers and merge tokens", () => {
    expect(parseCellSource("Ada[bold][color:#123456]")).toEqual({
      raw: "Ada",
      modifiers: [
        { raw: "bold", key: "bold" },
        { raw: "color:#123456", key: "color", value: "#123456" }
      ]
    });
    expect(parseCellSource("Total[#bg:#111:#fff]")).toEqual({
      raw: "Total",
      modifiers: [{ raw: "#bg:#111:#fff", key: "bgfg", value: "#111:#fff" }]
    });
    expect(parseCellSource("<[bold]")).toEqual({ raw: "<", modifiers: [] });
    expect(parseCellSource("Ada]")).toEqual({ raw: "Ada]", modifiers: [] });
    expect(parseCellSource("Ada[bad[modifier]]")).toEqual({ raw: "Ada[bad[modifier]]", modifiers: [] });
    expect(isMergeToken("^")).toBe(true);
  });

  it("writes merge tokens without style modifiers", () => {
    const workbook = createEditorWorkbook("@sheet Report\n| Ada | 5 |\n| Ops | 2 |");
    const mergedLeft = mergeCell(workbook, { sheetIndex: 0, rowIndex: 0, colIndex: 1 }, "left");
    const mergedUp = mergeCell(mergedLeft, { sheetIndex: 0, rowIndex: 1, colIndex: 0 }, "up");

    expect(serializeEditorWorkbook(mergedUp)).toContain("| Ada | < |");
    expect(serializeEditorWorkbook(mergedUp)).toContain("| ^ | 2 |");
    expect(mergeCell(workbook, { sheetIndex: 0, rowIndex: 0, colIndex: 0 }, "left")).toBe(workbook);
    expect(mergeCell(workbook, { sheetIndex: 0, rowIndex: 0, colIndex: 0 }, "up")).toBe(workbook);
  });

  it("does not apply cell style modifiers to merge cells", () => {
    const workbook = createEditorWorkbook("@sheet Report\n| Ada | < |");
    const address = { sheetIndex: 0, rowIndex: 0, colIndex: 1 };
    const toggled = toggleCellModifier(workbook, address, "bold");
    const colored = setCellColorModifier(workbook, address, "bg", "#abcdef");
    const toned = setCellToneModifier(workbook, address, "ok");

    expect(getSelectedCell(toggled, address)).toEqual({ raw: "<", modifiers: [] });
    expect(getSelectedCell(colored, address)).toEqual({ raw: "<", modifiers: [] });
    expect(getSelectedCell(toned, address)).toEqual({ raw: "<", modifiers: [] });
  });

  it("adds rows, columns, and sheets", () => {
    const workbook = createEditorWorkbook("@sheet Report\n| Ada | 5 |");
    const updated = addSheet(addColumn(addRow(workbook, 0), 0));

    expect(updated.sheets).toHaveLength(2);
    expect(updated.sheets[0]?.rows.length).toBe(2);
    expect(updated.sheets[0]?.rows[0]?.cells.length).toBe(3);
    expect(serializeEditorWorkbook(updated)).toContain("@sheet Sheet2");
  });

  it("inserts rows and columns after the selected cell", () => {
    const workbook = createEditorWorkbook("@sheet Report\n| A | B |\n| C | D |");
    const updated = addColumn(addRow(workbook, 0, undefined, 0), 0, 0);

    expect(serializeEditorWorkbook(updated)).toBe("@sheet Report\n| A |  | B |\n|  |\n| C |  | D |");
  });

  it("generates the next available sheet name", () => {
    const workbook = createEditorWorkbook("@sheet Sheet2\n| A |\n\n@sheet Sheet3\n| B |");

    expect(addSheet(workbook).sheets[2]?.name).toBe("Sheet4");
  });

  it("removes sheets but keeps one sheet available", () => {
    const workbook = createEditorWorkbook("@sheet Report\n| Ada | 5 |\n\n@sheet Archive\n| Grace | 7 |");
    const updated = removeSheet(workbook, 0);
    const unchanged = removeSheet(updated, 0);

    expect(updated.sheets.map((sheet) => sheet.name)).toEqual(["Archive"]);
    expect(unchanged.sheets.map((sheet) => sheet.name)).toEqual(["Archive"]);
    expect(removeSheet(workbook, 99)).toBe(workbook);
  });

  it("renames sheets and sanitizes sheet names when serialized", () => {
    const workbook = createEditorWorkbook("@sheet Report\n| Ada |");
    const renamed = renameSheet(workbook, 0, "  New[Name] ");
    const unchanged = renameSheet(workbook, 0, "   ");
    const invalidName = {
      sheets: [{ name: "[]", rows: [] }]
    };

    expect(renamed.sheets[0]?.name).toBe("New[Name]");
    expect(unchanged.sheets[0]?.name).toBe("Report");
    expect(serializeEditorWorkbook(renamed)).toContain("@sheet NewName");
    expect(serializeEditorWorkbook(invalidName)).toBe(`@sheet ${DEFAULT_SHEET_NAME}`);
  });

  it("supports row and column scoped modifiers", () => {
    const workbook = createEditorWorkbook("@sheet Report\n| Ada | 5 |");
    const rowAddress = { sheetIndex: 0, rowIndex: 0, colIndex: 0 };
    const rowUpdated = setRowColorModifier(toggleRowModifier(workbook, rowAddress, "bold"), rowAddress, "bg", "#abcdef");
    const resolution = ensureColumnHeaderRow(rowUpdated, 0);
    const columnUpdated = setColumnColorModifier(toggleColumnModifier(resolution.workbook, 0, resolution.headerRowIndex, 1, "italic"), 0, 0, 1, "color", "#123456");

    expect(serializeEditorWorkbook(columnUpdated)).toContain("[bold][bg:#abcdef] | Ada | 5 |");
    expect(serializeEditorWorkbook(columnUpdated)).toContain("@header |  | [italic][color:#123456] |");
  });

  it("uses existing header rows for column modifiers", () => {
    const workbook = createEditorWorkbook("@sheet Report\n@header | Name | Amount |\n| Ada | 5 |");
    const resolution = ensureColumnHeaderRow(workbook, 0);

    expect(resolution).toMatchObject({ headerRowIndex: 0, rowOffset: 0 });
    expect(resolution.workbook).toBe(workbook);
  });

  it("returns unchanged header resolution when sheet is missing", () => {
    const workbook = createEditorWorkbook("@sheet Report\n| Ada |");

    expect(ensureColumnHeaderRow(workbook, 9)).toEqual({ workbook, headerRowIndex: 0, rowOffset: 0 });
  });

  it("derives display style and scoped toolbar values", () => {
    const workbook = createEditorWorkbook("@sheet Report\n@header | Name[italic][color:#222222] |\n[bold][bg:#abcdef] | Ada[color:#111111] |");
    const sheet = workbook.sheets[0];
    const address = { sheetIndex: 0, rowIndex: 1, colIndex: 0 };

    expect(getCellStyle(sheet, 1, 0)).toEqual({
      color: "#111111",
      background: "#abcdef",
      fontStyle: "italic",
      fontWeight: 700
    });
    expect(hasScopedModifier(sheet, address, "row", "bold")).toBe(true);
    expect(hasScopedModifier(sheet, address, "column", "italic")).toBe(true);
    expect(getScopedColorValue(sheet, address, "cell", "color", "#000000")).toBe("#111111");
    expect(getScopedColorValue(sheet, address, "row", "color", "#000000")).toBe("#000000");
  });

  it("derives visual display for inline text styles and tones", () => {
    const workbook = createEditorWorkbook("@sheet Report\n@header | Name[tone:accent] | State |\n[tone:muted] | ## Total[strike] | ok[tone:ok] |");
    const sheet = workbook.sheets[0];

    expect(getCellDisplayText(getCellAt(sheet, 1, 0))).toBe("Total");
    expect(getCellStyle(sheet, 1, 0)).toEqual({ fontSize: "1.25rem", fontWeight: 700, textDecoration: "line-through" });
    expect(getCellDisplayText({ raw: "_Italic_", modifiers: [] })).toBe("Italic");
    expect(getCellStyle({ name: "S", rows: [{ kind: "data", modifiers: [], cells: [{ raw: "_Italic_", modifiers: [] }, { raw: "*Bold*", modifiers: [] }] }], defaults: [] }, 0, 0)).toEqual({ fontStyle: "italic" });
    expect(getCellStyle({ name: "S", rows: [{ kind: "data", modifiers: [], cells: [{ raw: "_Italic_", modifiers: [] }, { raw: "*Bold*", modifiers: [] }] }], defaults: [] }, 0, 1)).toEqual({ fontWeight: 700 });
    expect(getCellToneClass(sheet, 1, 0)).toBe("celloVisualTone-muted");
    expect(getCellToneClass(sheet, 1, 1)).toBe("celloVisualTone-ok");
    expect(getCellDisplayText({ raw: "~~Done~~", modifiers: [] })).toBe("Done");

    const tonedCell = setCellToneModifier(workbook, { sheetIndex: 0, rowIndex: 1, colIndex: 0 }, "warn");
    const untonedCell = setCellToneModifier(tonedCell, { sheetIndex: 0, rowIndex: 1, colIndex: 0 }, "warn");
    const tonedRow = setRowToneModifier(workbook, { sheetIndex: 0, rowIndex: 1, colIndex: 0 }, "info");
    expect(serializeEditorWorkbook(tonedCell)).toContain("## Total[strike][tone:warn]");
    expect(serializeEditorWorkbook(untonedCell)).toContain("## Total[strike] |");
    expect(serializeEditorWorkbook(tonedRow)).toContain("[tone:info] | ## Total[strike] |");
  });

  it("computes visual merge spans and hidden continuation cells", () => {
    const workbook = createEditorWorkbook("@sheet Report\n| A | < | < |\n| ^ | < | < |\n| B | C | D |");
    const sheet = workbook.sheets[0];

    expect(getVisualCellSpan(sheet, 0, 0)).toEqual({ hidden: false, colspan: 3, rowspan: 2 });
    expect(getVisualCellSpan(sheet, 0, 1)).toEqual({ hidden: true, colspan: 1, rowspan: 1 });
    expect(getVisualCellSpan(sheet, 1, 0)).toEqual({ hidden: true, colspan: 1, rowspan: 1 });
    expect(getVisualCellSpan(sheet, 2, 1)).toEqual({ hidden: false, colspan: 1, rowspan: 1 });
  });

  it("loads, edits, serializes, and reports default values", () => {
    const workbook = createEditorWorkbook("@sheet Report\n@header | Name[italic] | Amount |\n@defaults | Pending | =Amount*2 |\n| Ada | |");
    const sheet = workbook.sheets[0];

    expect(getDefaultCellAt(sheet, 0).raw).toBe("Pending");
    expect(getInheritedModifierGroups(sheet, 1, 0)).toEqual([
      { scope: "default", modifiers: [{ raw: "default:Pending", key: "default", value: "Pending" }] },
      { scope: "column", modifiers: [{ raw: "italic", key: "italic" }] }
    ]);

    const updated = updateDefaultCellSource(workbook, 0, 1, "=Amount*3");
    expect(serializeEditorWorkbook(updated)).toContain("@defaults | Pending | =Amount*3 |");
  });

  it("falls back cleanly when scoped modifiers cannot be found", () => {
    const workbook = createEditorWorkbook("@sheet Report\n| Ada |");
    const address = { sheetIndex: 0, rowIndex: 0, colIndex: 0 };

    expect(getCellStyle(undefined, 0, 0)).toEqual({});
    expect(hasScopedModifier(undefined, address, "column", "italic")).toBe(false);
    expect(hasScopedModifier(workbook.sheets[0], address, "column", "italic")).toBe(false);
    expect(getCellDisplayText({ raw: "<", modifiers: [] })).toBe("");
  });

  it("does not serialize virtual padding rows or columns", () => {
    const workbook = createEditorWorkbook("@sheet Report\n| Ada | 5 |");
    const updated = updateCellSource(workbook, { sheetIndex: 0, rowIndex: 4, colIndex: 3 }, "Tail[color:#111111]");

    expect(serializeEditorWorkbook(workbook)).toBe("@sheet Report\n| Ada | 5 |");
    expect(serializeEditorWorkbook(updated)).toContain("|  |  |  | Tail[color:#111111] |");
    expect(serializeEditorWorkbook(updated)).not.toContain("|  |  |  |  |");
  });

  it("applies configurable visible layout defaults", () => {
    const workbook = createEditorWorkbook("@sheet Report\n| Ada |");
    const sheet = workbook.sheets[0];

    expect(resolveEditorLayoutOptions({ minimumVisibleRows: 2 })).toEqual({ minimumVisibleRows: 2, minimumVisibleColumns: 5 });
    expect(getVisibleRowCount(sheet, { minimumVisibleRows: 2 })).toBe(2);
    expect(getVisibleColumnCount(sheet, { minimumVisibleColumns: 8 })).toBe(8);
    expect(addRow(workbook, 0, { minimumVisibleColumns: 8 }).sheets[0]?.rows[1]?.cells).toHaveLength(7);
    expect(getRowAt(undefined, 0, { minimumVisibleColumns: 3 }).cells).toHaveLength(2);
    expect(getCellAt(undefined, 0, 0)).toEqual({ raw: "", modifiers: [] });
  });

  it("sanitizes cell pipes when serializing", () => {
    const workbook = createEditorWorkbook("@sheet Report\n| Ada |");
    const updated = updateCellRaw(workbook, { sheetIndex: 0, rowIndex: 0, colIndex: 0 }, "A|B");

    expect(serializeEditorWorkbook(updated)).toBe("@sheet Report\n| A B |");
  });

  it("converts spreadsheet column indexes to names", () => {
    expect([0, 25, 26, 27, 701, 702].map(getColumnName)).toEqual(["A", "Z", "AA", "AB", "ZZ", "AAA"]);
  });

  it("evaluates formula display values with stable cell address keys", async () => {
    const values = await evaluateEditorWorkbookSource("@sheet Report\n@header | Amount |\n| 5 |\n| 7 |\n| =SUM(Amount) |");
    const totalAddress = { sheetIndex: 0, rowIndex: 3, colIndex: 0 };

    expect(getCellAddressKey(totalAddress)).toBe("0:3:0");
    expect(values[getCellAddressKey(totalAddress)]).toBe(12);
    expect(getCellDisplayText({ raw: "=SUM(Amount)", modifiers: [] }, values[getCellAddressKey(totalAddress)])).toBe("12");
    expect(getCellDisplayText({ raw: "=SUM(Amount)", modifiers: [] })).toBe("=SUM(Amount)");
  });

  it("keeps spreadsheet error values as computed display values", async () => {
    const values = await evaluateEditorWorkbookSource("@sheet Report\n| =MISSING(1) |");

    expect(values["0:0:0"]).toBe("#NAME?");
  });

  it("evaluates formulas with host-provided external sources", async () => {
    const values = await evaluateEditorWorkbookSource("@sheet Imported [csv]\n-> data.csv\n\n@sheet Summary\n@header | Metric | Value |\n| Total | =SUM(Imported!Amount) |", {
      parse: {
        readExternalSource: () => "Amount\n2\n3"
      }
    });

    expect(values["1:1:1"]).toBe(5);
  });
});
