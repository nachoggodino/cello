import {
  addColumn,
  addRow,
  addSheet,
  ensureColumnHeaderRow,
  mergeCell,
  removeSheet,
  renameSheet,
  setCellColorModifier,
  setCellToneModifier,
  setColumnColorModifier,
  setColumnToneModifier,
  setColumnWidth,
  setRowColorModifier,
  setRowHeight,
  setRowToneModifier,
  setSheetColumnsMode,
  setSheetRowsMode,
  toggleCellModifier,
  toggleColumnFit,
  toggleColumnModifier,
  toggleRowModifier,
  toggleRowWrap,
  updateCellContentSource,
  updateCellRaw,
  updateCellSource,
  updateColumnModifierSource,
  updateDefaultCellSource,
  updateRowModifierSource
} from "./commands.js";
import type { EditorCommandTarget, EditorDocumentCommand } from "./document-command-model.js";
import type { CellAddress, EditorWorkbook } from "./model.js";
import { clearRange, clearRangeAll, fillRange, pasteMatrixAt } from "./ranges.js";
import { getCellAt } from "./selectors.js";
import { composeCellSource, getCellContentText } from "./source.js";

// Exhaustive command dispatch is clearer here than scattering one discriminated union across handlers.
// eslint-disable-next-line complexity
export function reduceEditorDocumentCommand(
  workbook: EditorWorkbook,
  command: EditorDocumentCommand
): EditorWorkbook {
  switch (command.type) {
    case "update-cell":
      return reduceCellUpdate(workbook, command);
    case "update-default": {
      const current = command.ensureHeader ? ensureColumnHeaderRow(workbook, command.sheetIndex).workbook : workbook;
      return updateDefaultCellSource(current, command.sheetIndex, command.colIndex, command.source);
    }
    case "update-header": {
      const resolution = ensureColumnHeaderRow(workbook, command.sheetIndex);
      return updateCellContentSource(resolution.workbook, {
        sheetIndex: command.sheetIndex,
        rowIndex: resolution.headerRowIndex,
        colIndex: command.colIndex
      }, command.source);
    }
    case "update-modifiers":
      return updateTargetModifiers(workbook, command.target, command.source);
    case "toggle-modifier":
      return updateTarget(workbook, command.target, {
        cell: (current, address) => toggleCellModifier(current, address, command.key),
        row: (current, address) => toggleRowModifier(current, address, command.key),
        column: (current, address) => toggleColumnModifier(current, address.sheetIndex, address.rowIndex, address.colIndex, command.key)
      });
    case "set-color":
      return updateTarget(workbook, command.target, {
        cell: (current, address) => setCellColorModifier(current, address, command.key, command.value),
        row: (current, address) => setRowColorModifier(current, address, command.key, command.value),
        column: (current, address) => setColumnColorModifier(current, address.sheetIndex, address.rowIndex, address.colIndex, command.key, command.value)
      });
    case "set-tone":
      return updateTarget(workbook, command.target, {
        cell: (current, address) => setCellToneModifier(current, address, command.value),
        row: (current, address) => setRowToneModifier(current, address, command.value),
        column: (current, address) => setColumnToneModifier(current, address.sheetIndex, address.rowIndex, address.colIndex, command.value)
      });
    case "set-sheet-columns":
      return setSheetColumnsMode(workbook, command.sheetIndex, command.mode);
    case "set-sheet-rows":
      return setSheetRowsMode(workbook, command.sheetIndex, command.mode);
    case "toggle-column-fit":
      return updateHeaderColumn(workbook, command.sheetIndex, command.colIndex, (current, address) =>
        toggleColumnFit(current, address.sheetIndex, address.rowIndex, address.colIndex));
    case "set-column-width":
      return updateHeaderColumn(workbook, command.sheetIndex, command.colIndex, (current, address) =>
        setColumnWidth(current, address.sheetIndex, address.rowIndex, address.colIndex, command.value));
    case "toggle-row-wrap":
      return toggleRowWrap(workbook, command.address);
    case "set-row-height":
      return setRowHeight(workbook, command.address, command.value);
    case "merge-cell":
      return mergeCell(workbook, command.address, command.direction);
    case "add-row":
      return addRow(workbook, command.sheetIndex, command.afterRowIndex);
    case "add-column":
      return addColumn(workbook, command.sheetIndex, command.afterColIndex);
    case "add-sheet":
      return addSheet(workbook);
    case "remove-sheet":
      return removeSheet(workbook, command.sheetIndex);
    case "rename-sheet":
      return renameSheet(workbook, command.sheetIndex, command.name);
    case "clear-range":
      return command.includeModifiers ? clearRangeAll(workbook, command.range) : clearRange(workbook, command.range);
    case "fill-range":
      return fillRange(workbook, command.range, command.source);
    case "paste-matrix":
      return pasteMatrixAt(workbook, command.start, command.matrix);
    case "batch":
      return command.commands.reduce(reduceEditorDocumentCommand, workbook);
  }
}

function reduceCellUpdate(
  workbook: EditorWorkbook,
  command: Extract<EditorDocumentCommand, { type: "update-cell" }>
): EditorWorkbook {
  if (command.mode === "raw") {
    return updateCellRaw(workbook, command.address, command.source);
  }
  return command.mode === "content"
    ? updateCellContentSource(workbook, command.address, command.source)
    : updateCellSource(workbook, command.address, command.source);
}

interface TargetReducers {
  cell: (workbook: EditorWorkbook, address: CellAddress) => EditorWorkbook;
  row: (workbook: EditorWorkbook, address: CellAddress) => EditorWorkbook;
  column: (workbook: EditorWorkbook, address: CellAddress) => EditorWorkbook;
}

function updateTarget(
  workbook: EditorWorkbook,
  target: EditorCommandTarget,
  reducers: TargetReducers
): EditorWorkbook {
  if (target.scope === "cell" || target.scope === "row") {
    const reducer = target.scope === "cell" ? reducers.cell : reducers.row;
    return target.addresses.reduce(reducer, workbook);
  }
  const resolution = ensureColumnHeaderRow(workbook, target.sheetIndex);
  return target.colIndexes.reduce((current, colIndex) => reducers.column(current, {
    sheetIndex: target.sheetIndex,
    rowIndex: resolution.headerRowIndex,
    colIndex
  }), resolution.workbook);
}

function updateTargetModifiers(
  workbook: EditorWorkbook,
  target: EditorCommandTarget,
  source: string
): EditorWorkbook {
  return updateTarget(workbook, target, {
    cell: (current, address) => {
      const content = getCellContentText(getCellAt(current.sheets[address.sheetIndex], address.rowIndex, address.colIndex));
      return updateCellSource(current, address, composeCellSource(content, source));
    },
    row: (current, address) => updateRowModifierSource(current, address, source),
    column: (current, address) => updateColumnModifierSource(
      current,
      address.sheetIndex,
      address.rowIndex,
      address.colIndex,
      source
    )
  });
}

function updateHeaderColumn(
  workbook: EditorWorkbook,
  sheetIndex: number,
  colIndex: number,
  update: (workbook: EditorWorkbook, address: CellAddress) => EditorWorkbook
): EditorWorkbook {
  const resolution = ensureColumnHeaderRow(workbook, sheetIndex);
  return update(resolution.workbook, {
    sheetIndex,
    rowIndex: resolution.headerRowIndex,
    colIndex
  });
}
