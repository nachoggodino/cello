import { formatSource } from "../../core/src/internal.js";
import type { CelloSourceLayout } from "../../core/src/internal.js";
import { createEditorDocument } from "./document.js";
import { persistedWorkbooksEqual } from "./equality.js";
import type { EditorCommandResult, EditorDocument } from "./model.js";
import type { CreateEditorWorkbookOptions } from "./options.js";

/** Formats every recognized native table block and verifies semantic preservation. */
export function formatEditorDocument(document: EditorDocument, layout: CelloSourceLayout, options: CreateEditorWorkbookOptions = {}): EditorCommandResult {
  const nextSource = formatSource(document.source, { layout });
  const nextDocument = createEditorDocument(nextSource, options);
  if (!persistedWorkbooksEqual(nextDocument.workbook, document.workbook)) {
    return {
      ok: false,
      reason: "postcondition-failed",
      message: "Formatting changed workbook semantics, so the source change was discarded.",
      document
    };
  }
  return { ok: true, source: nextSource, document: nextDocument };
}
