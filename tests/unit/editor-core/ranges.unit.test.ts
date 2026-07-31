import { describe, expect, it } from "vitest";
import type { EditorWorkbook } from "@cello/editor-core";
import {
  applyWorkbookPatch,
  clearRange,
  clearRangeAll,
  copyRangeAsTsv,
  createEditorDocument,
  createEditorWorkbook,
  getCellRangeSize,
  isAddressInRange,
  normalizeCellRange,
  parseClipboardMatrix,
  pasteMatrixAt
} from "@cello/editor-core";
import { emitEditorSheet } from "../../../packages/editor-core/src/syntax-emitter.js";

function emitWorkbookForTest(workbook: EditorWorkbook): string {
  return workbook.sheets.map(emitEditorSheet).join("\n\n");
}

describe("editor core ranges", () => {
  it("normalizes reversed range anchors and reports membership", () => {
    const range = normalizeCellRange({ sheetIndex: 0, rowIndex: 4, colIndex: 3 }, { sheetIndex: 0, rowIndex: 1, colIndex: 1 });

    expect(range).toEqual({ sheetIndex: 0, startRow: 1, endRow: 4, startCol: 1, endCol: 3 });
    expect(getCellRangeSize(range)).toEqual({ rows: 4, columns: 3, cells: 12 });
    expect(isAddressInRange({ sheetIndex: 0, rowIndex: 2, colIndex: 2 }, range)).toBe(true);
    expect(isAddressInRange({ sheetIndex: 1, rowIndex: 2, colIndex: 2 }, range)).toBe(false);
  });

  it("copies source values as rectangular TSV", () => {
    const workbook = createEditorWorkbook("@sheet Report\n| Ada | =SUM(B1:B2) |\n| Grace[bold] | 7 |");
    const tsv = copyRangeAsTsv(workbook, { sheetIndex: 0, startRow: 0, endRow: 1, startCol: 0, endCol: 1 });

    expect(tsv).toBe("Ada\t=SUM(B1:B2)\nGrace[bold]\t7");
  });

  it("parses TSV and quoted CSV clipboard text", () => {
    expect(parseClipboardMatrix("A\tB\nC\t")).toEqual([
      ["A", "B"],
      ["C", ""]
    ]);
    expect(parseClipboardMatrix('"Ada, A.",5\n"Grace ""G""",7')).toEqual([
      ["Ada, A.", "5"],
      ['Grace "G"', "7"]
    ]);
  });

  it("pastes matrices while expanding rows and columns", () => {
    const workbook = createEditorWorkbook("@sheet Report\n| Ada |");
    const updated = pasteMatrixAt(workbook, { sheetIndex: 0, rowIndex: 1, colIndex: 1 }, [
      ["5", "=SUM(B2)"],
      ["7", "9"]
    ]);

    expect(emitWorkbookForTest(updated)).toBe("@sheet Report\n| Ada |  |  |\n|  | 5 | =SUM(B2) |\n|  | 7 | 9 |");
  });

  it("pastes matrices over existing cells from the first row", () => {
    const workbook = createEditorWorkbook("@sheet Report\n| A | B |");
    const updated = pasteMatrixAt(workbook, { sheetIndex: 0, rowIndex: 0, colIndex: 0 }, [
      ["X", "Y"],
      ["Z", "9"]
    ]);

    expect(emitWorkbookForTest(updated)).toBe("@sheet Report\n| X | Y |\n| Z | 9 |");
  });

  it("clears a rectangular range without changing cells outside it", () => {
    const workbook = createEditorWorkbook("@sheet Report\n| A | B | C |\n| D | E | F |");
    const updated = clearRange(workbook, { sheetIndex: 0, startRow: 0, endRow: 1, startCol: 1, endCol: 2 });

    expect(emitWorkbookForTest(updated)).toBe("@sheet Report\n| A |  |  |\n| D |  |  |");
  });

  it("distinguishes content clearing from full source clearing", () => {
    const workbook = createEditorWorkbook("@sheet Report\n| A[bold] | B |");
    const range = { sheetIndex: 0, startRow: 0, endRow: 0, startCol: 0, endCol: 0 };

    expect(emitWorkbookForTest(clearRange(workbook, range))).toBe("@sheet Report\n| [bold] | B |");
    expect(emitWorkbookForTest(clearRangeAll(workbook, range))).toBe("@sheet Report\n|  | B |");
  });

  it("pastes cell source modifiers and preserves unrelated source text", () => {
    const source = "// lead\n@sheet Report\n| A | B |\n\n// keep\n| C | D |";
    const document = createEditorDocument(source);
    const workbook = pasteMatrixAt(document.workbook, { sheetIndex: 0, rowIndex: 0, colIndex: 0 }, [["X[bold]", "Y"]]);
    const result = applyWorkbookPatch(document, workbook);

    expect(result.ok).toBe(true);
    expect(result.ok ? result.source : "").toBe("// lead\n@sheet Report\n| X[bold] | Y |\n\n// keep\n| C | D |");
  });
});
