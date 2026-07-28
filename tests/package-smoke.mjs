import { createEditorDocument, createEditorWorkbook } from "@nachoggodino/cello/editor-core";
import { CelloVisualEditor } from "@nachoggodino/cello/editor-react";

if (typeof createEditorWorkbook !== "function") {
  throw new Error("editor-core package smoke failed: createEditorWorkbook is not exported.");
}

if (typeof createEditorDocument !== "function") {
  throw new Error("editor-core package smoke failed: createEditorDocument is not exported.");
}

if (typeof CelloVisualEditor !== "function") {
  throw new Error("editor-react package smoke failed: CelloVisualEditor is not exported.");
}
