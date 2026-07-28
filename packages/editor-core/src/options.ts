import type { ParseOptions } from "../../core/src/index.js";

export interface CreateEditorWorkbookOptions {
  anonymousSheetName?: ParseOptions["anonymousSheetName"];
  baseDir?: ParseOptions["baseDir"];
  readExternalSource?: ParseOptions["readExternalSource"];
  strict?: ParseOptions["strict"];
}

export const DEFAULT_SHEET_NAME = "Sheet1";
export const GENERATED_SHEET_NAME_PREFIX = "Sheet";

export function rejectExternalSource(path: string): never {
  throw new Error(`External file sources are not available in the visual editor: ${path}`);
}
