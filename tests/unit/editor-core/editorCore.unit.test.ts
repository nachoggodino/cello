import { describe, expect, it } from "vitest";
import {
  addColumn,
  addRow,
  addSheet,
  applyWorkbookPatch,
  composeCellSource,
  createEditorDocument,
  createEditorWorkbook,
  DEFAULT_SHEET_NAME,
  ensureColumnHeaderRow,
  evaluateEditorWorkbookSource,
  getCellAddressKey,
  getCellAt,
  getCellContentText,
  getCellDisplayText,
  getCellFormattedDisplayText,
  getCellModifierSourceText,
  getCellSourceText,
  getCellStyle,
  getCellToneClass,
  getColumnWidthValue,
  getColumnName,
  getDefaultCellAt,
  getInheritedModifierGroups,
  getRowHeightValue,
  getRowAt,
  getScopedColorValue,
  getSelectedCell,
  getVisibleColumnCount,
  getVisibleRowCount,
  getVisualCellSpan,
  getVisualCellStyle,
  getVisualCellContentStyle,
  hasScopedModifier,
  isColumnFit,
  isRowWrap,
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
  setColumnWidth,
  setColumnColorModifier,
  setRowHeight,
  setRowColorModifier,
  setRowToneModifier,
  setSheetColumnsMode,
  setSheetRowsMode,
  toggleCellModifier,
  toggleColumnFit,
  toggleColumnModifier,
  toggleRowModifier,
  toggleRowWrap,
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

  it("loads and edits persisted layout controls", () => {
    const workbook = createEditorWorkbook("@sheet Report [columns:fit][rows:wrap]\n@header | Name | Notes[width:large] |\n[wrap][height:3] | Ada | Long note |");
    const sheet = workbook.sheets[0];

    expect(sheet?.layout).toEqual({ columns: "fit", rows: "wrap" });
    expect(getColumnWidthValue(sheet, 1, 1)).toBe("large");
    expect(isRowWrap(sheet, 1)).toBe(true);
    expect(getRowHeightValue(sheet, 1)).toBe("3");

    const header = ensureColumnHeaderRow(workbook, 0);
    const updated = setSheetRowsMode(
      setSheetColumnsMode(
        setRowHeight(
          toggleRowWrap(
            setColumnWidth(toggleColumnFit(header.workbook, 0, header.headerRowIndex, 0), 0, header.headerRowIndex, 1, "24"),
            { sheetIndex: 0, rowIndex: 1, colIndex: 0 }
          ),
          { sheetIndex: 0, rowIndex: 1, colIndex: 0 },
          "5"
        ),
        0,
        "normal"
      ),
      0,
      "ellipsis"
    );

    expect(isColumnFit(updated.sheets[0], 1, 0)).toBe(true);
    expect(serializeEditorWorkbook(updated)).toContain("@sheet Report");
    expect(serializeEditorWorkbook(updated)).not.toContain("[columns:normal]");
    expect(serializeEditorWorkbook(updated)).toContain("[rows:ellipsis]");
    expect(serializeEditorWorkbook(updated)).toContain("@header | Name[fit] | Notes[width:24] |");
    expect(serializeEditorWorkbook(updated)).toContain("[height:5] | Ada | Long note |");
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
    expect(createEditorWorkbook("").sheets).toEqual([{ name: "Sheet1", format: { kind: "cello" }, layout: {}, rows: [], defaults: [] }]);
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
    expect(getCellContentText(selected)).toBe("\"123\"");
    expect(getCellModifierSourceText(selected)).toBe("[bold][color:#123456]");
    expect(composeCellSource(getCellContentText(selected), getCellModifierSourceText(selected))).toBe("\"123\"[bold][color:#123456]");
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
    expect(parseCellSource("=A1[bold]")).toEqual({
      raw: "=A1",
      modifiers: [{ raw: "bold", key: "bold" }]
    });
    expect(parseCellSource("=A1[red]")).toEqual({
      raw: "=A1",
      modifiers: [{ raw: "red", key: "red" }]
    });
    expect(parseCellSource("=A1[hello]")).toEqual({ raw: "=A1[hello]", modifiers: [] });
    expect(parseCellSource("=A1[width:24]")).toEqual({ raw: "=A1[width:24]", modifiers: [] });
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
    const workbook = createEditorWorkbook("@sheet Report\n@header | Name[italic][color:#222222] |\n[bold][bg:#abcdef] | Ada[#111111] |");
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
    expect(getScopedColorValue(sheet, address, "cell", "color", "#000000")).toBe("#000000");
    expect(getScopedColorValue(sheet, address, "row", "color", "#000000")).toBe("#000000");
  });

  it("derives visual display for inline text styles and tones", () => {
    const workbook = createEditorWorkbook("@tone notes [tone:accent]\n@sheet Report\n@header | Name[tone:notes] | State |\n[tone:muted] | ## Total[strike] | ok[tone:ok] |");
    const sheet = workbook.sheets[0];

    expect(getCellDisplayText(getCellAt(sheet, 1, 0))).toBe("Total");
    expect(getCellStyle(sheet, 1, 0)).toEqual({ fontSize: "1.25rem", fontWeight: 700, textDecoration: "line-through" });
    expect(getCellDisplayText({ raw: "_Italic_", modifiers: [] })).toBe("Italic");
    expect(getCellStyle({ name: "S", rows: [{ kind: "data", modifiers: [], cells: [{ raw: "_Italic_", modifiers: [] }, { raw: "*Bold*", modifiers: [] }] }], defaults: [] }, 0, 0)).toEqual({ fontStyle: "italic" });
    expect(getCellStyle({ name: "S", rows: [{ kind: "data", modifiers: [], cells: [{ raw: "_Italic_", modifiers: [] }, { raw: "*Bold*", modifiers: [] }] }], defaults: [] }, 0, 1)).toEqual({ fontWeight: 700 });
    expect(getCellToneClass(sheet, 1, 0, workbook)).toBe("celloVisualTone-accent celloVisualTone-muted");
    expect(getCellToneClass(sheet, 1, 1, workbook)).toBe("celloVisualTone-muted celloVisualTone-ok");
    expect(getCellDisplayText({ raw: "~~Done~~", modifiers: [] })).toBe("Done");

    const tonedCell = setCellToneModifier(workbook, { sheetIndex: 0, rowIndex: 1, colIndex: 0 }, "warn");
    const untonedCell = setCellToneModifier(tonedCell, { sheetIndex: 0, rowIndex: 1, colIndex: 0 }, "warn");
    const tonedRow = setRowToneModifier(workbook, { sheetIndex: 0, rowIndex: 1, colIndex: 0 }, "info");
    expect(serializeEditorWorkbook(tonedCell)).toContain("## Total[strike][tone:warn]");
    expect(serializeEditorWorkbook(untonedCell)).toContain("## Total[strike] |");
    expect(serializeEditorWorkbook(tonedRow)).toContain("[tone:info] | ## Total[strike] |");
  });

  it("derives formatted visual display text and layout styles", () => {
    const workbook = createEditorWorkbook("@sheet Report [columns:fit][rows:wrap]\n@header | Amount[€][2d] | Rate[%][1d] |\n| 12.5 | 0.42 |");
    const sheet = workbook.sheets[0];

    expect(getCellFormattedDisplayText(sheet, 1, 0, undefined, workbook)).toBe("€12.50");
    expect(getCellFormattedDisplayText(sheet, 1, 1, undefined, workbook)).toBe("42.0%");
    expect(getVisualCellContentStyle(workbook, sheet, 1)).toEqual({ whiteSpace: "normal", overflowWrap: "anywhere" });
    expect(getVisualCellStyle(workbook, sheet, 1, 0).width).toBe("calc(12ch + 16px)");
  });

  it("uses shared visual layout dimensions before measured fit is applied", () => {
    const workbook = createEditorWorkbook(
      "@sheet Report [columns:fit]\n@header | Amount[€][2d] | Note | Merged |\n[wrap][height:2] | 12.5 | ok | tiny |\n| =SUM(Amount) | longer literal | very very long merged source | < |\n| 7[%] | < | fit |"
    );
    const sheet = workbook.sheets[0];

    expect(getVisualCellStyle(workbook, sheet, 1, 0).width).toBe("calc(12ch + 16px)");
    expect(getVisualCellStyle(workbook, sheet, 1, 2).width).toBe("calc(12ch + 16px)");
    expect(getVisualCellStyle(workbook, sheet, 1, 0).height).toBe("calc(40px + 16px)");
    expect(getVisualCellContentStyle(workbook, sheet, 1)).toEqual({ whiteSpace: "normal", overflowWrap: "anywhere", overflow: "auto" });
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

  it("counts trailing default columns as visible editor columns", () => {
    const workbook = createEditorWorkbook("@sheet Report\n@header | Name |\n@defaults | Pending | Review | Done |\n| Ada |");

    expect(getVisibleColumnCount(workbook.sheets[0], { minimumVisibleColumns: 1 })).toBe(4);
  });

  it("sanitizes cell pipes when serializing", () => {
    const workbook = createEditorWorkbook("@sheet Report\n| Ada |");
    const updated = updateCellRaw(workbook, { sheetIndex: 0, rowIndex: 0, colIndex: 0 }, "A|B");

    expect(serializeEditorWorkbook(updated)).toBe("@sheet Report\n| A B |");
  });

  it("applies source-preserving patches without removing comments or spacing", () => {
    const source = [
      "// keep this",
      "@sheet Report",
      "",
      "| Ada | 5 |",
      "// keep this too"
    ].join("\n");
    const document = createEditorDocument(source);
    const nextWorkbook = updateCellSource(document.workbook, { sheetIndex: 0, rowIndex: 0, colIndex: 1 }, "7");
    const result = applyWorkbookPatch(document, nextWorkbook);

    expect(result.ok).toBe(true);
    expect(result.ok ? result.source : "").toBe([
      "// keep this",
      "@sheet Report",
      "",
      "| Ada | 7 |",
      "// keep this too"
    ].join("\n"));
  });

  it("materializes an empty implicit sheet when editing a blank document", () => {
    const document = createEditorDocument("");
    const nextWorkbook = updateCellSource(document.workbook, { sheetIndex: 0, rowIndex: 0, colIndex: 0 }, "Ada");
    const result = applyWorkbookPatch(document, nextWorkbook);

    expect(result.ok).toBe(true);
    expect(result.ok ? result.source : "").toBe("@sheet Sheet1\n| Ada |");
  });

  it("materializes the implicit first sheet when adding a sheet to empty source", () => {
    const document = createEditorDocument("");
    const result = applyWorkbookPatch(document, addSheet(document.workbook));

    expect(result.ok).toBe(true);
    expect(result.ok ? result.source : "").toBe("@sheet Sheet1\n\n@sheet Sheet2");
    expect(result.ok ? result.document.workbook.sheets.map((sheet) => sheet.name) : []).toEqual(["Sheet1", "Sheet2"]);
  });

  it("materializes implicit sheets when column controls insert a header", () => {
    const document = createEditorDocument("| Ada |");
    const resolution = ensureColumnHeaderRow(document.workbook, 0);
    const nextWorkbook = setColumnWidth(resolution.workbook, 0, resolution.headerRowIndex, 0, "24");
    const result = applyWorkbookPatch(document, nextWorkbook);

    expect(result.ok).toBe(true);
    expect(result.ok ? result.source : "").toBe("@sheet Sheet1\n@header | [width:24] |\n| Ada |");
  });

  it("keeps source-map sheets aligned when aliases appear before the first sheet", () => {
    const source = [
      "@tone notes [color:#334155][bg:#f8fafc]",
      "@width description [width:large]",
      "",
      "@sheet Report",
      "| Ada | 5 |"
    ].join("\n");
    const document = createEditorDocument(source);
    const nextWorkbook = updateCellSource(document.workbook, { sheetIndex: 0, rowIndex: 0, colIndex: 1 }, "7");
    const result = applyWorkbookPatch(document, nextWorkbook);

    expect(document.sourceMap.sheets).toHaveLength(1);
    expect(result.ok).toBe(true);
    expect(result.ok ? result.source : "").toBe([
      "@tone notes [color:#334155][bg:#f8fafc]",
      "@width description [width:large]",
      "",
      "@sheet Report",
      "| Ada | 7 |"
    ].join("\n"));
  });

  it("rejects alias-only mutations instead of returning a false successful patch", () => {
    const document = createEditorDocument("@tone notes [color:#334155]\n\n@sheet Report\n| Ada |");
    const result = applyWorkbookPatch(document, { ...document.workbook, aliases: [] });

    expect(result).toMatchObject({
      ok: false,
      reason: "unsupported-source-region",
      message: "Alias edits cannot be source-preserved in visual mode yet."
    });
  });

  it("patches the intended sheet when comments and aliases sit between sheets", () => {
    const source = [
      "@tone notes [color:#334155]",
      "",
      "@sheet First",
      "| A | 1 |",
      "// between sheets",
      "@width description [width:large]",
      "",
      "@sheet Second",
      "| B | 2 |"
    ].join("\n");
    const document = createEditorDocument(source);
    const nextWorkbook = updateCellSource(document.workbook, { sheetIndex: 1, rowIndex: 0, colIndex: 1 }, "3");
    const result = applyWorkbookPatch(document, nextWorkbook);

    expect(document.sourceMap.sheets).toHaveLength(2);
    expect(result.ok).toBe(true);
    expect(result.ok ? result.source : "").toBe([
      "@tone notes [color:#334155]",
      "",
      "@sheet First",
      "| A | 1 |",
      "// between sheets",
      "@width description [width:large]",
      "",
      "@sheet Second",
      "| B | 3 |"
    ].join("\n"));
  });

  it("preserves comments and aliases between sheets when removing a sheet", () => {
    const source = [
      "@sheet First",
      "| A | 1 |",
      "// keep between",
      "@width description [width:large]",
      "",
      "@sheet Second",
      "| B | 2 |"
    ].join("\n");
    const document = createEditorDocument(source);
    const result = applyWorkbookPatch(document, removeSheet(document.workbook, 0));

    expect(result.ok).toBe(true);
    expect(result.ok ? result.source : "").toBe([
      "// keep between",
      "@width description [width:large]",
      "",
      "@sheet Second",
      "| B | 2 |"
    ].join("\n"));
  });

  it("fails controlled instead of normalizing unavailable external source sheets", () => {
    const source = "@sheet Imported\n-> data.cel";
    const document = createEditorDocument(source);
    const nextWorkbook = updateCellSource(document.workbook, { sheetIndex: 0, rowIndex: 0, colIndex: 0 }, "Ada");
    const result = applyWorkbookPatch(document, nextWorkbook);

    expect(document.diagnostics.some((diagnostic) => diagnostic.code === "external-source-unsupported")).toBe(true);
    expect(result).toMatchObject({
      ok: false,
      reason: "external-source-unavailable",
      message: expect.stringContaining("native Cello syntax")
    });
  });

  it("explains source-preserving edit failures for non-native sheets", () => {
    const document = createEditorDocument("@sheet RawData [csv]\nname,amount\nAda,5");
    const nextWorkbook = toggleCellModifier(document.workbook, { sheetIndex: 0, rowIndex: 1, colIndex: 0 }, "bold");
    const result = applyWorkbookPatch(document, nextWorkbook);

    expect(result).toMatchObject({
      ok: false,
      reason: "unsupported-source-region",
      message: expect.stringContaining("CSV")
    });
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
