import { formatSource } from "@nachoggodino/cello";
import { createEditorDocument, createEditorSession, createEditorWorkbook, executeEditorCommand, formatEditorDocument } from "@nachoggodino/cello/editor-core";
import { CelloHtmlPreview, CelloSourceEditor, CelloVisualEditor, CelloWorkbench, useEditorSession } from "@nachoggodino/cello/editor-react";
import * as cello from "@nachoggodino/cello";
import * as editorCore from "@nachoggodino/cello/editor-core";

if ("serialize" in cello || "serializeEditorWorkbook" in editorCore) {
  throw new Error("package smoke failed: whole-workbook serializers must not be public.");
}

if (typeof createEditorWorkbook !== "function") {
  throw new Error("editor-core package smoke failed: createEditorWorkbook is not exported.");
}

if (typeof createEditorDocument !== "function") {
  throw new Error("editor-core package smoke failed: createEditorDocument is not exported.");
}

if (typeof executeEditorCommand !== "function") {
  throw new Error("editor-core package smoke failed: executeEditorCommand is not exported.");
}

if (typeof createEditorSession !== "function") {
  throw new Error("editor-core package smoke failed: createEditorSession is not exported.");
}

if (typeof formatSource !== "function" || typeof formatEditorDocument !== "function") {
  throw new Error("source-layout package smoke failed: formatting commands are not exported.");
}

if (typeof CelloVisualEditor !== "function") {
  throw new Error("editor-react package smoke failed: CelloVisualEditor is not exported.");
}

if (
  typeof CelloSourceEditor !== "function" ||
  typeof CelloHtmlPreview !== "function" ||
  typeof CelloWorkbench !== "function" ||
  typeof useEditorSession !== "function"
) {
  throw new Error("editor-react package smoke failed: session-backed views are not exported.");
}
