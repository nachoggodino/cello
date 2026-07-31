import { parseDocument } from "../../core/src/internal.js";
import type { EditorCommandResult, EditorDiagnostic, EditorDocument, EditorSheet, EditorSheetSourceLocation, EditorWorkbook } from "./model.js";
import { rejectExternalSource } from "./options.js";
import type { CreateEditorWorkbookOptions } from "./options.js";
import { createEditorWorkbookFromAst } from "./workbook.js";
import { aliasesEqual, persistedWorkbooksEqual, sheetEqual } from "./equality.js";
import { formatChangedSource } from "./layout-scope.js";
import { planDefaultsPatches, planNativeRowPatches } from "./patch-planner/native.js";
import { applySourcePatches, getSourceLineEnding } from "./patch-planner/source.js";
import { createImplicitSheetLocation, planForeignSheet, planSheetDeclaration, planSheetStructure, readonlySheetFailure } from "./patch-planner/sheets.js";
import type { PatchPlan, SourcePatch } from "./patch-planner/types.js";

/** Creates a source-authoritative editor document with source locations and diagnostics. */
export function createEditorDocument(source: string, options: CreateEditorWorkbookOptions = {}): EditorDocument {
  const parsed = parseDocument(source, createParseOptions(options));
  const sourceMap = parsed.sourceMap.sheets.length > 0 ? parsed.sourceMap : { sheets: [createImplicitSheetLocation()] };
  const diagnostics = collectEditorDiagnostics(parsed.workbook.diagnostics, sourceMap.sheets, options.readExternalSource !== undefined);
  const workbook = createEditorWorkbookFromAst(parsed.workbook);
  applyExternalSourceMetadata(workbook, sourceMap.sheets, options.readExternalSource !== undefined);
  return { source, workbook, sourceMap, diagnostics };
}

function createParseOptions(options: CreateEditorWorkbookOptions): NonNullable<Parameters<typeof parseDocument>[1]> {
  return {
    ...(options.anonymousSheetName === undefined ? {} : { anonymousSheetName: options.anonymousSheetName }),
    ...(options.baseDir === undefined ? {} : { baseDir: options.baseDir }),
    readExternalSource: options.readExternalSource ?? rejectExternalSource,
    ...(options.strict === undefined ? {} : { strict: options.strict })
  };
}

function collectEditorDiagnostics(
  parsedDiagnostics: readonly EditorDiagnostic[],
  sourceSheets: readonly EditorSheetSourceLocation[],
  externalSupported: boolean
): EditorDiagnostic[] {
  const diagnostics = [...parsedDiagnostics];
  if (externalSupported) {
    return diagnostics;
  }
  for (const sourceSheet of sourceSheets) {
    diagnostics.push(...sourceSheet.externalSources.map(createUnsupportedExternalDiagnostic));
  }
  return diagnostics;
}

function createUnsupportedExternalDiagnostic(externalSource: EditorSheetSourceLocation["externalSources"][number]): EditorDiagnostic {
  return {
    level: "warning",
    severity: "warning",
    line: externalSource.line,
    code: "external-source-unsupported",
    stage: "parse",
    category: "external",
    primary: { line: externalSource.line },
    context: { path: externalSource.path },
    message: "External sources are not available in this editor host: " + externalSource.path
  };
}

function applyExternalSourceMetadata(workbook: EditorWorkbook, sourceSheets: readonly EditorSheetSourceLocation[], externalSupported: boolean): void {
  for (const [sheetIndex, sheet] of workbook.sheets.entries()) {
    const externalSource = sourceSheets[sheetIndex]?.externalSources[0];
    if (!externalSource) {
      continue;
    }
    sheet.externalSource = {
      path: externalSource.path,
      status: externalSupported ? "loaded" : "unsupported",
      ...(externalSupported ? {} : { message: "External sources are not available in this editor host." })
    };
  }
}

export function applyWorkbookPatch(document: EditorDocument, nextWorkbook: EditorWorkbook, options: CreateEditorWorkbookOptions = {}): EditorCommandResult {
  if (document.diagnostics.some((diagnostic) => diagnostic.code === "duplicate-sheet-identity" || diagnostic.code === "duplicate-alias-identity")) {
    return {
      ok: false,
      reason: "unsupported-source-region",
      message: "Workbook identities are ambiguous; resolve duplicate sheets or aliases before editing.",
      document
    };
  }
  const patchesOrFailure = buildWorkbookPatches(document, nextWorkbook);
  if (!Array.isArray(patchesOrFailure)) {
    return {
      ok: false,
      reason: patchesOrFailure.reason,
      message: patchesOrFailure.message,
      document
    };
  }

  const patchedSource = applySourcePatches(document.source, patchesOrFailure);
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

function buildWorkbookPatches(document: EditorDocument, nextWorkbook: EditorWorkbook): PatchPlan {
  const current = document.workbook;
  if (!aliasesEqual(current.aliases ?? [], nextWorkbook.aliases ?? [])) {
    return { reason: "unsupported-source-region", message: "Alias edits cannot be source-preserved in visual mode yet." };
  }

  const lineEnding = getSourceLineEnding(document.source);
  const structure = planSheetStructure(document, nextWorkbook, lineEnding);
  if (structure.handled) {
    return structure.plan;
  }
  return planChangedSheets(document, nextWorkbook, lineEnding);
}

function planChangedSheets(document: EditorDocument, nextWorkbook: EditorWorkbook, lineEnding: string): PatchPlan {
  const current = document.workbook;
  const patches: SourcePatch[] = [];
  for (const [sheetIndex, nextSheet] of nextWorkbook.sheets.entries()) {
    const currentSheet = current.sheets[sheetIndex];
    const sourceSheet = document.sourceMap.sheets[sheetIndex];
    if (!currentSheet || !sourceSheet) {
      return { reason: "stale-source-map", message: "The edited sheet could not be mapped to source." };
    }
    if (sheetEqual(nextSheet, currentSheet)) {
      continue;
    }
    if (!sourceSheet.editable) {
      return readonlySheetFailure(currentSheet, sourceSheet);
    }
    if (currentSheet.format.kind !== "cello") {
      return planForeignSheet(document, sourceSheet, currentSheet, nextSheet, lineEnding);
    }
    const sheetPlan = planNativeSheetPatches(document.source, sourceSheet, currentSheet, nextSheet);
    if (!Array.isArray(sheetPlan)) {
      return sheetPlan;
    }
    patches.push(...sheetPlan);
  }
  return patches;
}

function planNativeSheetPatches(source: string, sourceSheet: EditorSheetSourceLocation, current: EditorSheet, next: EditorSheet): PatchPlan {
  const patches: SourcePatch[] = [];
  const declaration = planSheetDeclaration(source, sourceSheet, current, next);
  if (declaration) {
    patches.push(declaration);
  }
  const defaults = planDefaultsPatches(source, sourceSheet, current, next);
  if (!Array.isArray(defaults)) {
    return defaults;
  }
  const rows = planNativeRowPatches(source, sourceSheet, current, next);
  if (!Array.isArray(rows)) {
    return rows;
  }
  return [...patches, ...defaults, ...rows];
}
