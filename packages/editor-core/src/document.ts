import { isSheetFormatModifier, parse, parseSheetFormat, parseTrailingModifiers } from "../../core/src/index.js";
import type { AliasDeclaration, Modifier, SheetFormat, SheetLayout } from "../../core/src/index.js";
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
  EditorSourceMap,
  EditorSourceSpan,
  EditorWorkbook
} from "./model.js";
import { rejectExternalSource } from "./options.js";
import type { CreateEditorWorkbookOptions } from "./options.js";
import {
  serializeEditorCell,
  serializeEditorCellsAsRow,
  serializeEditorDefaultsRow,
  serializeEditorRow,
  serializeEditorSheetDeclaration,
  serializeEditorWorkbook
} from "./serialization.js";
import { createEditorWorkbookFromAst } from "./workbook.js";

interface Patch {
  span: EditorSourceSpan;
  text: string;
}

interface SourceLine {
  text: string;
  start: number;
  end: number;
  line: number;
}

export function createEditorDocument(source: string, options: CreateEditorWorkbookOptions = {}): EditorDocument {
  const diagnostics: EditorDiagnostic[] = [];
  const ast = parse(source, {
    ...(options.anonymousSheetName === undefined ? {} : { anonymousSheetName: options.anonymousSheetName }),
    ...(options.baseDir === undefined ? {} : { baseDir: options.baseDir }),
    readExternalSource: options.readExternalSource ?? rejectExternalSource,
    ...(options.strict === undefined ? {} : { strict: options.strict })
  });
  diagnostics.push(...ast.diagnostics);

  const sourceMap = buildEditorSourceMap(source, options, diagnostics);
  const workbook = createEditorWorkbookFromAst(ast);
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

  const nextSource = applyPatches(document.source, patchesOrFailure);
  return {
    ok: true,
    source: nextSource,
    document: createEditorDocument(nextSource, options)
  };
}

