import type { EditorDocumentCommand, EditorCommandTarget } from "./document-command-model.js";
import { reduceEditorDocumentCommand } from "./document-command-reducer.js";
import { TEXT_TONES } from "./model.js";
import type { CellAddress, EditorWorkbook } from "./model.js";
import type { CellRange } from "./ranges.js";
import { getVisibleColumnCount } from "./selectors.js";

// Exhaustive validation intentionally mirrors the serializable command union.
// eslint-disable-next-line complexity
export function validateEditorDocumentCommand(
  workbook: EditorWorkbook,
  command: EditorDocumentCommand
): string | undefined {
  switch (command.type) {
    case "batch":
      return validateBatch(workbook, command.commands);
    case "update-cell":
      return validateAddress(workbook, command.address) ??
        validateString(command.source, "Cell source") ??
        (["source", "content", "raw"].includes(command.mode) ? undefined : "Cell update mode is invalid.");
    case "update-default":
    case "update-header":
      return validateSheetAndColumn(workbook, command.sheetIndex, command.colIndex) ??
        validateString(command.source, "Cell source");
    case "update-modifiers":
      return validateTarget(workbook, command.target) ?? validateString(command.source, "Modifier source");
    case "toggle-modifier":
      return validateTarget(workbook, command.target) ??
        (["bold", "italic", "strike"].includes(command.key) ? undefined : "Toggle modifier is invalid.");
    case "set-color":
      return validateTarget(workbook, command.target) ??
        (["bg", "color"].includes(command.key) ? undefined : "Color modifier is invalid.") ??
        validateNonEmptyString(command.value, "Color value");
    case "set-tone":
      return validateTarget(workbook, command.target) ??
        (TEXT_TONES.includes(command.value) ? undefined : "Tone value is invalid.");
    case "set-sheet-columns":
      return validateSheet(workbook, command.sheetIndex) ??
        (isOneOf(command.mode, [undefined, "normal", "fit"])
          ? undefined
          : "Sheet columns mode is invalid.");
    case "set-sheet-rows":
      return validateSheet(workbook, command.sheetIndex) ??
        (isOneOf(command.mode, [undefined, "wrap", "ellipsis"])
          ? undefined
          : "Sheet rows mode is invalid.");
    case "toggle-column-fit":
    case "set-column-width":
      return validateSheetAndColumn(workbook, command.sheetIndex, command.colIndex) ??
        (command.type === "set-column-width" && command.value !== undefined
          ? validateNonEmptyString(command.value, "Column width")
          : undefined);
    case "toggle-row-wrap":
    case "set-row-height":
      return validateExistingRow(workbook, command.address) ??
        (command.type === "set-row-height" && command.value !== undefined
          ? validateNonEmptyString(command.value, "Row height")
          : undefined);
    case "merge-cell":
      return validateExistingCell(workbook, command.address) ??
        (command.direction === "left" && command.address.colIndex === 0
          ? "A cell in the first column cannot merge left."
          : command.direction === "up" && command.address.rowIndex === 0
            ? "A cell in the first row cannot merge up."
            : undefined);
    case "add-row":
      return validateSheet(workbook, command.sheetIndex) ??
        validateAfterIndex(command.afterRowIndex, workbook.sheets[command.sheetIndex]?.rows.length ?? 0, "row");
    case "add-column":
      return validateSheet(workbook, command.sheetIndex) ??
        validateAfterIndex(
          command.afterColIndex,
          getVisibleColumnCount(workbook.sheets[command.sheetIndex]),
          "column"
        );
    case "add-sheet":
      return undefined;
    case "remove-sheet":
      return validateSheet(workbook, command.sheetIndex) ??
        (workbook.sheets.length > 1 ? undefined : "The last remaining sheet cannot be removed.");
    case "rename-sheet":
      return validateSheet(workbook, command.sheetIndex) ?? validateNonEmptyString(command.name, "Sheet name");
    case "clear-range":
      return validateRange(workbook, command.range) ??
        (typeof command.includeModifiers === "boolean" ? undefined : "includeModifiers must be boolean.");
    case "fill-range":
      return validateRange(workbook, command.range) ?? validateString(command.source, "Fill source");
    case "paste-matrix":
      return validateAddress(workbook, command.start) ?? validateMatrix(command.matrix);
    default:
      return "Unsupported editor command.";
  }
}

