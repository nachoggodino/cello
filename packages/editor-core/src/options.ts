import type { CelloSourceLayout, ParseOptions } from "../../core/src/internal.js";

export interface CreateEditorWorkbookOptions {
  anonymousSheetName?: ParseOptions["anonymousSheetName"];
  baseDir?: ParseOptions["baseDir"];
  readExternalSource?: ParseOptions["readExternalSource"];
  strict?: ParseOptions["strict"];
  sourceLayout?: CelloSourceLayout;
}

export const DEFAULT_SHEET_NAME = "Sheet1";
export const GENERATED_SHEET_NAME_PREFIX = "Sheet";

export function rejectExternalSource(path: string): never {
  throw new Error(`External file sources are not available in the visual editor: ${path}`);
}
