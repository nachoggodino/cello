import { describe, expect, it } from "vitest";
import * as cello from "../../../packages/core/src/index.js";
import * as editorCore from "../../../packages/editor-core/src/index.js";
import * as editorReact from "../../../packages/editor-react/src/index.js";

describe("public API", () => {
  it("matches the exact supported runtime export contract", () => {
    expect(Object.keys(cello).sort()).toEqual(["DIAGNOSTIC_CODES", "evaluate", "formatSource", "parse", "parseDocument", "render", "validate"]);
    expect(Object.keys(editorCore).sort()).toEqual([
      "EDITOR_COMMAND_SCHEMA_VERSION",
      "createEditorDocument",
      "createEditorSession",
      "createPersistedEditorCommand",
      "executeEditorCommand",
      "parsePersistedEditorCommand"
    ]);
    expect(Object.keys(editorReact).sort()).toEqual(["CelloHtmlPreview", "CelloSourceEditor", "CelloVisualEditor", "CelloWorkbench", "useEditorSession"]);
  });

  it("exports core functions", () => {
    expect(typeof cello.parse).toBe("function");
    expect(typeof cello.parseDocument).toBe("function");
    expect(typeof cello.evaluate).toBe("function");
    expect(typeof cello.formatSource).toBe("function");
    expect(typeof cello.render).toBe("function");
    expect(typeof cello.validate).toBe("function");
    expect("format" in cello).toBe(false);
    expect("serialize" in cello).toBe(false);
  });

  it("validates cello text", async () => {
    await expect(cello.validate("@sheet S\n| A |")).resolves.toEqual({
      valid: true,
      diagnostics: []
    });
  });
});
