import { parse } from "../../core/src/index.js";
import type { EditorCell, EditorRow, EditorSheet, EditorWorkbook } from "./model.js";
import { DEFAULT_SHEET_NAME, rejectExternalSource } from "./options.js";
import type { CreateEditorWorkbookOptions } from "./options.js";
import { toBaseRaw } from "./source.js";

export function createEditorWorkbook(source: string, options: CreateEditorWorkbookOptions = {}): EditorWorkbook {
  const ast = parse(source, {
    ...(options.anonymousSheetName === undefined ? {} : { anonymousSheetName: options.anonymousSheetName }),
    ...(options.baseDir === undefined ? {} : { baseDir: options.baseDir }),
    readExternalSource: options.readExternalSource ?? rejectExternalSource,
    ...(options.strict === undefined ? {} : { strict: options.strict })
  });

  const sheets = ast.sheets.map((sheet) => ({
    name: sheet.name,
    rows: sheet.rows.map((row) => ({
      kind: row.kind,
      modifiers: row.modifiers,
      cells: row.cells.map((cell) => ({
        raw: toBaseRaw(cell.raw, cell.kind),
        modifiers: cell.modifiers
      }))
    }))
  }));

  return {
    sheets: sheets.length > 0 ? sheets : [createBlankSheet(DEFAULT_SHEET_NAME)]
  };
}

export function createBlankSheet(name: string): EditorSheet {
  return {
    name,
    rows: []
  };
}

export function createBlankRow(columnCount: number): EditorRow {
  return {
    kind: "data",
    modifiers: [],
    cells: Array.from({ length: Math.max(columnCount, 0) }, () => createBlankCell())
  };
}

export function createHeaderRow(columnCount: number): EditorRow {
  return {
    kind: "header",
    modifiers: [],
    cells: Array.from({ length: Math.max(columnCount, 0) }, () => createBlankCell())
  };
}

export function createBlankCell(): EditorCell {
  return { raw: "", modifiers: [] };
}
