import type { CelloSourceLayout } from "../../core/src/index.js";
import { createEditorDocument } from "./document.js";
import { executeEditorCommand } from "./execute-command.js";
import { formatEditorDocument } from "./layout.js";
import type { EditorDocumentCommand } from "./document-command-model.js";
import type { EditorCommandResult, EditorDocument } from "./model.js";
import { DEFAULT_SHEET_NAME } from "./options.js";
import type { CreateEditorWorkbookOptions } from "./options.js";
import type {
  CreateEditorSessionOptions,
  EditorHistoryRecording,
  EditorSession,
  EditorSessionCommandOptions,
  EditorSessionHistoryState,
  EditorSessionMode,
  EditorSessionSnapshot,
  EditorSessionSourceOptions,
  EditorSessionSourceResult
} from "./session-model.js";

const DEFAULT_HISTORY_LIMIT = 100;

interface History {
  past: string[];
  future: string[];
}

interface PublishOptions {
  document: EditorDocument;
  mode: EditorSessionMode | "external";
  recording?: EditorHistoryRecording;
  historyGroup?: string;
}

/** Creates the source-authoritative state shared by source, visual, and preview views. */
export function createEditorSession(options: CreateEditorSessionOptions): EditorSession {
  return new EditorSessionStore(options);
}

