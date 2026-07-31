import { parseDocument } from "../../core/src/index.js";
import type { SheetFormat } from "../../core/src/index.js";
import type {
  EditorCell,
  EditorCommandFailure,
  EditorCommandResult,
  EditorDiagnostic,
  EditorDocument,
  EditorRow,
  EditorRowSourceLocation,
  EditorSheet,
  EditorSheetSourceLocation,
  EditorSourceSpan,
  EditorWorkbook
} from "./model.js";
import { rejectExternalSource } from "./options.js";
import type { CreateEditorWorkbookOptions } from "./options.js";
import {
  emitEditorCell,
  emitEditorCellsAsRow,
  emitEditorDefaultsRow,
  emitEditorRow,
  emitEditorSheet,
  emitEditorSheetDeclaration,
  emitEditorSheetName
} from "./syntax-emitter.js";
import { createEditorWorkbookFromAst } from "./workbook.js";
import {
  aliasesEqual,
  cellEqual,
  cellsEqual,
  modifiersEqual,
  persistedWorkbooksEqual,
  rowEqual,
  rowsEqual,
  sheetEqual,
  sheetLayoutsEqual,
  sheetsEqual
} from "./equality.js";
import { formatChangedSource } from "./layout-scope.js";

interface Patch {
  span: EditorSourceSpan;
  text: string;
}

export function createEditorDocument(source: string, options: CreateEditorWorkbookOptions = {}): EditorDocument {
  const diagnostics: EditorDiagnostic[] = [];
  const parsed = parseDocument(source, {
    ...(options.anonymousSheetName === undefined ? {} : { anonymousSheetName: options.anonymousSheetName }),
    ...(options.baseDir === undefined ? {} : { baseDir: options.baseDir }),
    readExternalSource: options.readExternalSource ?? rejectExternalSource,
    ...(options.strict === undefined ? {} : { strict: options.strict })
  });
  diagnostics.push(...parsed.workbook.diagnostics);

  const sourceMap = parsed.sourceMap.sheets.length > 0
    ? parsed.sourceMap
    : { sheets: [createImplicitSheet()] };
  if (!options.readExternalSource) {
    for (const sourceSheet of sourceMap.sheets) {
      for (const externalSource of sourceSheet.externalSources) {
        diagnostics.push({
          level: "warning",
          line: externalSource.line,
          code: "external-source-unsupported",
          message: "External sources are not available in this editor host: " + externalSource.path
        });
      }
    }
  }
  const workbook = createEditorWorkbookFromAst(parsed.workbook);
  for (const [sheetIndex, sheet] of workbook.sheets.entries()) {
    const sourceSheet = sourceMap.sheets[sheetIndex];
    if (sourceSheet?.externalSources[0]) {
      sheet.externalSource = {
        path: sourceSheet.externalSources[0].path,
        status: options.readExternalSource ? "loaded" : "unsupported",
        ...(!options.readExternalSource ? { message: "External sources are not available in this editor host." } : {})
      };
    }
  }

  return { source, workbook, sourceMap, diagnostics };
}

export function applyWorkbookPatch(
  document: EditorDocument,
  nextWorkbook: EditorWorkbook,
  options: CreateEditorWorkbookOptions = {}
): EditorCommandResult {
  const patchesOrFailure = buildWorkbookPatches(document, nextWorkbook);
  if (!Array.isArray(patchesOrFailure)) {
    return {
      ok: false,
      reason: patchesOrFailure.reason,
      message: patchesOrFailure.message,
      document
    };
  }

  const patchedSource = applyPatches(document.source, patchesOrFailure);
  const nextSource = formatChangedSource(document.source, patchedSource, options.sourceLayout);
  const nextDocument = createEditorDocument(nextSource, options);
  if (!persistedWorkbooksEqual(nextDocument.workbook, nextWorkbook)) {
    return {
      ok: false,
      reason: "postcondition-failed",
      message: "The command result did not reparse to the requested workbook, so the source change was discarded.",
      document
    };
  }
  return {
    ok: true,
    source: nextSource,
    document: nextDocument
  };
}

