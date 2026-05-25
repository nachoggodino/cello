import { describe, expect, it } from "vitest";
import {
  addColumn,
  addRow,
  addSheet,
  createEditorWorkbook,
  ensureColumnHeaderRow,
  getCellDisplayText,
  getCellSourceText,
  getSelectedCell,
  mergeCell,
  removeSheet,
  serializeEditorWorkbook,
  setCellColorModifier,
  setRowColorModifier,
  toggleCellModifier,
  toggleColumnModifier,
  toggleRowModifier,
  updateCellSource,
  updateCellRaw
} from "./visualEditorState";

describe("visual editor state", () => {
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

  it("writes merge tokens without style modifiers", () => {
    const workbook = createEditorWorkbook("@sheet Report\n| Ada | 5 |\n| Ops | 2 |");
    const mergedLeft = mergeCell(workbook, { sheetIndex: 0, rowIndex: 0, colIndex: 1 }, "left");
    const mergedUp = mergeCell(mergedLeft, { sheetIndex: 0, rowIndex: 1, colIndex: 0 }, "up");

    expect(serializeEditorWorkbook(mergedUp)).toContain("| Ada | < |");
    expect(serializeEditorWorkbook(mergedUp)).toContain("| ^ | 2 |");
  });

  it("adds rows, columns, and sheets", () => {
    const workbook = createEditorWorkbook("@sheet Report\n| Ada | 5 |");
    const updated = addSheet(addColumn(addRow(workbook, 0), 0));

    expect(updated.sheets).toHaveLength(2);
    expect(updated.sheets[0]?.rows.length).toBe(2);
    expect(updated.sheets[0]?.rows[0]?.cells.length).toBe(3);
    expect(serializeEditorWorkbook(updated)).toContain("@sheet Sheet2");
  });

  it("removes sheets but keeps one sheet available", () => {
    const workbook = createEditorWorkbook("@sheet Report\n| Ada | 5 |\n\n@sheet Archive\n| Grace | 7 |");
    const updated = removeSheet(workbook, 0);
    const unchanged = removeSheet(updated, 0);

    expect(updated.sheets.map((sheet) => sheet.name)).toEqual(["Archive"]);
    expect(unchanged.sheets.map((sheet) => sheet.name)).toEqual(["Archive"]);
  });

  it("supports row and column scoped modifiers", () => {
    const workbook = createEditorWorkbook("@sheet Report\n| Ada | 5 |");
    const rowAddress = { sheetIndex: 0, rowIndex: 0, colIndex: 0 };
    const rowUpdated = setRowColorModifier(toggleRowModifier(workbook, rowAddress, "bold"), rowAddress, "bg", "#abcdef");
    const resolution = ensureColumnHeaderRow(rowUpdated, 0);
    const columnUpdated = toggleColumnModifier(resolution.workbook, 0, resolution.headerRowIndex, 1, "italic");

    expect(serializeEditorWorkbook(columnUpdated)).toContain("[bold][bg:#abcdef] | Ada | 5 |");
    expect(serializeEditorWorkbook(columnUpdated)).toContain("@header |  | [italic] |");
  });

  it("does not serialize virtual padding rows or columns", () => {
    const workbook = createEditorWorkbook("@sheet Report\n| Ada | 5 |");
    const updated = updateCellSource(workbook, { sheetIndex: 0, rowIndex: 4, colIndex: 3 }, "Tail[color:#111111]");

    expect(serializeEditorWorkbook(workbook)).toBe("@sheet Report\n| Ada | 5 |");
    expect(serializeEditorWorkbook(updated)).toContain("|  |  |  | Tail[color:#111111] |");
    expect(serializeEditorWorkbook(updated)).not.toContain("|  |  |  |  |");
  });
});
