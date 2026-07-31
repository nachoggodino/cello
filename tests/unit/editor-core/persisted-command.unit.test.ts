import { describe, expect, it } from "vitest";
import { EDITOR_COMMAND_SCHEMA_VERSION, createPersistedEditorCommand, parsePersistedEditorCommand } from "../../../packages/editor-core/src/index.js";

describe("persisted editor commands", () => {
  it("roundtrips the current stable schema", () => {
    const envelope = createPersistedEditorCommand({
      type: "update-cell",
      address: { sheetIndex: 0, rowIndex: 1, colIndex: 2 },
      source: "42",
      mode: "content"
    });

    expect(envelope.schemaVersion).toBe(EDITOR_COMMAND_SCHEMA_VERSION);
    expect(parsePersistedEditorCommand(JSON.parse(JSON.stringify(envelope)))).toEqual({
      ok: true,
      value: envelope
    });
  });

  it("accepts nested atomic batches", () => {
    const result = parsePersistedEditorCommand({
      schemaVersion: 1,
      command: {
        type: "batch",
        commands: [{ type: "add-sheet" }, { type: "rename-sheet", sheetIndex: 0, name: "Report" }]
      }
    });

    expect(result.ok).toBe(true);
  });

  it("rejects unsupported schema versions clearly", () => {
    expect(parsePersistedEditorCommand({ schemaVersion: 2, command: { type: "add-sheet" } })).toEqual({
      ok: false,
      error: {
        code: "unsupported-version",
        message: "Unsupported editor command schema version: 2."
      }
    });
  });

  it.each([
    [{ command: { type: "add-sheet" } }, "invalid-envelope"],
    [{ schemaVersion: 1, command: { type: "unknown" } }, "invalid-command"],
    [{ schemaVersion: 1, command: { type: "update-cell", address: null, source: "x", mode: "content" } }, "invalid-command"],
    [{ schemaVersion: 1, command: { type: "batch", commands: [] } }, "invalid-command"],
    [{ schemaVersion: 1, command: { type: "add-sheet", extra: true } }, "invalid-command"]
  ])("rejects malformed input %#", (input, code) => {
    const result = parsePersistedEditorCommand(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(code);
  });
});