function buildWorkbookPatches(
  document: EditorDocument,
  nextWorkbook: EditorWorkbook
): Patch[] | Pick<EditorCommandFailure, "reason" | "message"> {
  const current = document.workbook;
  const patches: Patch[] = [];
  if (!aliasesEqual(current.aliases ?? [], nextWorkbook.aliases ?? [])) {
    return { reason: "unsupported-source-region", message: "Alias edits cannot be source-preserved in visual mode yet." };
  }

  if (shouldMaterializeImplicitWorkbook(document, nextWorkbook)) {
    return [{ span: { start: 0, end: document.source.length }, text: serializeEditorWorkbook(nextWorkbook) }];
  }

  if (nextWorkbook.sheets.length === current.sheets.length + 1 && sheetsEqual(nextWorkbook.sheets.slice(0, -1), current.sheets)) {
    patches.push({ span: { start: document.source.length, end: document.source.length }, text: `${document.source.endsWith("\n") ? "\n" : "\n\n"}${serializeEditorWorkbook({ sheets: [nextWorkbook.sheets[nextWorkbook.sheets.length - 1] as EditorSheet] })}` });
    return patches;
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

    const sheetPatch = patchSheetDeclaration(sourceSheet, currentSheet, nextSheet);
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

function patchSheetDeclaration(sourceSheet: EditorSheetSourceLocation, current: EditorSheet, next: EditorSheet): Patch | undefined {
  if (current.name === next.name && sheetLayoutsEqual(current.layout, next.layout)) {
    return undefined;
  }
  if (!sourceSheet.declaration) {
    return { span: { start: sourceSheet.sheetSpan.start, end: sourceSheet.sheetSpan.start }, text: `${serializeEditorSheetDeclaration(next)}\n` };
  }
  return { span: sourceSheet.declaration.lineSpan, text: serializeEditorSheetDeclaration(next) };
}

function patchDefaults(
  source: string,
  sourceSheet: EditorSheetSourceLocation,
  current: EditorSheet,
  next: EditorSheet
): Patch[] | { reason: "unsupported-source-region" | "stale-source-map" | "ambiguous-cell-location"; message: string } {
  if (cellsEqual(current.defaults, next.defaults)) {
    return [];
  }
  if (!sourceSheet.defaults) {
    const anchor = sourceSheet.rows.find((row) => row.sourceKind === "header") ?? sourceSheet.declaration;
    if (!anchor) {
      return { reason: "stale-source-map", message: "A defaults row cannot be inserted without a mapped sheet anchor." };
    }
    const defaults = serializeEditorDefaultsRow(next);
    return defaults ? [{ span: { start: anchor.lineSpan.end, end: anchor.lineSpan.end }, text: `\n${defaults}` }] : [];
  }
  return patchRowCells(source, sourceSheet.defaults, current.defaults, next.defaults, "defaults");
}

function patchRows(
  source: string,
  sourceSheet: EditorSheetSourceLocation,
  current: EditorSheet,
  next: EditorSheet
): Patch[] | { reason: "unsupported-source-region" | "stale-source-map" | "ambiguous-cell-location"; message: string } {
  if (rowsEqual(current.rows, next.rows)) {
    return [];
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
        const currentCells = trimTrailingEmptyCells(currentRow.cells);
        const nextCells = trimTrailingEmptyCells(nextRow.cells);
        if (currentRow.kind !== nextRow.kind || currentCells.length > sourceRow.cells.length || !modifiersEqual(currentRow.modifiers, nextRow.modifiers)) {
          patches.push({ span: sourceRow.lineSpan, text: serializeEditorRow({ ...nextRow, cells: nextCells }) });
          continue;
        }
        const cellPatches = patchRowCells(source, sourceRow, currentCells, nextCells, "row");
        if (!Array.isArray(cellPatches)) {
          return cellPatches;
        }
        patches.push(...cellPatches);
        continue;
      }
      if (!modifiersEqual(currentRow.modifiers, nextRow.modifiers)) {
        patches.push({ span: sourceRow.lineSpan, text: serializeEditorRow(nextRow) });
        continue;
      }
      const cellPatches = patchRowCells(source, sourceRow, trimTrailingEmptyCells(currentRow.cells), trimTrailingEmptyCells(nextRow.cells), "row");
      if (!Array.isArray(cellPatches)) {
        return cellPatches;
      }
      patches.push(...cellPatches);
    }
    return patches;
  }

  if (next.rows.length === current.rows.length + 1) {
    const insertIndex = findInsertedRowIndex(current.rows, next.rows);
    if (insertIndex < 0) {
      return { reason: "ambiguous-cell-location", message: "The inserted row location could not be determined." };
    }
    const previous = sourceSheet.rows[insertIndex - 1] ?? sourceSheet.declaration;
    if (!previous) {
      return { reason: "stale-source-map", message: "The inserted row anchor could not be mapped to source." };
    }
    const insertedRow = next.rows[insertIndex] as EditorRow;
    return [{ span: { start: previous.lineSpan.end, end: previous.lineSpan.end }, text: `\n${serializeEditorRow({ ...insertedRow, cells: trimTrailingEmptyCells(insertedRow.cells) })}` }];
  }

  return { reason: "unsupported-source-region", message: "This row change cannot be source-preserved yet." };
}

function patchRowCells(
  source: string,
  sourceRow: EditorRowSourceLocation,
  currentCells: EditorCell[],
  nextCells: EditorCell[],
  label: string
): Patch[] | { reason: "unsupported-source-region" | "stale-source-map" | "ambiguous-cell-location"; message: string } {
  if (currentCells.length !== nextCells.length) {
    const trimmedCurrentCells = trimTrailingEmptyCells(currentCells);
    const trimmedNextCells = trimTrailingEmptyCells(nextCells);
    if (trimmedCurrentCells.length === trimmedNextCells.length) {
      return patchRowCells(source, sourceRow, trimmedCurrentCells, trimmedNextCells, label);
    }
    return [{ span: sourceRow.lineSpan, text: serializeCellsAsRowSource(source, sourceRow, trimmedNextCells) }];
  }
  const patches: Patch[] = [];
  for (const [cellIndex, nextCell] of nextCells.entries()) {
    const currentCell = currentCells[cellIndex];
    if (!currentCell || cellEqual(currentCell, nextCell)) {
      continue;
    }
    const sourceCell = sourceRow.cells[cellIndex];
    if (!sourceCell) {
      return { reason: "stale-source-map", message: `The edited ${label} cell ${cellIndex + 1} could not be mapped to source.` };
    }
    patches.push({ span: expandCellPatchSpan(source, sourceRow, sourceCell.span), text: serializeEditorCell(nextCell) });
  }
  return patches;
}