function buildWorkbookPatches(
  document: EditorDocument,
  nextWorkbook: EditorWorkbook
): Patch[] | Pick<EditorCommandFailure, "reason" | "message"> {
  const current = document.workbook;
  const patches: Patch[] = [];
  const lineEnding = getSourceLineEnding(document.source);
  if (!aliasesEqual(current.aliases ?? [], nextWorkbook.aliases ?? [])) {
    return { reason: "unsupported-source-region", message: "Alias edits cannot be source-preserved in visual mode yet." };
  }

  if (nextWorkbook.sheets.length === current.sheets.length + 1 && sheetsEqual(nextWorkbook.sheets.slice(0, -1), current.sheets)) {
    if (document.source.length === 0) {
      return [{
        span: { start: 0, end: 0 },
        text: toLineEndings(nextWorkbook.sheets.map(emitEditorSheet).join("\n\n"), lineEnding)
      }];
    }
    const firstSourceSheet = document.sourceMap.sheets[0];
    const firstCurrentSheet = current.sheets[0];
    if (firstSourceSheet && firstCurrentSheet && !firstSourceSheet.declaration) {
      patches.push({
        span: { start: firstSourceSheet.sheetSpan.start, end: firstSourceSheet.sheetSpan.start },
        text: `${emitEditorSheetDeclaration(firstCurrentSheet)}${lineEnding}`
      });
    }
    const appendedSheet = nextWorkbook.sheets.at(-1);
    if (!appendedSheet) {
      return { reason: "stale-source-map", message: "The appended sheet could not be resolved." };
    }
    const emittedSheet = toLineEndings(emitEditorSheet(appendedSheet), lineEnding);
    patches.push({
      span: { start: document.source.length, end: document.source.length },
      text: `${document.source.endsWith(lineEnding) ? lineEnding : lineEnding + lineEnding}${emittedSheet}`
    });
    return patches;
  }

  if (shouldMaterializeImplicitWorkbook(document, nextWorkbook)) {
    return materializeImplicitWorkbook(document, nextWorkbook, lineEnding);
  }

  if (nextWorkbook.sheets.length === current.sheets.length - 1) {
    const removedIndex = current.sheets.findIndex((sheet, index) => !sheetsEqual([sheet], [nextWorkbook.sheets[index] as EditorSheet]));
    const sourceSheet = document.sourceMap.sheets[removedIndex];
    if (!sourceSheet) {
      return { reason: "stale-source-map", message: "The removed sheet could not be mapped to source." };
    }
    patches.push({ span: expandRemovedSheetSpan(document.source, sourceSheet.sheetSpan), text: "" });
    return patches;
  }

  if (nextWorkbook.sheets.length !== current.sheets.length) {
    return { reason: "unsupported-source-region", message: "This sheet count change cannot be source-preserved yet." };
  }

  for (const [sheetIndex, nextSheet] of nextWorkbook.sheets.entries()) {
    const currentSheet = current.sheets[sheetIndex];
    const sourceSheet = document.sourceMap.sheets[sheetIndex];
    if (!currentSheet || !sourceSheet) {
      return { reason: "stale-source-map", message: "The edited sheet could not be mapped to source." };
    }
    if (!sourceSheet.editable && !sheetEqual(nextSheet, currentSheet)) {
      return {
        reason: sourceSheet.externalSources.length > 0 ? "external-source-unavailable" : "unsupported-source-region",
        message: buildReadonlySheetMessage(currentSheet.name, sourceSheet.format, sourceSheet.externalSources.length > 0)
      };
    }

    const sheetPatch = patchSheetDeclaration(document.source, sourceSheet, currentSheet, nextSheet);
    if (sheetPatch) {
      patches.push(sheetPatch);
    }

    const defaultsPatches = patchDefaults(document.source, sourceSheet, currentSheet, nextSheet);
    if (!Array.isArray(defaultsPatches)) {
      return defaultsPatches;
    }
    patches.push(...defaultsPatches);

    const rowPatches = patchRows(document.source, sourceSheet, currentSheet, nextSheet);
    if (!Array.isArray(rowPatches)) {
      return rowPatches;
    }
    patches.push(...rowPatches);
  }

  return patches;
}

function patchSheetDeclaration(
  source: string,
  sourceSheet: EditorSheetSourceLocation,
  current: EditorSheet,
  next: EditorSheet
): Patch | undefined {
  const nameChanged = current.name !== next.name;
  const layoutChanged = !sheetLayoutsEqual(current.layout, next.layout);
  if (!nameChanged && !layoutChanged) {
    return undefined;
  }
  if (!sourceSheet.declaration) {
    return {
      span: { start: sourceSheet.sheetSpan.start, end: sourceSheet.sheetSpan.start },
      text: `${emitEditorSheetDeclaration(next)}${getSourceLineEnding(source)}`
    };
  }
  if (nameChanged && !layoutChanged) {
    return { span: sourceSheet.declaration.nameSpan, text: emitEditorSheetName(next.name) };
  }
  return { span: sourceSheet.declaration.lineSpan, text: emitEditorSheetDeclaration(next) };
}

