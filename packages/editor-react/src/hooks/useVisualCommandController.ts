import { useCallback, useRef, useState } from "react";
import { createEditorDocument, executeEditorCommand } from "../../../editor-core/src/internal.js";
import type { CreateEditorWorkbookOptions, EditorCommandResult, EditorDocument, EditorDocumentCommand } from "../../../editor-core/src/internal.js";
import { useSourceHistory } from "./useSourceHistory.js";

export type VisualHistoryMode = "push" | "skip";

export interface VisualHistoryController {
  undo: () => void;
  redo: () => void;
}

interface VisualCommandControllerOptions {
  initialDocument: EditorDocument;
  workbookOptions: CreateEditorWorkbookOptions;
  executeCommand?: (command: EditorDocumentCommand) => EditorCommandResult;
  historyController?: VisualHistoryController;
  onCommandFailure?: (failure: Extract<EditorCommandResult, { ok: false }>) => void;
  onDocumentApplied: () => void;
  onSourceChange: (source: string) => void;
}

export function useVisualCommandController(options: VisualCommandControllerOptions) {
  const [editorDocument, setEditorDocument] = useState(options.initialDocument);
  const editorDocumentRef = useRef(editorDocument);
  const [liveMessage, setLiveMessage] = useState("");
  const [commandError, setCommandError] = useState<string | null>(null);

  const replaceDocument = useCallback((document: EditorDocument) => {
    editorDocumentRef.current = document;
    setEditorDocument(document);
  }, []);

  const applySourceSnapshot = useCallback(
    (nextSource: string) => {
      replaceDocument(createEditorDocument(nextSource, options.workbookOptions));
      options.onDocumentApplied();
      setCommandError(null);
      options.onSourceChange(nextSource);
    },
    [options, replaceDocument]
  );

  const localHistory = useSourceHistory(editorDocument.source, applySourceSnapshot, setLiveMessage);
  const undo = options.historyController?.undo ?? localHistory.undo;
  const redo = options.historyController?.redo ?? localHistory.redo;

  const runCommand = useCommandRunner(editorDocumentRef, options, localHistory.pushHistoryEntry, replaceDocument, setCommandError);

  const commit = (command: EditorDocumentCommand, mode: VisualHistoryMode = "push"): boolean => runCommand(command, mode).ok;

  return {
    commandError,
    commit,
    editorDocument,
    liveMessage,
    redo,
    replaceDocument,
    runCommand,
    setCommandError,
    setLiveMessage,
    undo
  };
}

function useCommandRunner(
  documentRef: { current: EditorDocument },
  options: VisualCommandControllerOptions,
  pushHistoryEntry: (source: string) => void,
  replaceDocument: (document: EditorDocument) => void,
  setCommandError: (message: string | null) => void
) {
  return useCallback(
    (command: EditorDocumentCommand, mode: VisualHistoryMode = "push"): EditorCommandResult => {
      const currentDocument = documentRef.current;
      const result = options.executeCommand ? options.executeCommand(command) : executeEditorCommand(currentDocument, command, options.workbookOptions);
      if (!result.ok) {
        setCommandError(result.message);
        options.onCommandFailure?.(result);
        return result;
      }
      setCommandError(null);
      if (mode === "push" && !options.historyController && result.source !== currentDocument.source) {
        pushHistoryEntry(currentDocument.source);
      }
      replaceDocument(result.document);
      options.onSourceChange(result.source);
      return result;
    },
    [documentRef, options, pushHistoryEntry, replaceDocument, setCommandError]
  );
}