function serializeCellsAsRowSource(source: string, sourceRow: EditorRowSourceLocation, cells: EditorCell[]): string {
  const line = source.slice(sourceRow.lineSpan.start, sourceRow.lineSpan.end);
  if (line.trimStart().startsWith("@header")) {
    return serializeEditorCellsAsRow(cells, "header");
  }
  if (line.trimStart().startsWith("@defaults")) {
    return serializeEditorCellsAsRow(cells, "defaults");
  }
  return serializeEditorCellsAsRow(cells, "row");
}

function findInsertedRowIndex(currentRows: EditorRow[], nextRows: EditorRow[]): number {
  for (let index = 0; index < nextRows.length; index += 1) {
    const currentAtIndex = currentRows[index];
    const nextAtIndex = nextRows[index];
    if (!currentAtIndex || !nextAtIndex || !rowEqual(currentAtIndex, nextAtIndex)) {
      return index;
    }
  }
  return -1;
}

function buildEditorSourceMap(source: string, options: CreateEditorWorkbookOptions, diagnostics: EditorDiagnostic[]): EditorSourceMap {
  const lines = splitSourceLines(source);
  const sheets: EditorSheetSourceLocation[] = [];
  let currentSheet = createImplicitSheet();
  let currentFormat: SheetFormat = { kind: "cello" };
  let hasSheetContent = false;

  const pushCurrentSheet = () => {
    if (hasSheetContent || currentSheet.declaration || currentSheet.rows.length > 0 || currentSheet.externalSources.length > 0) {
      sheets.push(currentSheet);
    }
  };

  for (const line of lines) {
    const trimmed = line.text.trim();
    const declaration = getSheetDeclaration(line);
    if (declaration) {
      pushCurrentSheet();
      currentSheet = {
        declaration,
        sheetSpan: { start: line.start, end: line.end },
        rows: [],
        externalSources: [],
        editable: declaration.format.kind === "cello",
        format: declaration.format
      };
      currentFormat = declaration.format;
      hasSheetContent = true;
      continue;
    }

    if (trimmed.length === 0 || trimmed.startsWith("//")) {
      continue;
    }

    if (isAliasDeclaration(trimmed)) {
      continue;
    }

    if (/^->\s+(.+)$/.test(trimmed)) {
      hasSheetContent = true;
      currentSheet.sheetSpan.end = line.end;
      const path = trimmed.replace(/^->\s+/, "").trim();
      currentSheet.externalSources.push({ path, line: line.line, lineSpan: { start: line.start, end: line.end } });
      if (!options.readExternalSource) {
        diagnostics.push({
          level: "warning",
          line: line.line,
          code: "external-source-unsupported",
          message: `External sources are not available in this editor host: ${path}`
        });
      }
      currentSheet.editable = false;
      continue;
    }

    if (currentFormat.kind !== "cello") {
      hasSheetContent = true;
      currentSheet.sheetSpan.end = line.end;
      currentSheet.editable = false;
      continue;
    }

    const row = getNativeRowLocation(line);
    if (!row) {
      hasSheetContent = true;
      currentSheet.sheetSpan.end = line.end;
      continue;
    }
    hasSheetContent = true;
    currentSheet.sheetSpan.end = line.end;
    if (row.sourceKind === "defaults") {
      currentSheet.defaults = row;
    } else {
      currentSheet.rows.push(row);
    }
  }

  pushCurrentSheet();
  if (sheets.length === 0) {
    sheets.push(createImplicitSheet());
  }
  return { sheets };
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
  const hasImplicitSheet = document.sourceMap.sheets.some((sourceSheet) => !sourceSheet.declaration);
  if (!hasImplicitSheet) {
    return false;
  }
  if (document.workbook.sheets.length !== nextWorkbook.sheets.length) {
    return true;
  }
  return document.sourceMap.sheets.some((sourceSheet, sheetIndex) =>
    !sourceSheet.declaration && !sheetEqual(document.workbook.sheets[sheetIndex], nextWorkbook.sheets[sheetIndex])
  );
}