function patchDefaults(
  source: string,
  sourceSheet: EditorSheetSourceLocation,
  current: EditorSheet,
  next: EditorSheet
): Patch[] | Pick<EditorCommandFailure, "reason" | "message"> {
  if (cellsEqual(current.defaults, next.defaults)) {
    return [];
  }
  if (!sourceSheet.defaults) {
    const anchor = sourceSheet.rows.find((row) => row.sourceKind === "header") ?? sourceSheet.declaration;
    if (!anchor) {
      return { reason: "stale-source-map", message: "A defaults row cannot be inserted without a mapped sheet anchor." };
    }
    const defaults = emitEditorDefaultsRow(next);
    return defaults ? [{
      span: { start: anchor.lineSpan.end, end: anchor.lineSpan.end },
      text: `${getSourceLineEnding(source)}${defaults}`
    }] : [];
  }
  return patchRowCells(source, sourceSheet.defaults, current.defaults, next.defaults, "defaults");
}

function patchRows(
  source: string,
  sourceSheet: EditorSheetSourceLocation,
  current: EditorSheet,
  next: EditorSheet
): Patch[] | Pick<EditorCommandFailure, "reason" | "message"> {
  if (rowsEqual(current.rows, next.rows)) {
    return [];
  }

  const insertionPatch = getInsertedRowsPatch(source, sourceSheet, current.rows, next.rows);
  if (insertionPatch) {
    return [insertionPatch];
  }

  if (current.rows.length === next.rows.length) {
    const patches: Patch[] = [];
    for (const [rowIndex, nextRow] of next.rows.entries()) {
      const currentRow = current.rows[rowIndex];
      const sourceRow = sourceSheet.rows[rowIndex];
      if (!currentRow || rowEqual(currentRow, nextRow)) {
        continue;
      }
      if (!sourceRow) {
        return { reason: "stale-source-map", message: `Row ${rowIndex + 1} could not be mapped to source.` };
      }
      if (currentRow.kind !== nextRow.kind || currentRow.cells.length !== nextRow.cells.length) {
        if (rowContainsDefaultDerivedCell(sourceRow, currentRow)) {
          return sourceProvenanceFailure(rowIndex);
        }
        patches.push({ span: sourceRow.lineSpan, text: emitEditorRow(nextRow) });
        continue;
      }
      if (!modifiersEqual(currentRow.modifiers, nextRow.modifiers)) {
        if (rowContainsDefaultDerivedCell(sourceRow, currentRow)) {
          return sourceProvenanceFailure(rowIndex);
        }
        patches.push({ span: sourceRow.lineSpan, text: emitEditorRow(nextRow) });
        continue;
      }
      const cellPatches = patchRowCells(source, sourceRow, currentRow.cells, nextRow.cells, "row");
      if (!Array.isArray(cellPatches)) {
        return cellPatches;
      }
      patches.push(...cellPatches);
    }
    return patches;
  }

  if (next.rows.length > current.rows.length) {
    const sharedRows = next.rows.slice(0, current.rows.length);
    const sharedPatches = patchRows(source, sourceSheet, current, { ...next, rows: sharedRows });
    if (!Array.isArray(sharedPatches)) {
      return sharedPatches;
    }
    const previous = sourceSheet.rows[current.rows.length - 1] ?? sourceSheet.defaults ?? sourceSheet.declaration;
    if (!previous) {
      return { reason: "stale-source-map", message: "The appended row anchor could not be mapped to source." };
    }
    const appendedRows = next.rows.slice(current.rows.length)
      .map((row) => emitEditorRow(row))
      .join("\n");
    return [
      ...sharedPatches,
      {
        span: { start: previous.lineSpan.end, end: previous.lineSpan.end },
        text: `${getSourceLineEnding(source)}${toLineEndings(appendedRows, getSourceLineEnding(source))}`
      }
    ];
  }

  return { reason: "unsupported-source-region", message: "This row change cannot be source-preserved yet." };
}

function rowContainsDefaultDerivedCell(sourceRow: EditorRowSourceLocation, row: EditorRow): boolean {
  return row.cells.some((_, index) => sourceRow.cells[index]?.valueOrigin === "default-derived");
}

function sourceProvenanceFailure(
  rowIndex: number
): { reason: "source-provenance-required"; message: string } {
  return {
    reason: "source-provenance-required",
    message: `Row ${rowIndex + 1} contains inherited defaults. This structural edit is blocked because preserving inherited-default provenance is not implemented yet.`
  };
}

