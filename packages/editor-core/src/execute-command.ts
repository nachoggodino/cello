import { applyWorkbookPatch } from "./document.js";
import { reduceEditorDocumentCommand } from "./document-command-reducer.js";
import type { EditorDocumentCommand } from "./document-command-model.js";
import type { EditorCommandResult, EditorDocument } from "./model.js";
import type { CreateEditorWorkbookOptions } from "./options.js";
import { validateEditorDocumentCommand } from "./validate-command.js";

/** Executes a serializable editor command against source and verifies its semantic postcondition. */
export function executeEditorCommand(
  document: EditorDocument,
  command: EditorDocumentCommand,
  options: CreateEditorWorkbookOptions = {}
): EditorCommandResult {
  const validationMessage = validateEditorDocumentCommand(document.workbook, command);
  if (validationMessage) {
    return {
      ok: false,
      reason: "invalid-command",
      message: validationMessage,
      document
    };
  }
  const nextWorkbook = reduceEditorDocumentCommand(document.workbook, command);
  return applyWorkbookPatch(document, nextWorkbook, options);
}
