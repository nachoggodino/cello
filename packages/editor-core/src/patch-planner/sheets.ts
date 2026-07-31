import type { SheetFormat } from "../../../core/src/internal.js";
import type { EditorDocument, EditorSheet, EditorSheetSourceLocation, EditorWorkbook } from "../model.js";
import { sheetEqual, sheetFormatsEqual, sheetLayoutsEqual, sheetsEqual } from "../equality.js";
import { emitEditorSheet, emitEditorSheetDeclaration, emitEditorSheetName, emitForeignEditorSheet } from "../syntax-emitter.js";
import { expandRemovedSheetSpan, getSourceLineEnding, toLineEndings } from "./source.js";
import type { PatchPlan, SourcePatch } from "./types.js";

export interface SheetStructurePlan {
  handled: boolean;
  plan: PatchPlan;
}

export function createImplicitSheetLocation(): EditorSheetSourceLocation {
  return {
    sheetSpan: { start: 0, end: 0 },
    rows: [],
    externalSources: [],
    editable: true,
    format: { kind: "cello" }
  };
}

export function planSheetStructure(document: EditorDocument, nextWorkbook: EditorWorkbook, lineEnding: string): SheetStructurePlan {
  const current = document.workbook;
  const addition = planSheetAddition(document, nextWorkbook, lineEnding);
  if (addition) {
    return { handled: true, plan: addition };
  }
  if (shouldMaterializeImplicitWorkbook(document, nextWorkbook)) {
    return { handled: true, plan: materializeImplicitWorkbook(document, nextWorkbook, lineEnding) };
  }
  if (nextWorkbook.sheets.length === current.sheets.length - 1) {
    return { handled: true, plan: planSheetRemoval(document, nextWorkbook) };
  }
  if (nextWorkbook.sheets.length !== current.sheets.length) {
    return {
      handled: true,
      plan: { reason: "unsupported-source-region", message: "This sheet count change cannot be source-preserved yet." }
    };
  }
  return { handled: false, plan: [] };
}

export function planSheetDeclaration(source: string, sourceSheet: EditorSheetSourceLocation, current: EditorSheet, next: EditorSheet): SourcePatch | undefined {
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

export function planForeignSheet(document: EditorDocument, sourceSheet: EditorSheetSourceLocation, current: EditorSheet, next: EditorSheet, lineEnding: string): PatchPlan {
  if (document.diagnostics.some((diagnostic) => diagnostic.severity === "error" && diagnostic.sheet === current.name)) {
    return {
      reason: "source-provenance-required",
      message: `Sheet "${current.name}" has format errors, so its source region cannot be rewritten safely.`
    };
  }
  if (!sheetFormatsEqual(current.format, next.format)) {
    return {
      reason: "unsupported-source-region",
      message: "Foreign-format edits must retain the sheet's declared storage format."
    };
  }
  if (hasNativeOnlyFeatures(next)) {
    return {
      reason: "unsupported-source-region",
      message: `${formatLabel(current.format)} sheets support literal grid values only; Cello modifiers and defaults are unavailable.`
    };
  }
  return [{ span: sourceSheet.sheetSpan, text: toLineEndings(emitForeignEditorSheet(next), lineEnding) }];
}

export function readonlySheetFailure(current: EditorSheet, sourceSheet: EditorSheetSourceLocation): PatchPlan {
  const external = sourceSheet.externalSources.length > 0;
  return {
    reason: external ? "external-source-unavailable" : "unsupported-source-region",
    message: buildReadonlySheetMessage(current.name, sourceSheet.format, external)
  };
}

function planSheetAddition(document: EditorDocument, nextWorkbook: EditorWorkbook, lineEnding: string): SourcePatch[] | undefined {
  const current = document.workbook;
  if (nextWorkbook.sheets.length !== current.sheets.length + 1 || !sheetsEqual(nextWorkbook.sheets.slice(0, -1), current.sheets)) {
    return undefined;
  }
  if (document.source.length === 0) {
    return [{ span: { start: 0, end: 0 }, text: toLineEndings(nextWorkbook.sheets.map(emitEditorSheet).join("\n\n"), lineEnding) }];
  }
  const patches: SourcePatch[] = [];
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
    return [];
  }
  const emittedSheet = toLineEndings(emitEditorSheet(appendedSheet), lineEnding);
  patches.push({
    span: { start: document.source.length, end: document.source.length },
    text: `${document.source.endsWith(lineEnding) ? lineEnding : lineEnding + lineEnding}${emittedSheet}`
  });
  return patches;
}

function planSheetRemoval(document: EditorDocument, nextWorkbook: EditorWorkbook): PatchPlan {
  const removedIndex = document.workbook.sheets.findIndex((sheet, index) => !sheetsEqual([sheet], [nextWorkbook.sheets[index] as EditorSheet]));
  const sourceSheet = document.sourceMap.sheets[removedIndex];
  if (!sourceSheet) {
    return { reason: "stale-source-map", message: "The removed sheet could not be mapped to source." };
  }
  return [{ span: expandRemovedSheetSpan(document.source, sourceSheet.sheetSpan), text: "" }];
}

function shouldMaterializeImplicitWorkbook(document: EditorDocument, nextWorkbook: EditorWorkbook): boolean {
  return document.sourceMap.sheets.some(
    (sourceSheet, sheetIndex) =>
      !sourceSheet.declaration && sourceSheet.rows.length === 0 && !sourceSheet.defaults && !sheetEqual(document.workbook.sheets[sheetIndex], nextWorkbook.sheets[sheetIndex])
  );
}

function materializeImplicitWorkbook(document: EditorDocument, nextWorkbook: EditorWorkbook, lineEnding: string): SourcePatch[] {
  if (document.source.length === 0) {
    return [{ span: { start: 0, end: 0 }, text: toLineEndings(nextWorkbook.sheets.map(emitEditorSheet).join("\n\n"), lineEnding) }];
  }
  const sheet = nextWorkbook.sheets[0];
  if (!sheet) {
    return [];
  }
  const emitted = emitEditorSheet(sheet);
  const [declaration = emitEditorSheetDeclaration(sheet), ...bodyLines] = emitted.split("\n");
  const patches: SourcePatch[] = [{ span: { start: 0, end: 0 }, text: `${declaration}${lineEnding}` }];
  if (bodyLines.length > 0) {
    patches.push({
      span: { start: document.source.length, end: document.source.length },
      text: `${document.source.endsWith(lineEnding) ? "" : lineEnding}${bodyLines.join(lineEnding)}`
    });
  }
  return patches;
}

function hasNativeOnlyFeatures(sheet: EditorSheet): boolean {
  return (
    sheet.defaults.some((cell) => cell.raw.length > 0 || cell.modifiers.length > 0) ||
    sheet.rows.some((row) => row.modifiers.length > 0 || row.cells.some((cell) => cell.modifiers.length > 0))
  );
}

function buildReadonlySheetMessage(name: string, format: SheetFormat, external: boolean): string {
  const label = formatLabel(format);
  const detail = external ? `${label} sheets loaded from external sources are read-only in visual mode for now.` : `${label} sheets are read-only in visual mode for now.`;
  return `Sheet "${name}" is a ${label} sheet, so visual edits are blocked. ${detail} ${label} rows do not support source-preserved Cello cell modifiers like [bold]; switch to source mode or convert this sheet to native Cello syntax to edit formatting.`;
}

function formatLabel(format: SheetFormat): string {
  return format.kind === "delimited" ? (format.alias ?? "delimited").toUpperCase() : format.kind.toUpperCase();
}