class EditorSessionStore implements EditorSession {
  readonly #documentOptions: CreateEditorWorkbookOptions;
  readonly #historyLimit: number;
  readonly #listeners = new Set<() => void>();
  readonly #histories: Record<EditorSessionMode, History> = {
    source: { past: [], future: [] },
    visual: { past: [], future: [] }
  };

  #snapshot: EditorSessionSnapshot;
  #sourceHistoryGroup: string | undefined;

  constructor(options: CreateEditorSessionOptions) {
    this.#historyLimit = normalizeHistoryLimit(options.historyLimit);
    this.#documentOptions = {
      ...(options.anonymousSheetName === undefined ? {} : { anonymousSheetName: options.anonymousSheetName }),
      ...(options.baseDir === undefined ? {} : { baseDir: options.baseDir }),
      ...(options.readExternalSource === undefined ? {} : { readExternalSource: options.readExternalSource }),
      ...(options.strict === undefined ? {} : { strict: options.strict }),
      sourceLayout: options.sourceLayout ?? "compact"
    };
    const document = createEditorDocument(options.source, this.#documentOptions);
    this.#snapshot = this.#makeSnapshot(
      document,
      0,
      resolveActiveSheetName(document, options.activeSheetName),
      this.#documentOptions.sourceLayout ?? "compact"
    );
  }

  readonly getSnapshot = (): EditorSessionSnapshot => this.#snapshot;

  readonly getDocumentOptions = (): Readonly<CreateEditorWorkbookOptions> => ({
    ...this.#documentOptions
  });

  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  setSource(source: string, options: EditorSessionSourceOptions = {}): EditorSessionSourceResult {
    if (!this.isExpectedRevision(options.expectedRevision)) {
      return {
        ok: false,
        reason: "stale-revision",
        message: staleRevisionMessage(options.expectedRevision, this.#snapshot.revision),
        snapshot: this.#snapshot
      };
    }
    if (source === this.#snapshot.source) {
      return { ok: true, snapshot: this.#snapshot };
    }
    const document = createEditorDocument(source, this.#documentOptions);
    this.#publish({
      document,
      mode: "source",
      recording: options.history ?? "push",
      ...(options.historyGroup === undefined ? {} : { historyGroup: options.historyGroup })
    });
    return { ok: true, snapshot: this.#snapshot };
  }

  replaceExternalSource(source: string): EditorSessionSnapshot {
    if (source === this.#snapshot.source) {
      return this.#snapshot;
    }
    this.#publish({
      document: createEditorDocument(source, this.#documentOptions),
      mode: "external"
    });
    return this.#snapshot;
  }

  execute(command: EditorDocumentCommand, options: EditorSessionCommandOptions = {}): EditorCommandResult {
    if (!this.isExpectedRevision(options.expectedRevision)) {
      return {
        ok: false,
        reason: "stale-revision",
        message: staleRevisionMessage(options.expectedRevision, this.#snapshot.revision),
        document: this.#snapshot.document
      };
    }
    const result = executeEditorCommand(this.#snapshot.document, command, this.#documentOptions);
    if (result.ok && result.source !== this.#snapshot.source) {
      this.#publish({ document: result.document, mode: "visual" });
    }
    return result;
  }

  format(layout: CelloSourceLayout): EditorCommandResult {
    const result = formatEditorDocument(this.#snapshot.document, layout, this.#documentOptions);
    if (!result.ok) {
      return result;
    }
    this.#documentOptions.sourceLayout = layout;
    if (result.source === this.#snapshot.source) {
      this.#replaceSnapshot(this.#makeSnapshot(
        this.#snapshot.document,
        this.#snapshot.revision,
        this.#snapshot.activeSheetName,
        layout
      ));
      return result;
    }
    this.#publish({ document: result.document, mode: "source" });
    return result;
  }

  undo(mode: EditorSessionMode): boolean {
    const history = this.#histories[mode];
    const source = history.past.at(-1);
    if (source === undefined) {
      return false;
    }
    history.past = history.past.slice(0, -1);
    history.future = [this.#snapshot.source, ...history.future].slice(0, this.#historyLimit);
    this.#sourceHistoryGroup = undefined;
    this.#publishWithoutHistory(source);
    return true;
  }

  redo(mode: EditorSessionMode): boolean {
    const history = this.#histories[mode];
    const source = history.future[0];
    if (source === undefined) {
      return false;
    }
    history.future = history.future.slice(1);
    history.past = [...history.past, this.#snapshot.source].slice(-this.#historyLimit);
    this.#sourceHistoryGroup = undefined;
    this.#publishWithoutHistory(source);
    return true;
  }

  setActiveSheetName(sheetName: string): boolean {
    if (
      sheetName === this.#snapshot.activeSheetName ||
      !this.#snapshot.document.workbook.sheets.some((sheet) => sheet.name === sheetName)
    ) {
      return false;
    }
    this.#replaceSnapshot(this.#makeSnapshot(
      this.#snapshot.document,
      this.#snapshot.revision,
      sheetName,
      this.#snapshot.sourceLayout
    ));
    return true;
  }

  setSourceLayout(layout: CelloSourceLayout): void {
    if (layout === this.#snapshot.sourceLayout) {
      return;
    }
    this.#documentOptions.sourceLayout = layout;
    this.#replaceSnapshot(this.#makeSnapshot(
      this.#snapshot.document,
      this.#snapshot.revision,
      this.#snapshot.activeSheetName,
      layout
    ));
  }

  isCurrentRevision(revision: number): boolean {
    return revision === this.#snapshot.revision;
  }

  #publish(options: PublishOptions): void {
    const previousSource = this.#snapshot.source;
    if (options.mode === "external") {
      this.#clearHistory("source");
      this.#clearHistory("visual");
    } else {
      const history = this.#histories[options.mode];
      const merge = options.mode === "source" &&
        options.recording === "merge" &&
        options.historyGroup !== undefined &&
        options.historyGroup === this.#sourceHistoryGroup &&
        history.past.length > 0;
      if (!merge) {
        history.past = [...history.past, previousSource].slice(-this.#historyLimit);
      }
      history.future = [];
      this.#clearHistory(options.mode === "source" ? "visual" : "source");
      this.#sourceHistoryGroup = options.mode === "source" ? options.historyGroup : undefined;
    }
    const activeSheetName = resolveActiveSheetName(options.document, this.#snapshot.activeSheetName);
    this.#replaceSnapshot(this.#makeSnapshot(
      options.document,
      this.#snapshot.revision + 1,
      activeSheetName,
      this.#documentOptions.sourceLayout ?? "compact"
    ));
  }

  #publishWithoutHistory(source: string): void {
    const document = createEditorDocument(source, this.#documentOptions);
    this.#replaceSnapshot(this.#makeSnapshot(
      document,
      this.#snapshot.revision + 1,
      resolveActiveSheetName(document, this.#snapshot.activeSheetName),
      this.#snapshot.sourceLayout
    ));
  }

  #clearHistory(mode: EditorSessionMode): void {
    this.#histories[mode] = { past: [], future: [] };
    if (mode === "source") {
      this.#sourceHistoryGroup = undefined;
    }
  }

  #makeSnapshot(
    document: EditorDocument,
    revision: number,
    activeSheetName: string,
    sourceLayout: CelloSourceLayout
  ): EditorSessionSnapshot {
    return {
      revision,
      source: document.source,
      document,
      sourceLayout,
      activeSheetName,
      histories: {
        source: historyState(this.#histories.source),
        visual: historyState(this.#histories.visual)
      }
    };
  }

  #replaceSnapshot(snapshot: EditorSessionSnapshot): void {
    this.#snapshot = snapshot;
    for (const listener of this.#listeners) {
      listener();
    }
  }

  private isExpectedRevision(expectedRevision: number | undefined): boolean {
    return expectedRevision === undefined || expectedRevision === this.#snapshot.revision;
  }
}

function historyState(history: History): EditorSessionHistoryState {
  return {
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    undoDepth: history.past.length,
    redoDepth: history.future.length
  };
}

function resolveActiveSheetName(document: EditorDocument, requested: string | undefined): string {
  const requestedSheet = document.workbook.sheets.find((sheet) => sheet.name === requested);
  return requestedSheet?.name ?? document.workbook.sheets[0]?.name ?? DEFAULT_SHEET_NAME;
}

function normalizeHistoryLimit(limit: number | undefined): number {
  return limit !== undefined && Number.isSafeInteger(limit) && limit > 0
    ? limit
    : DEFAULT_HISTORY_LIMIT;
}

function staleRevisionMessage(expected: number | undefined, actual: number): string {
  return `The command expected source revision ${expected ?? "unknown"}, but the current revision is ${actual}.`;
}
