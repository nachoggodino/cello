import type { EditorCell, EditorRow, EditorRowSourceLocation, EditorSheet, EditorSheetSourceLocation } from "../model.js";
import { cellEqual, cellsEqual, modifiersEqual, rowEqual, rowsEqual } from "../equality.js";
import { emitEditorCell, emitEditorCellsAsRow, emitEditorDefaultsRow, emitEditorRow } from "../syntax-emitter.js";
import { expandCellPatchSpan, getSourceLineEnding, toLineEndings } from "./source.js";
import type { PatchFailure, PatchPlan, SourcePatch } from "./types.js";

export function planDefaultsPatches(source: string, sourceSheet: EditorSheetSourceLocation, current: EditorSheet, next: EditorSheet): PatchPlan {
  if (cellsEqual(current.defaults, next.defaults)) {
    return [];
  }
  if (!sourceSheet.defaults) {
    const anchor = sourceSheet.rows.find((row) => row.sourceKind === "header") ?? sourceSheet.declaration;
    if (!anchor) {
      return { reason: "stale-source-map", message: "A defaults row cannot be inserted without a mapped sheet anchor." };
    }
    const defaults = emitEditorDefaultsRow(next);
    return defaults
      ? [
          {
            span: { start: anchor.lineSpan.end, end: anchor.lineSpan.end },
            text: `${getSourceLineEnding(source)}${defaults}`
          }
        ]
      : [];
  }
  return planRowCellPatches(source, sourceSheet.defaults, current.defaults, next.defaults, "defaults");
}

export function planNativeRowPatches(source: string, sourceSheet: EditorSheetSourceLocation, current: EditorSheet, next: EditorSheet): PatchPlan {
  if (rowsEqual(current.rows, next.rows)) {
    return [];
  }

  const insertionPatch = getInsertedRowsPatch(source, sourceSheet, current.rows, next.rows);
  if (insertionPatch) {
    return [insertionPatch];
  }

  if (current.rows.length === next.rows.length) {
    return planChangedRows(source, sourceSheet, current, next);
  }

  if (next.rows.length > current.rows.length) {
    return planAppendedRows(source, sourceSheet, current, next);
  }

  return { reason: "unsupported-source-region", message: "This row change cannot be source-preserved yet." };
}

function planChangedRows(source: string, sourceSheet: EditorSheetSourceLocation, current: EditorSheet, next: EditorSheet): PatchPlan {
  const patches: SourcePatch[] = [];
  for (const [rowIndex, nextRow] of next.rows.entries()) {
    const currentRow = current.rows[rowIndex];
    const sourceRow = sourceSheet.rows[rowIndex];
    if (!currentRow || rowEqual(currentRow, nextRow)) {
      continue;
    }
    if (!sourceRow) {
      return { reason: "stale-source-map", message: `Row ${rowIndex + 1} could not be mapped to source.` };
    }
    const rowPatch = planChangedRow(source, sourceRow, currentRow, nextRow, rowIndex);
    if (!Array.isArray(rowPatch)) {
      return rowPatch;
    }
    patches.push(...rowPatch);
  }
  return patches;
}

function planChangedRow(source: string, sourceRow: EditorRowSourceLocation, current: EditorRow, next: EditorRow, rowIndex: number): PatchPlan {
  const structureChanged = current.kind !== next.kind || current.cells.length !== next.cells.length;
  if (structureChanged || !modifiersEqual(current.modifiers, next.modifiers)) {
    return rowContainsDefaultDerivedCell(sourceRow, current) ? sourceProvenanceFailure(rowIndex) : [{ span: sourceRow.lineSpan, text: emitEditorRow(next) }];
  }
  return planRowCellPatches(source, sourceRow, current.cells, next.cells, "row");
}

function planAppendedRows(source: string, sourceSheet: EditorSheetSourceLocation, current: EditorSheet, next: EditorSheet): PatchPlan {
  const sharedRows = next.rows.slice(0, current.rows.length);
  const sharedPatches = planNativeRowPatches(source, sourceSheet, current, { ...next, rows: sharedRows });
  if (!Array.isArray(sharedPatches)) {
    return sharedPatches;
  }
  const previous = sourceSheet.rows[current.rows.length - 1] ?? sourceSheet.defaults ?? sourceSheet.declaration;
  if (!previous) {
    return { reason: "stale-source-map", message: "The appended row anchor could not be mapped to source." };
  }
  const lineEnding = getSourceLineEnding(source);
  const appendedRows = next.rows
    .slice(current.rows.length)
    .map((row) => emitEditorRow(row))
    .join(lineEnding);
  return [
    ...sharedPatches,
    {
      span: { start: previous.lineSpan.end, end: previous.lineSpan.end },
      text: `${lineEnding}${toLineEndings(appendedRows, lineEnding)}`
    }
  ];
}

