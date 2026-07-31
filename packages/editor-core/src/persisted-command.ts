import type { EditorDocumentCommand } from "./document-command-model.js";

/** Current schema version for commands persisted or sent across automation boundaries. */
export const EDITOR_COMMAND_SCHEMA_VERSION = 1 as const;

/** Stable envelope for a persisted editor command. */
export interface PersistedEditorCommand {
  schemaVersion: typeof EDITOR_COMMAND_SCHEMA_VERSION;
  command: EditorDocumentCommand;
}

export type PersistedEditorCommandErrorCode = "invalid-envelope" | "unsupported-version" | "invalid-command";

export type PersistedEditorCommandParseResult = { ok: true; value: PersistedEditorCommand } | { ok: false; error: { code: PersistedEditorCommandErrorCode; message: string } };

/** Wraps an in-memory command for persistence or automation. */
export function createPersistedEditorCommand(command: EditorDocumentCommand): PersistedEditorCommand {
  return { schemaVersion: EDITOR_COMMAND_SCHEMA_VERSION, command };
}

/** Parses and structurally validates a command received from an untrusted boundary. */
export function parsePersistedEditorCommand(input: unknown): PersistedEditorCommandParseResult {
  if (!isRecord(input) || !hasOnlyKeys(input, ["schemaVersion", "command"]) || !("schemaVersion" in input) || !("command" in input)) {
    return failure("invalid-envelope", "Persisted editor commands require schemaVersion and command.");
  }
  if (input.schemaVersion !== EDITOR_COMMAND_SCHEMA_VERSION) {
    return failure("unsupported-version", `Unsupported editor command schema version: ${String(input.schemaVersion)}.`);
  }
  if (!isCommand(input.command, new Set())) {
    return failure("invalid-command", "The persisted editor command payload is invalid.");
  }
  return { ok: true, value: { schemaVersion: EDITOR_COMMAND_SCHEMA_VERSION, command: input.command } };
}

function failure(code: PersistedEditorCommandErrorCode, message: string): PersistedEditorCommandParseResult {
  return { ok: false, error: { code, message } };
}