function formatLabel(format: SheetFormat): string {
  if (format.kind === "delimited") {
    return (format.alias ?? "delimited").toUpperCase();
  }
  return format.kind.toUpperCase();
}

function getSheetDeclaration(line: SourceLine): (NonNullable<EditorSheetSourceLocation["declaration"]> & { format: SheetFormat }) | undefined {
  const marker = line.text.match(/^(\s*)@sheet(?:\s+|$)/);
  if (!marker) {
    return undefined;
  }
  const nameStartInLine = marker[0].length;
  const modifierStart = line.text.indexOf("[", nameStartInLine);
  const nameEndInLine = modifierStart >= 0 ? modifierStart : line.text.length;
  const rawName = line.text.slice(nameStartInLine, nameEndInLine);
  const trimmedNameStart = rawName.search(/\S/);
  const nameStart = line.start + nameStartInLine + (trimmedNameStart < 0 ? 0 : trimmedNameStart);
  const trimmedNameEnd = rawName.trimEnd().length;
  const format = getSheetFormatFromDeclaration(line.text);
  return {
    line: line.line,
    lineSpan: { start: line.start, end: line.end },
    nameSpan: { start: nameStart, end: line.start + nameStartInLine + trimmedNameEnd },
    format
  };
}

function getSheetFormatFromDeclaration(line: string): SheetFormat {
  const sheetMatch = line.trim().match(/^@sheet\s+(.+)$/);
  const parsed = parseTrailingModifiers(sheetMatch?.[1] ?? "");
  const format = parsed.modifiers.find(isSheetFormatModifier);
  return parseSheetFormat(format?.raw);
}

function isAliasDeclaration(trimmed: string): boolean {
  return /^@(tone|width|height)(?:\s|$)/.test(trimmed);
}

function getNativeRowLocation(line: SourceLine): EditorRowSourceLocation | undefined {
  const trimmed = line.text.trim();
  const kind = trimmed.startsWith("@header") ? "header" : trimmed.startsWith("@defaults") ? "defaults" : "row";
  if (!line.text.includes("|")) {
    return undefined;
  }
  if ((kind === "header" || kind === "defaults") && !new RegExp(`^\\s*@${kind}(?:\\s|$)`).test(line.text)) {
    return undefined;
  }
  const pipeStart = line.text.indexOf("|");
  return {
    line: line.line,
    sourceKind: kind,
    lineSpan: { start: line.start, end: line.end },
    cells: getCellSpans(line.text, line.start, pipeStart)
  };
}

function getCellSpans(text: string, lineStart: number, firstPipe: number): Array<{ span: EditorSourceSpan }> {
  const pipeIndexes: number[] = [];
  for (let index = firstPipe; index < text.length; index += 1) {
    if (text[index] === "|") {
      pipeIndexes.push(index);
    }
  }
  const spans: Array<{ span: EditorSourceSpan }> = [];
  for (let index = 0; index < pipeIndexes.length - 1; index += 1) {
    const leftPipe = pipeIndexes[index];
    const rawEnd = pipeIndexes[index + 1];
    if (leftPipe === undefined || rawEnd === undefined) {
      continue;
    }
    const rawStart = leftPipe + 1;
    const token = text.slice(rawStart, rawEnd);
    const leading = token.match(/^\s*/)?.[0].length ?? 0;
    const trailing = token.match(/\s*$/)?.[0].length ?? 0;
    spans.push({ span: { start: lineStart + rawStart + leading, end: lineStart + rawEnd - trailing } });
  }
  return spans;
}