function patchRowCells(
  source: string,
  sourceRow: EditorRowSourceLocation,
  currentCells: EditorCell[],
  nextCells: EditorCell[],
  label: string
): Patch[] | Pick<EditorCommandFailure, "reason" | "message"> {
  if (currentCells.length !== nextCells.length) {
    return [{ span: sourceRow.lineSpan, text: serializeCellsAsRowSource(source, sourceRow, nextCells) }];
  }
  const patches: Patch[] = [];
  const omittedChanges = new Set<number>();
  for (const [cellIndex, nextCell] of nextCells.entries()) {
    const currentCell = currentCells[cellIndex];
    if (!currentCell || cellEqual(currentCell, nextCell)) {
      continue;
    }
    const sourceCell = sourceRow.cells[cellIndex];
    if (!sourceCell) {
      return { reason: "stale-source-map", message: `The edited ${label} cell ${cellIndex + 1} could not be mapped to source.` };
    }
    if (sourceCell.sourceKind === "omitted") {
      omittedChanges.add(cellIndex);
      continue;
    }
    if (sourceCell.sourceKind === "explicit-empty") {
      const token = source.slice(sourceCell.tokenSpan.start, sourceCell.tokenSpan.end);
      const emitted = emitEditorCell(nextCell);
      patches.push({
        span: sourceCell.tokenSpan,
        text: token.length > 0 ? `${token}${emitted} ` : emitted
      });
      continue;
    }
    patches.push({ span: expandCellPatchSpan(source, sourceRow, sourceCell.span), text: emitEditorCell(nextCell) });
  }
  if (omittedChanges.size > 0) {
    const omittedPatch = materializeOmittedCells(source, sourceRow, nextCells, omittedChanges);
    if (!Array.isArray(omittedPatch)) {
      return omittedPatch;
    }
    patches.push(...omittedPatch);
  }
  return patches;
}

function materializeOmittedCells(
  source: string,
  sourceRow: EditorRowSourceLocation,
  nextCells: EditorCell[],
  changedIndexes: ReadonlySet<number>
): Patch[] | Pick<EditorCommandFailure, "reason" | "message"> {
  const line = source.slice(sourceRow.lineSpan.start, sourceRow.lineSpan.end);
  if (!line.trimEnd().endsWith("|")) {
    return {
      reason: "ambiguous-cell-location",
      message: "An omitted cell cannot be materialized safely in a row without a closing pipe."
    };
  }
  const firstOmitted = sourceRow.cells.findIndex((cell) => cell.sourceKind === "omitted");
  const lastChanged = Math.max(...changedIndexes);
  const insertion = sourceRow.cells[firstOmitted];
  if (firstOmitted < 0 || !insertion || lastChanged < firstOmitted) {
    return { reason: "stale-source-map", message: "The omitted cell insertion point could not be mapped to source." };
  }
  const tokens: string[] = [];
  for (let index = firstOmitted; index <= lastChanged; index += 1) {
    const cell = nextCells[index];
    tokens.push(changedIndexes.has(index) && cell ? emitEditorCell(cell) : "");
  }
  return [{ span: insertion.span, text: `| ${tokens.join(" | ")} ` }];
}

function serializeCellsAsRowSource(source: string, sourceRow: EditorRowSourceLocation, cells: EditorCell[]): string {
  const line = source.slice(sourceRow.lineSpan.start, sourceRow.lineSpan.end);
  if (line.trimStart().startsWith("@header")) {
    return emitEditorCellsAsRow(cells, "header");
  }
  if (line.trimStart().startsWith("@defaults")) {
    return emitEditorCellsAsRow(cells, "defaults");
  }
  return emitEditorCellsAsRow(cells, "row");
}

function createImplicitSheet(): EditorSheetSourceLocation {
  return {
    sheetSpan: { start: 0, end: 0 },
    rows: [],
    externalSources: [],
    editable: true,
    format: { kind: "cello" }
  };
}

function buildReadonlySheetMessage(name: string, format: SheetFormat, external: boolean): string {
  const label = formatLabel(format);
  const detail = external
    ? `${label} sheets loaded from external sources are read-only in visual mode for now.`
    : `${label} sheets are read-only in visual mode for now.`;
  return `Sheet "${name}" is a ${label} sheet, so visual edits are blocked. ${detail} ${label} rows do not support source-preserved Cello cell modifiers like [bold]; switch to source mode or convert this sheet to native Cello syntax to edit formatting.`;
}

function shouldMaterializeImplicitWorkbook(document: EditorDocument, nextWorkbook: EditorWorkbook): boolean {
  return document.sourceMap.sheets.some((sourceSheet, sheetIndex) =>
    !sourceSheet.declaration &&
    sourceSheet.rows.length === 0 &&
    !sourceSheet.defaults &&
    !sheetEqual(document.workbook.sheets[sheetIndex], nextWorkbook.sheets[sheetIndex])
  );
}

