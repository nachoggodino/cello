import { parse } from "../../core/src/index.js";
import type { SheetNode, WorkbookAst } from "../../core/src/index.js";
import type { EditorCell, EditorRow, EditorSheet, EditorWorkbook } from "./model.js";
import { DEFAULT_SHEET_NAME, rejectExternalSource } from "./options.js";
import type { CreateEditorWorkbookOptions } from "./options.js";
import { parseCellSource, toBaseRaw } from "./source.js";

export function createEditorWorkbook(source: string, options: CreateEditorWorkbookOptions = {}): EditorWorkbook {
  const ast = parse(source, {
    ...(options.anonymousSheetName === undefined ? {} : { anonymousSheetName: options.anonymousSheetName }),
    ...(options.baseDir === undefined ? {} : { baseDir: options.baseDir }),
    readExternalSource: options.readExternalSource ?? rejectExternalSource,
    ...(options.strict === undefined ? {} : { strict: options.strict })
  });

  return createEditorWorkbookFromAst(ast);
}

export function createEditorWorkbookFromAst(ast: WorkbookAst): EditorWorkbook {
  const sheets = ast.sheets.map((sheet) => createEditorSheetFromAst(sheet));

  return {
    aliases: ast.aliases,
    sheets: sheets.length > 0 ? sheets : [createBlankSheet(DEFAULT_SHEET_NAME)]
  };
}

function createEditorSheetFromAst(sheet: SheetNode): EditorSheet {
  return {
    name: sheet.name,
    format: sheet.format,
    layout: sheet.layout,
    ...(sheet.format.kind === "json" && sheet.format.path ? { externalSource: { path: sheet.format.path, status: "unresolved" } } : {}),
    defaults: sheet.columns.map((column) => {
      const source = column.modifiers.find((modifier) => modifier.key === "default")?.value ?? "";
      return parseDefaultCellSource(source);
    }),
    rows: sheet.rows.map((row) => ({
      kind: row.kind,
      modifiers: row.modifiers,
      cells: row.cells.map((cell) => ({
        raw: toBaseRaw(cell.raw, cell.kind),
        modifiers: cell.kind === "formula" ? parseCellSource(cell.raw).modifiers : cell.modifiers
      }))
    }))
  };
}

export function createBlankSheet(name: string): EditorSheet {
  return {
    name,
    format: { kind: "cello" },
    layout: {},
    defaults: [],
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

function parseDefaultCellSource(source: string): EditorCell {
  if (source.length === 0) {
    return createBlankCell();
  }
  return parseCellSource(source);
}
