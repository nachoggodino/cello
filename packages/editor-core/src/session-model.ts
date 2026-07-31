import type { CelloSourceLayout } from "../../core/src/index.js";
import type { EditorDocumentCommand } from "./document-command-model.js";
import type { EditorCommandResult, EditorDocument } from "./model.js";
import type { CreateEditorWorkbookOptions } from "./options.js";

export type EditorSessionMode = "source" | "visual";
export type EditorHistoryRecording = "push" | "merge";

export interface EditorSessionHistoryState {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly undoDepth: number;
  readonly redoDepth: number;
}

export interface EditorSessionSnapshot {
  readonly revision: number;
  readonly source: string;
  readonly document: EditorDocument;
  readonly sourceLayout: CelloSourceLayout;
  readonly activeSheetName: string;
  readonly histories: Readonly<Record<EditorSessionMode, EditorSessionHistoryState>>;
}

export interface CreateEditorSessionOptions extends CreateEditorWorkbookOptions {
  source: string;
  activeSheetName?: string;
  historyLimit?: number;
}

export interface EditorSessionSourceOptions {
  expectedRevision?: number;
  history?: EditorHistoryRecording;
  historyGroup?: string;
}

export interface EditorSessionCommandOptions {
  expectedRevision?: number;
}

export type EditorSessionSourceResult =
  | { ok: true; snapshot: EditorSessionSnapshot }
  | {
      ok: false;
      reason: "stale-revision";
      message: string;
      snapshot: EditorSessionSnapshot;
    };

export interface EditorSession {
  getSnapshot: () => EditorSessionSnapshot;
  getDocumentOptions: () => Readonly<CreateEditorWorkbookOptions>;
  subscribe: (listener: () => void) => () => void;
  setSource: (source: string, options?: EditorSessionSourceOptions) => EditorSessionSourceResult;
  replaceExternalSource: (source: string) => EditorSessionSnapshot;
  execute: (command: EditorDocumentCommand, options?: EditorSessionCommandOptions) => EditorCommandResult;
  format: (layout: CelloSourceLayout) => EditorCommandResult;
  undo: (mode: EditorSessionMode) => boolean;
  redo: (mode: EditorSessionMode) => boolean;
  setActiveSheetName: (sheetName: string) => boolean;
  setSourceLayout: (layout: CelloSourceLayout) => void;
  isCurrentRevision: (revision: number) => boolean;
}