function splitSourceLines(source: string): SourceLine[] {
  const lines: SourceLine[] = [];
  let start = 0;
  let line = 1;
  for (let index = 0; index <= source.length; index += 1) {
    if (index === source.length || source[index] === "\n") {
      lines.push({ text: source.slice(start, index), start, end: index, line });
      start = index + 1;
      line += 1;
    }
  }
  return lines;
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

function sheetsEqual(left: EditorSheet[], right: EditorSheet[]): boolean {
  return left.length === right.length && left.every((sheet, index) => sheetEqual(sheet, right[index]));
}

function sheetEqual(left: EditorSheet | undefined, right: EditorSheet | undefined): boolean {
  if (!left || !right) {
    return false;
  }
  return (
    left.name === right.name &&
    sheetFormatsEqual(left.format, right.format) &&
    sheetLayoutsEqual(left.layout, right.layout) &&
    rowsEqual(left.rows, right.rows) &&
    cellsEqual(left.defaults, right.defaults)
  );
}

function rowsEqual(left: EditorRow[], right: EditorRow[]): boolean {
  return left.length === right.length && left.every((row, index) => rowEqual(row, right[index]));
}

function rowEqual(left: EditorRow | undefined, right: EditorRow | undefined): boolean {
  if (!left || !right) {
    return false;
  }
  return (
    left.kind === right.kind &&
    modifiersEqual(left.modifiers, right.modifiers) &&
    cellsEqual(left.cells, right.cells)
  );
}

function cellsEqual(left: EditorCell[], right: EditorCell[]): boolean {
  const trimmedLeft = trimTrailingEmptyCells(left);
  const trimmedRight = trimTrailingEmptyCells(right);
  return trimmedLeft.length === trimmedRight.length && trimmedLeft.every((cell, index) => cellEqual(cell, trimmedRight[index]));
}

function cellEqual(left: EditorCell | undefined, right: EditorCell | undefined): boolean {
  if (!left || !right) {
    return false;
  }
  return left.raw === right.raw && modifiersEqual(left.modifiers, right.modifiers);
}

function modifiersEqual(left: Modifier[], right: Modifier[]): boolean {
  return left.length === right.length && left.every((modifier, index) => modifierEqual(modifier, right[index]));
}

function modifierEqual(left: Modifier, right: Modifier | undefined): boolean {
  if (!right) {
    return false;
  }
  return left.raw === right.raw && left.key === right.key && left.value === right.value;
}

function aliasesEqual(left: AliasDeclaration[], right: AliasDeclaration[]): boolean {
  return left.length === right.length && left.every((alias, index) => {
    const candidate = right[index];
    if (!candidate) {
      return false;
    }
    return (
      alias.namespace === candidate.namespace &&
      alias.name === candidate.name &&
      modifiersEqual(alias.modifiers, candidate.modifiers)
    );
  });
}

function sheetLayoutsEqual(left: SheetLayout | undefined, right: SheetLayout | undefined): boolean {
  return (left?.columns ?? undefined) === (right?.columns ?? undefined) && (left?.rows ?? undefined) === (right?.rows ?? undefined);
}

function sheetFormatsEqual(left: SheetFormat, right: SheetFormat): boolean {
  if (left.kind !== right.kind) {
    return false;
  }
  if (left.kind === "delimited" && right.kind === "delimited") {
    return left.delimiter === right.delimiter && left.noHeader === right.noHeader && left.alias === right.alias;
  }
  if (left.kind === "json" && right.kind === "json") {
    return left.path === right.path;
  }
  return true;
}

function trimTrailingEmptyCells(cells: EditorCell[]): EditorCell[] {
  let end = cells.length;
  while (end > 0 && isEmptyCell(cells[end - 1])) {
    end -= 1;
  }
  return cells.slice(0, end);
}

function isEmptyCell(cell: EditorCell | undefined): boolean {
  return Boolean(cell) && cell?.raw.trim() === "" && cell.modifiers.length === 0;
}