// Exhaustive schema validation intentionally mirrors the persisted command union.
// eslint-disable-next-line complexity, max-lines-per-function
function isCommand(value: unknown, ancestors: Set<object>): value is EditorDocumentCommand {
  if (!isRecord(value) || typeof value.type !== "string" || ancestors.has(value)) {
    return false;
  }
  const nextAncestors = new Set(ancestors).add(value);
  switch (value.type) {
    case "update-cell":
      return exact(value, ["type", "address", "source", "mode"]) && isAddress(value.address) && typeof value.source === "string" && oneOf(value.mode, ["source", "content", "raw"]);
    case "update-default":
      return (
        exact(value, ["type", "sheetIndex", "colIndex", "source", "ensureHeader"]) &&
        isIndex(value.sheetIndex) &&
        isIndex(value.colIndex) &&
        typeof value.source === "string" &&
        optionalBoolean(value.ensureHeader)
      );
    case "update-header":
      return exact(value, ["type", "sheetIndex", "colIndex", "source"]) && isIndex(value.sheetIndex) && isIndex(value.colIndex) && typeof value.source === "string";
    case "update-modifiers":
      return exact(value, ["type", "target", "source"]) && isTarget(value.target) && typeof value.source === "string";
    case "toggle-modifier":
      return exact(value, ["type", "target", "key"]) && isTarget(value.target) && oneOf(value.key, ["bold", "italic", "strike"]);
    case "set-color":
      return exact(value, ["type", "target", "key", "value"]) && isTarget(value.target) && oneOf(value.key, ["bg", "color"]) && typeof value.value === "string";
    case "set-tone":
      return exact(value, ["type", "target", "value"]) && isTarget(value.target) && oneOf(value.value, ["default", "muted", "primary", "success", "warning", "danger", "info"]);
    case "set-sheet-columns":
      return exact(value, ["type", "sheetIndex", "mode"]) && isIndex(value.sheetIndex) && optionalOneOf(value.mode, ["normal", "fit"]);
    case "set-sheet-rows":
      return exact(value, ["type", "sheetIndex", "mode"]) && isIndex(value.sheetIndex) && optionalOneOf(value.mode, ["wrap", "ellipsis"]);
    case "toggle-column-fit":
      return exact(value, ["type", "sheetIndex", "colIndex"]) && isIndex(value.sheetIndex) && isIndex(value.colIndex);
    case "set-column-width":
      return exact(value, ["type", "sheetIndex", "colIndex", "value"]) && isIndex(value.sheetIndex) && isIndex(value.colIndex) && optionalString(value.value);
    case "toggle-row-wrap":
      return exact(value, ["type", "address"]) && isAddress(value.address);
    case "set-row-height":
      return exact(value, ["type", "address", "value"]) && isAddress(value.address) && optionalString(value.value);
    case "merge-cell":
      return exact(value, ["type", "address", "direction"]) && isAddress(value.address) && oneOf(value.direction, ["left", "up"]);
    case "add-row":
      return exact(value, ["type", "sheetIndex", "afterRowIndex"]) && isIndex(value.sheetIndex) && optionalIndex(value.afterRowIndex);
    case "add-column":
      return exact(value, ["type", "sheetIndex", "afterColIndex"]) && isIndex(value.sheetIndex) && optionalIndex(value.afterColIndex);
    case "add-sheet":
      return exact(value, ["type"]);
    case "remove-sheet":
      return exact(value, ["type", "sheetIndex"]) && isIndex(value.sheetIndex);
    case "rename-sheet":
      return exact(value, ["type", "sheetIndex", "name"]) && isIndex(value.sheetIndex) && typeof value.name === "string";
    case "clear-range":
      return exact(value, ["type", "range", "includeModifiers"]) && isRange(value.range) && typeof value.includeModifiers === "boolean";
    case "fill-range":
      return exact(value, ["type", "range", "source"]) && isRange(value.range) && typeof value.source === "string";
    case "paste-matrix":
      return exact(value, ["type", "start", "matrix"]) && isAddress(value.start) && isStringMatrix(value.matrix);
    case "batch":
      return (
        exact(value, ["type", "commands"]) && Array.isArray(value.commands) && value.commands.length > 0 && value.commands.every((command) => isCommand(command, nextAncestors))
      );
    default:
      return false;
  }
}

function isTarget(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (value.scope === "column") {
    return exact(value, ["scope", "sheetIndex", "colIndexes"]) && isIndex(value.sheetIndex) && isIndexArray(value.colIndexes);
  }
  return (
    (value.scope === "cell" || value.scope === "row") &&
    exact(value, ["scope", "addresses"]) &&
    Array.isArray(value.addresses) &&
    value.addresses.length > 0 &&
    value.addresses.every(isAddress)
  );
}

function isAddress(value: unknown): boolean {
  return isRecord(value) && exact(value, ["sheetIndex", "rowIndex", "colIndex"]) && isIndex(value.sheetIndex) && isIndex(value.rowIndex) && isIndex(value.colIndex);
}

function isRange(value: unknown): boolean {
  return (
    isRecord(value) &&
    exact(value, ["sheetIndex", "startRow", "endRow", "startCol", "endCol"]) &&
    isIndex(value.sheetIndex) &&
    isIndex(value.startRow) &&
    isIndex(value.endRow) &&
    isIndex(value.startCol) &&
    isIndex(value.endCol) &&
    value.startRow <= value.endRow &&
    value.startCol <= value.endCol
  );
}

function isStringMatrix(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0 && value.every((row) => Array.isArray(row) && row.length > 0 && row.every((cell) => typeof cell === "string"));
}

function isIndexArray(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0 && value.every(isIndex);
}

function isIndex(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function optionalIndex(value: unknown): boolean {
  return value === undefined || isIndex(value);
}

function optionalString(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

function optionalBoolean(value: unknown): boolean {
  return value === undefined || typeof value === "boolean";
}

function oneOf(value: unknown, options: readonly unknown[]): boolean {
  return options.includes(value);
}

function optionalOneOf(value: unknown, options: readonly unknown[]): boolean {
  return value === undefined || oneOf(value, options);
}

function exact(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return hasOnlyKeys(value, keys) && keys.filter((key) => key !== "ensureHeader" && key !== "mode" && key !== "value" && !key.startsWith("after")).every((key) => key in value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