function materializeImplicitWorkbook(
  document: EditorDocument,
  nextWorkbook: EditorWorkbook,
  lineEnding: string
): Patch[] {
  if (document.source.length === 0) {
    return [{
      span: { start: 0, end: 0 },
      text: toLineEndings(nextWorkbook.sheets.map(emitEditorSheet).join("\n\n"), lineEnding)
    }];
  }
  const sheet = nextWorkbook.sheets[0];
  if (!sheet) {
    return [];
  }
  const emitted = emitEditorSheet(sheet);
  const [declaration = emitEditorSheetDeclaration(sheet), ...bodyLines] = emitted.split("\n");
  const patches: Patch[] = [{ span: { start: 0, end: 0 }, text: `${declaration}${lineEnding}` }];
  if (bodyLines.length > 0) {
    patches.push({
      span: { start: document.source.length, end: document.source.length },
      text: `${document.source.endsWith(lineEnding) ? "" : lineEnding}${bodyLines.join(lineEnding)}`
    });
  }
  return patches;
}

function getInsertedRowsPatch(
  source: string,
  sourceSheet: EditorSheetSourceLocation,
  currentRows: EditorRow[],
  nextRows: EditorRow[]
): Patch | undefined {
  if (nextRows.length <= currentRows.length) {
    return undefined;
  }
  let prefix = 0;
  while (prefix < currentRows.length && rowEqual(currentRows[prefix], nextRows[prefix])) {
    prefix += 1;
  }
  let suffix = 0;
  while (
    suffix < currentRows.length - prefix &&
    rowEqual(currentRows[currentRows.length - suffix - 1], nextRows[nextRows.length - suffix - 1])
  ) {
    suffix += 1;
  }
  if (prefix + suffix !== currentRows.length) {
    return undefined;
  }
  const inserted = nextRows.slice(prefix, nextRows.length - suffix);
  const lineEnding = getSourceLineEnding(source);
  const text = inserted.map(emitEditorRow).join(lineEnding);
  if (prefix > 0) {
    const previous = sourceSheet.rows[prefix - 1];
    return previous
      ? { span: { start: previous.lineSpan.end, end: previous.lineSpan.end }, text: `${lineEnding}${text}` }
      : undefined;
  }
  const next = sourceSheet.rows[0];
  if (next) {
    return { span: { start: next.lineSpan.start, end: next.lineSpan.start }, text: `${text}${lineEnding}` };
  }
  const anchor = sourceSheet.defaults ?? sourceSheet.declaration;
  return anchor
    ? { span: { start: anchor.lineSpan.end, end: anchor.lineSpan.end }, text: `${lineEnding}${text}` }
    : undefined;
}

function getSourceLineEnding(source: string): "\n" | "\r\n" {
  return source.includes("\r\n") ? "\r\n" : "\n";
}

function toLineEndings(source: string, lineEnding: string): string {
  return lineEnding === "\n" ? source : source.replaceAll("\n", lineEnding);
}

function formatLabel(format: SheetFormat): string {
  if (format.kind === "delimited") {
    return (format.alias ?? "delimited").toUpperCase();
  }
  return format.kind.toUpperCase();
}

function applyPatches(source: string, patches: Patch[]): string {
  const sorted = [...patches].sort((left, right) => right.span.start - left.span.start);
  let next = source;
  for (const patch of sorted) {
    next = `${next.slice(0, patch.span.start)}${patch.text}${next.slice(patch.span.end)}`;
  }
  return next;
}

function expandCellPatchSpan(source: string, sourceRow: EditorRowSourceLocation, span: EditorSourceSpan): EditorSourceSpan {
  const line = source.slice(sourceRow.lineSpan.start, sourceRow.lineSpan.end);
  const spanEndInLine = span.end - sourceRow.lineSpan.start;
  const nextPipe = line.indexOf("|", spanEndInLine);
  if (nextPipe < 0) {
    return span;
  }
  const trailing = line.slice(spanEndInLine, nextPipe);
  if (!/^\s+$/.test(trailing) || trailing.length <= 1) {
    return span;
  }
  return { start: span.start, end: span.end + trailing.length - 1 };
}

function expandRemovedSheetSpan(source: string, span: EditorSourceSpan): EditorSourceSpan {
  let start = span.start;
  let end = span.end;
  while (start > 0 && source[start - 1] === "\n") {
    start -= 1;
  }
  while (end < source.length && source[end] === "\n") {
    end += 1;
    if (end < source.length && source[end] === "\n") {
      end += 1;
      break;
    }
  }
  return { start, end };
}
