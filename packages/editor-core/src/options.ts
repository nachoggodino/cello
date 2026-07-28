import type { ParseOptions } from "../../core/src/index.js";

export interface EditorLayoutOptions {
  minimumVisibleRows?: number;
  minimumVisibleColumns?: number;
}

export interface ResolvedEditorLayoutOptions {
  minimumVisibleRows: number;
  minimumVisibleColumns: number;
}

export interface CreateEditorWorkbookOptions {
  anonymousSheetName?: ParseOptions["anonymousSheetName"];
  baseDir?: ParseOptions["baseDir"];
  readExternalSource?: ParseOptions["readExternalSource"];
  strict?: ParseOptions["strict"];
}

export const DEFAULT_EDITOR_LAYOUT_OPTIONS: ResolvedEditorLayoutOptions = {
  minimumVisibleRows: 6,
  minimumVisibleColumns: 5
};

export const DEFAULT_SHEET_NAME = "Sheet1";
export const GENERATED_SHEET_NAME_PREFIX = "Sheet";

export function resolveEditorLayoutOptions(options: EditorLayoutOptions = {}): ResolvedEditorLayoutOptions {
  return {
    minimumVisibleRows: options.minimumVisibleRows ?? DEFAULT_EDITOR_LAYOUT_OPTIONS.minimumVisibleRows,
    minimumVisibleColumns: options.minimumVisibleColumns ?? DEFAULT_EDITOR_LAYOUT_OPTIONS.minimumVisibleColumns
  };
}

export function rejectExternalSource(path: string): never {
  throw new Error(`External file sources are not available in the visual editor: ${path}`);
}