function rowContainsDefaultDerivedCell(sourceRow: EditorRowSourceLocation, row: EditorRow): boolean {
  return row.cells.some((_, index) => sourceRow.cells[index]?.valueOrigin === "default-derived");
}

function sourceProvenanceFailure(rowIndex: number): PatchFailure {
  return {
    reason: "source-provenance-required",
    message: `Row ${rowIndex + 1} contains inherited defaults. This structural edit is blocked because preserving inherited-default provenance is not implemented yet.`
  };
}

function planRowCellPatches(source: string, sourceRow: EditorRowSourceLocation, currentCells: EditorCell[], nextCells: EditorCell[], label: string): PatchPlan {
  if (currentCells.length !== nextCells.length) {
    return [{ span: sourceRow.lineSpan, text: serializeCellsAsRowSource(source, sourceRow, nextCells) }];
  }
  const patches: SourcePatch[] = [];
  const omittedChanges = new Set<number>();
  for (const [cellIndex, nextCell] of nextCells.entries()) {
    const currentCell = currentCells[cellIndex];
    if (!currentCell || cellEqual(currentCell, nextCell)) {
      continue;
    }
    const failure = planCellPatch(source, sourceRow, nextCell, cellIndex, label, patches, omittedChanges);
    if (failure) {
      return failure;
    }
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

function planCellPatch(
  source: string,
  sourceRow: EditorRowSourceLocation,
  nextCell: EditorCell,
  cellIndex: number,
  label: string,
  patches: SourcePatch[],
  omittedChanges: Set<number>
): PatchFailure | undefined {
  const sourceCell = sourceRow.cells[cellIndex];
  if (!sourceCell) {
    return { reason: "stale-source-map", message: `The edited ${label} cell ${cellIndex + 1} could not be mapped to source.` };
  }
  if (sourceCell.sourceKind === "omitted") {
    omittedChanges.add(cellIndex);
    return undefined;
  }
  if (sourceCell.sourceKind === "explicit-empty") {
    const token = source.slice(sourceCell.tokenSpan.start, sourceCell.tokenSpan.end);
    const emitted = emitEditorCell(nextCell);
    patches.push({ span: sourceCell.tokenSpan, text: token.length > 0 ? `${token}${emitted} ` : emitted });
    return undefined;
  }
  patches.push({ span: expandCellPatchSpan(source, sourceRow, sourceCell.span), text: emitEditorCell(nextCell) });
  return undefined;
}

function materializeOmittedCells(source: string, sourceRow: EditorRowSourceLocation, nextCells: EditorCell[], changedIndexes: ReadonlySet<number>): PatchPlan {
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

function getInsertedRowsPatch(source: string, sourceSheet: EditorSheetSourceLocation, currentRows: EditorRow[], nextRows: EditorRow[]): SourcePatch | undefined {
  if (nextRows.length <= currentRows.length) {
    return undefined;
  }
  const { prefix, suffix } = findSharedRowBounds(currentRows, nextRows);
  if (prefix + suffix !== currentRows.length) {
    return undefined;
  }
  const lineEnding = getSourceLineEnding(source);
  const text = nextRows
    .slice(prefix, nextRows.length - suffix)
    .map(emitEditorRow)
    .join(lineEnding);
  return placeInsertedRowsPatch(sourceSheet, prefix, lineEnding, text);
}

function findSharedRowBounds(currentRows: EditorRow[], nextRows: EditorRow[]): { prefix: number; suffix: number } {
  let prefix = 0;
  while (prefix < currentRows.length && rowEqual(currentRows[prefix], nextRows[prefix])) {
    prefix += 1;
  }
  let suffix = 0;
  while (suffix < currentRows.length - prefix && rowEqual(currentRows[currentRows.length - suffix - 1], nextRows[nextRows.length - suffix - 1])) {
    suffix += 1;
  }
  return { prefix, suffix };
}

function placeInsertedRowsPatch(sourceSheet: EditorSheetSourceLocation, prefix: number, lineEnding: string, text: string): SourcePatch | undefined {
  if (prefix > 0) {
    const previous = sourceSheet.rows[prefix - 1];
    if (!previous) {
      return undefined;
    }
    return { span: { start: previous.lineSpan.end, end: previous.lineSpan.end }, text: `${lineEnding}${text}` };
  }
  const next = sourceSheet.rows[0];
  if (next) {
    return { span: { start: next.lineSpan.start, end: next.lineSpan.start }, text: `${text}${lineEnding}` };
  }
  const anchor = sourceSheet.defaults ?? sourceSheet.declaration;
  if (!anchor) {
    return undefined;
  }
  return { span: { start: anchor.lineSpan.end, end: anchor.lineSpan.end }, text: `${lineEnding}${text}` };
}
