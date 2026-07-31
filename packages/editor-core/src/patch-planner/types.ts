import type { EditorCommandFailure, EditorSourceSpan } from "../model.js";

export interface SourcePatch {
  span: EditorSourceSpan;
  text: string;
}

export type PatchFailure = Pick<EditorCommandFailure, "reason" | "message">;
export type PatchPlan = SourcePatch[] | PatchFailure;