function isOneOf(value: unknown, options: readonly unknown[]): boolean {
  return options.includes(value);
}

function validateBatch(workbook: EditorWorkbook, commands: EditorDocumentCommand[]): string | undefined {
  if (commands.length === 0) {
    return "A batch must contain at least one command.";
  }
  let current = workbook;
  for (const [index, command] of commands.entries()) {
    const message = validateEditorDocumentCommand(current, command);
    if (message) {
      return `Batch command ${index + 1}: ${message}`;
    }
    current = reduceEditorDocumentCommand(current, command);
  }
  return undefined;
}

function validateTarget(workbook: EditorWorkbook, target: EditorCommandTarget): string | undefined {
  if (target.scope === "column") {
    const sheetFailure = validateSheet(workbook, target.sheetIndex);
    if (sheetFailure) {
      return sheetFailure;
    }
    if (target.colIndexes.length === 0) {
      return "A column command requires at least one column.";
    }
    if (new Set(target.colIndexes).size !== target.colIndexes.length) {
      return "A command target cannot contain duplicate columns.";
    }
    return target.colIndexes.find((index) => !isIndex(index)) === undefined
      ? undefined
      : "Column indexes must be non-negative integers.";
  }
  if (target.addresses.length === 0) {
    return `A ${target.scope} command requires at least one address.`;
  }
  const keys = target.addresses.map(addressKey);
  if (new Set(keys).size !== keys.length) {
    return "A command target cannot contain duplicate addresses.";
  }
  return target.addresses.map((address) => validateAddress(workbook, address)).find(Boolean);
}

function validateAddress(workbook: EditorWorkbook, address: CellAddress): string | undefined {
  return validateSheet(workbook, address.sheetIndex) ??
    (isIndex(address.rowIndex) && isIndex(address.colIndex)
      ? undefined
      : "Cell coordinates must be non-negative integers.");
}

function validateExistingRow(workbook: EditorWorkbook, address: CellAddress): string | undefined {
  const addressFailure = validateAddress(workbook, address);
  if (addressFailure) {
    return addressFailure;
  }
  return address.rowIndex < (workbook.sheets[address.sheetIndex]?.rows.length ?? 0)
    ? undefined
    : "The targeted row does not exist.";
}

function validateExistingCell(workbook: EditorWorkbook, address: CellAddress): string | undefined {
  const rowFailure = validateExistingRow(workbook, address);
  if (rowFailure) {
    return rowFailure;
  }
  return address.colIndex < getVisibleColumnCount(workbook.sheets[address.sheetIndex])
    ? undefined
    : "The targeted cell does not exist.";
}

function validateRange(workbook: EditorWorkbook, range: CellRange): string | undefined {
  return validateSheet(workbook, range.sheetIndex) ??
    ([range.startRow, range.endRow, range.startCol, range.endCol].every(isIndex) &&
      range.startRow <= range.endRow && range.startCol <= range.endCol
      ? undefined
      : "Range bounds must be ordered non-negative integers.");
}

function validateSheetAndColumn(workbook: EditorWorkbook, sheetIndex: number, colIndex: number): string | undefined {
  return validateSheet(workbook, sheetIndex) ??
    (isIndex(colIndex) ? undefined : "Column index must be a non-negative integer.");
}

function validateSheet(workbook: EditorWorkbook, sheetIndex: number): string | undefined {
  return isIndex(sheetIndex) && workbook.sheets[sheetIndex]
    ? undefined
    : "The targeted sheet does not exist.";
}

function validateAfterIndex(index: number | undefined, length: number, label: string): string | undefined {
  if (index === undefined) {
    return undefined;
  }
  return isIndex(index) && index < length
    ? undefined
    : `The insertion ${label} index does not exist.`;
}

function validateMatrix(matrix: string[][]): string | undefined {
  return matrix.length > 0 && matrix.every((row) => row.length > 0 && row.every((value) => typeof value === "string"))
    ? undefined
    : "Paste data must contain at least one non-empty row of strings.";
}

function validateString(value: string, label: string): string | undefined {
  return typeof value === "string" ? undefined : `${label} must be a string.`;
}

function validateNonEmptyString(value: string, label: string): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? undefined : `${label} cannot be empty.`;
}

function isIndex(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

function addressKey(address: CellAddress): string {
  return `${address.sheetIndex}:${address.rowIndex}:${address.colIndex}`;
}
