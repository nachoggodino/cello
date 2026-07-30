import { startTransition, useEffect, useLayoutEffect, useMemo, useRef, useState, type ClipboardEvent as ReactClipboardEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  addColumn,
  addRow,
  addSheet,
  applyWorkbookPatch,
  clearRange,
  clearRangeAll,
  composeCellSource,
  copyRangeAsTsv,
  createEditorDocument,
  DEFAULT_SHEET_NAME,
  ensureColumnHeaderRow,
  fillRange,
  getCellAddressKey,
  getCellAt,
  getCellContentText,
  getCellHeadingPrefix,
  getCellModifierSourceText,
  getCellRangeSize,
  getColumnWidthValue,
  getColumnName,
  getDefaultCellAt,
  getInheritedModifierGroups,
  getRowHeightValue,
  getScopedColorValue,
  getScopedToneValue,
  getSelectedCell,
  getVisibleColumnCount,
  getVisibleRowCount,
  getVisualCellSpan,
  getVisualColumnStyle,
  hasScopedModifier,
  isColumnFit,
  isRowWrap,
  mergeCell,
  parseClipboardMatrix,
  pasteMatrixAt,
  removeSheet,
  renameSheet,
  setCellColorModifier,
  setCellToneModifier,
  setColumnColorModifier,
  setColumnToneModifier,
  setColumnWidth,
  setRowHeight,
  setRowColorModifier,
  setRowToneModifier,
  setSheetColumnsMode,
  setSheetRowsMode,
  toggleColumnFit,
  toggleColumnModifier,
  toggleCellModifier,
  toggleRowWrap,
  toggleRowModifier,
  updateCellContentSource,
  updateCellRaw,
  updateCellSource,
  updateColumnModifierSource,
  updateDefaultCellSource,
  updateRowModifierSource,
} from "@nachoggodino/cello/editor-core";
import type {
  CellAddress,
  ColorModifierKey,
  EditorSheet,
  EditorWorkbook,
  TextTone,
  ToggleModifierKey
} from "@nachoggodino/cello/editor-core";
import {
  EditorToolbarRows
} from "./components/editorToolbar.js";
import type {
  EditorToolbarActions,
  EditorToolbarModel
} from "./components/editorToolbar.js";
import {
  VisualConfigurationScaffold,
  VisualDataRows
} from "./components/gridRows.js";
import type { EditingDraft } from "./components/gridRows.js";
import { SheetTabs } from "./components/sheetTabs.js";
import {
  getCommonValue,
  getSelectionModifierSources
} from "./derivedSelection.js";
import {
  formatMeasuredWidth,
  getFitMeasureEntries,
  useMeasuredFitColumnWidths,
  withMeasuredFitWidth
} from "./fitColumns.js";
import { useComputedValues } from "./hooks/useComputedValues.js";
import { useSourceHistory } from "./hooks/useSourceHistory.js";
import {
  clampAddress,
  getGridCellId,
  moveAddress,
  scrollSelectionNearEdge
} from "./interactions/grid.js";
import type { MoveDirection } from "./interactions/grid.js";
import { handleGridKeyDown as handleGridKeyboardEvent } from "./interactions/keyboard.js";
import {
  createCellSelection,
  expandRangeForMergedCells,
  formatSelectionLabel,
  getMergeOwnerAddress,
  getRangeAddresses,
  getSelectionRange,
  isPasteCompatibleWithMergedCells,
  rangeContainsMergedCells,
  resolveModifierScope,
  shiftSelectionRows
} from "./selection.js";
import type { GridSelection } from "./selection.js";
import { defaultLabels } from "./labels.js";
import type { CelloVisualEditorProps } from "./types.js";

export type { CelloVisualEditorLabels, CelloVisualEditorProps } from "./types.js";

const defaultTextColor = "#1f1e1b";
const defaultFillColor = "#fffaf4";
const defaultColumnWidthPlaceholder = "normal";
const fallbackSheet: EditorSheet = { name: DEFAULT_SHEET_NAME, format: { kind: "cello" }, layout: {}, rows: [], defaults: [] };
const inlineStrikeMarker = "~~";

type GridMode = "navigate" | "edit";
type HistoryMode = "push" | "skip";


export function CelloVisualEditor({
  source,
  onSourceChange,
  activeSheetName,
  className,
  labels: labelOverrides,
  onActiveSheetChange,
  onRequestSourceView,
  onCommandFailure,
  onDiagnosticsChange,
  readExternalSource
}: CelloVisualEditorProps) {
  const labels = useMemo(() => ({ ...defaultLabels, ...labelOverrides }), [labelOverrides]);
  const workbookOptions = useMemo(() => ({ ...(readExternalSource ? { readExternalSource } : {}) }), [readExternalSource]);
  const [editorDocument, setEditorDocument] = useState(() => createEditorDocument(source, workbookOptions));
  const editorDocumentRef = useRef(editorDocument);
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [selection, setSelection] = useState<GridSelection>(() => createCellSelection({ sheetIndex: 0, rowIndex: 0, colIndex: 0 }));
  const computedValues = useComputedValues(source, workbookOptions);
  const [editingDraft, setEditingDraft] = useState<EditingDraft | null>(null);
  const [liveMessage, setLiveMessage] = useState("");
  const [commandError, setCommandError] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const draggingSelectionRef = useRef(false);
  const completedEditRef = useRef<string | null>(null);
  const pendingGridFocusRef = useRef(false);

  useEffect(() => {
    const nextDocument = createEditorDocument(source, workbookOptions);
    editorDocumentRef.current = nextDocument;
    startTransition(() => {
      setEditorDocument(nextDocument);
      setActiveSheetIndex((index) => {
        const requestedIndex = activeSheetName ? nextDocument.workbook.sheets.findIndex((sheet) => sheet.name === activeSheetName) : -1;
        return requestedIndex >= 0 ? requestedIndex : Math.min(index, nextDocument.workbook.sheets.length - 1);
      });
      setSelection((current) => ({
        ...current,
        anchor: clampAddress(current.anchor, nextDocument.workbook),
        active: clampAddress(current.active, nextDocument.workbook)
      }));
      setEditingDraft(null);
    });
  }, [activeSheetName, source, workbookOptions]);

  useEffect(() => {
    if (!commandError) {
      return;
    }
    const timeout = window.setTimeout(() => setCommandError(null), 15000);
    return () => window.clearTimeout(timeout);
  }, [commandError]);

  useEffect(() => {
    const stopDragging = () => {
      draggingSelectionRef.current = false;
    };
    window.addEventListener("mouseup", stopDragging);
    return () => window.removeEventListener("mouseup", stopDragging);
  }, []);

  useEffect(() => {
    onDiagnosticsChange?.(editorDocument.diagnostics);
  }, [editorDocument.diagnostics, onDiagnosticsChange]);

  const workbook = editorDocument.workbook;
  const activeSheet = workbook.sheets[activeSheetIndex] ?? workbook.sheets[0] ?? fallbackSheet;
  const selected = selection.active;
  const selectedDefaultCol = selection.kind === "default" ? selected.colIndex : null;
  const gridMode: GridMode = editingDraft ? "edit" : "navigate";
  const workbookContext = useMemo(() => (workbook.aliases ? { aliases: workbook.aliases } : {}), [workbook.aliases]);
  const selectedCell = selectedDefaultCol === null ? getSelectedCell(workbook, selected) : getDefaultCellAt(activeSheet, selectedDefaultCol);
  const selectedHeadingPrefix = getCellHeadingPrefix(selectedCell);
  const visibleRowCount = getVisibleRowCount(activeSheet);
  const visibleColumnCount = getVisibleColumnCount(activeSheet);
  const renderedColumnCount = activeSheet.format.kind === "cello"
    ? Math.max(1, visibleColumnCount)
    : visibleColumnCount;
  const selectedContentText = getCellContentText(selectedCell);
  const inheritedGroups = selectedDefaultCol === null ? getInheritedModifierGroups(activeSheet, selected.rowIndex, selected.colIndex) : [];
  const selectedColumnFit = isColumnFit(activeSheet, selected.rowIndex, selected.colIndex);
  const selectedColumnWidth = getColumnWidthValue(activeSheet, selected.rowIndex, selected.colIndex);
  const logicalSelectedRange = getSelectionRange(selection, visibleRowCount, visibleColumnCount);
  const selectedRange = selection.kind === "cells"
    ? expandRangeForMergedCells(activeSheet, logicalSelectedRange)
    : logicalSelectedRange;
  const modifierScope = resolveModifierScope(selection, logicalSelectedRange, activeSheet, visibleRowCount, visibleColumnCount);
  const selectedTextColor = getScopedColorValue(activeSheet, selected, modifierScope, "color", defaultTextColor);
  const selectedFillColor = getScopedColorValue(activeSheet, selected, modifierScope, "bg", defaultFillColor);
  const selectedTone = getScopedToneValue(activeSheet, selected, modifierScope);
  const selectedLabel = formatSelectionLabel(activeSheet.name, selection, selectedRange);
  const modifierSources = selectedDefaultCol === null
    ? getSelectionModifierSources(activeSheet, selectedRange, modifierScope)
    : [getCellModifierSourceText(selectedCell)];
  const selectedModifierText = getCommonValue(modifierSources) ?? "";
  const modifiersMixed = new Set(modifierSources).size > 1;
  const draftCell = editingDraft ? { key: getCellAddressKey(editingDraft.address), value: editingDraft.value } : null;
  const fitMeasureRef = useRef<HTMLDivElement>(null);
  const fitMeasureEntries = getFitMeasureEntries(workbookContext, activeSheet, activeSheetIndex, selected.rowIndex, visibleColumnCount, computedValues);
  const measuredFitColumnWidths = useMeasuredFitColumnWidths(fitMeasureRef, fitMeasureEntries);
  const selectedColumnResolvedFit = selectedColumnFit || (!selectedColumnWidth && activeSheet.layout?.columns === "fit");
  const selectedMeasuredFitWidth = measuredFitColumnWidths[selected.colIndex];
  const selectedMeasuredFitWidthDisplay = formatMeasuredWidth(selectedMeasuredFitWidth);
  const selectedWidthDisplay = selectedColumnResolvedFit ? `fit${selectedMeasuredFitWidthDisplay ? `: ${selectedMeasuredFitWidthDisplay}` : ""}` : selectedColumnWidth || defaultColumnWidthPlaceholder;
  const selectedRowWrap = isRowWrap(activeSheet, selected.rowIndex);
  const selectedRowHeight = getRowHeightValue(activeSheet, selected.rowIndex);
  const diagnosticMessage = commandError ?? editorDocument.diagnostics.find((diagnostic) => diagnostic.level === "warning" || diagnostic.level === "error")?.message ?? null;

  useEffect(() => {
    if (activeSheet.name) {
      onActiveSheetChange?.(activeSheet.name);
    }
  }, [activeSheet.name, onActiveSheetChange]);

  useEffect(() => {
    if (!editingDraft) {
      return;
    }
    const label = `${getColumnName(editingDraft.address.colIndex)}${editingDraft.address.rowIndex + 1}`;
    const textarea = gridRef.current?.querySelector<HTMLTextAreaElement>(`textarea[aria-label="${label}"]`);
    if (!textarea || document.activeElement === textarea) {
      return;
    }
    textarea.focus();
    const caret = textarea.value.length;
    textarea.setSelectionRange(caret, caret);
  }, [editingDraft]);

  useLayoutEffect(() => {
    if (editingDraft || !pendingGridFocusRef.current) {
      return;
    }
    pendingGridFocusRef.current = false;
    gridRef.current?.focus();
  }, [editingDraft, selected]);

  useEffect(() => {
    if (editingDraft || selection.kind === "default") {
      return;
    }
    const activeCell = gridRef.current?.querySelector<HTMLElement>(`[data-cell-address="${getCellAddressKey(selected)}"]`);
    activeCell?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [editingDraft, selected, selection.kind]);

  const applySourceSnapshot = (nextSource: string) => {
    const nextDocument = createEditorDocument(nextSource, workbookOptions);
    editorDocumentRef.current = nextDocument;
    setEditorDocument(nextDocument);
    setEditingDraft(null);
    setCommandError(null);
    onSourceChange(nextSource);
  };

  const { pushHistoryEntry, redo, undo } = useSourceHistory(
    editorDocument.source,
    (nextSource) => applySourceSnapshot(nextSource),
    setLiveMessage
  );

  const commit = (update: (current: EditorWorkbook) => EditorWorkbook, mode: HistoryMode = "push"): boolean => {
    const currentDocument = editorDocumentRef.current;
    const nextWorkbook = update(currentDocument.workbook);
    const result = applyWorkbookPatch(currentDocument, nextWorkbook, workbookOptions);
    if (!result.ok) {
      setCommandError(result.message);
      onCommandFailure?.(result);
      return false;
    }
    setCommandError(null);
    if (mode === "push" && result.source !== currentDocument.source) {
      pushHistoryEntry(currentDocument.source);
    }
    editorDocumentRef.current = result.document;
    setEditorDocument(result.document);
    onSourceChange(result.source);
    return true;
  };

  const selectCell = (rowIndex: number, colIndex: number, extendRange = false) => {
    const next = { sheetIndex: activeSheetIndex, rowIndex, colIndex };
    setSelection((current) => ({
      kind: "cells",
      anchor: extendRange && current.kind === "cells" ? current.anchor : next,
      active: next
    }));
    setEditingDraft(null);
    focusGrid();
  };

  const selectDefaultCell = (colIndex: number) => {
    const next = { sheetIndex: activeSheetIndex, rowIndex: 0, colIndex };
    setSelection({ kind: "default", anchor: next, active: next });
    setEditingDraft(null);
  };

  const selectRow = (rowIndex: number, extendRange: boolean) => {
    const next = { sheetIndex: activeSheetIndex, rowIndex, colIndex: selected.colIndex };
    setSelection((current) => ({
      kind: "rows",
      anchor: extendRange && current.kind === "rows" ? current.anchor : next,
      active: next
    }));
    setEditingDraft(null);
    focusGrid();
  };

  const selectColumn = (colIndex: number, extendRange: boolean) => {
    const next = { sheetIndex: activeSheetIndex, rowIndex: selected.rowIndex, colIndex };
    setSelection((current) => ({
      kind: "columns",
      anchor: extendRange && current.kind === "columns" ? current.anchor : next,
      active: next
    }));
    setEditingDraft(null);
    focusGrid();
  };

  const handleAddSheet = () => {
    setEditorDocument((currentDocument) => {
      const current = currentDocument.workbook;
      const next = addSheet(current);
      const result = applyWorkbookPatch(currentDocument, next, workbookOptions);
      if (!result.ok) {
        setCommandError(result.message);
        onCommandFailure?.(result);
        return currentDocument;
      }
      const nextSheetIndex = next.sheets.length - 1;
      const nextSelected = { sheetIndex: nextSheetIndex, rowIndex: 0, colIndex: 0 };
      setActiveSheetIndex(nextSheetIndex);
      setSelection(createCellSelection(nextSelected));
      setEditingDraft(null);
      setCommandError(null);
      if (result.source !== currentDocument.source) {
        pushHistoryEntry(currentDocument.source);
      }
      onSourceChange(result.source);
      editorDocumentRef.current = result.document;
      return result.document;
    });
  };

  const handleRemoveSheet = () => {
    setEditorDocument((currentDocument) => {
      const current = currentDocument.workbook;
      const next = removeSheet(current, activeSheetIndex);
      const result = applyWorkbookPatch(currentDocument, next, workbookOptions);
      if (!result.ok) {
        setCommandError(result.message);
        onCommandFailure?.(result);
        return currentDocument;
      }
      const nextSheetIndex = Math.min(activeSheetIndex, next.sheets.length - 1);
      const nextSelected = { sheetIndex: nextSheetIndex, rowIndex: 0, colIndex: 0 };
      setActiveSheetIndex(nextSheetIndex);
      setSelection(createCellSelection(nextSelected));
      setEditingDraft(null);
      setCommandError(null);
      if (result.source !== currentDocument.source) {
        pushHistoryEntry(currentDocument.source);
      }
      onSourceChange(result.source);
      editorDocumentRef.current = result.document;
      return result.document;
    });
  };

  const activateSheet = (sheetIndex: number) => {
    const sheet = workbook.sheets[sheetIndex];
    if (!sheet) {
      return;
    }
    const nextSelected = { sheetIndex, rowIndex: 0, colIndex: 0 };
    setActiveSheetIndex(sheetIndex);
    setSelection(createCellSelection(nextSelected));
    setEditingDraft(null);
    onActiveSheetChange?.(sheet.name);
  };

  const controlsDisabled = selectedDefaultCol !== null;

  const applyScopedUpdate = (
    cellUpdate: (current: EditorWorkbook, address: CellAddress) => EditorWorkbook,
    rowUpdate: (current: EditorWorkbook, address: CellAddress) => EditorWorkbook,
    columnUpdate: (current: EditorWorkbook, headerRowIndex: number, colIndex: number) => EditorWorkbook
  ) => {
    if (selectedDefaultCol !== null) {
      return;
    }
    commit((current) => {
      let next = current;
      if (modifierScope === "cell") {
        for (const address of getRangeAddresses(selectedRange)) {
          next = cellUpdate(next, address);
        }
        return next;
      }
      if (modifierScope === "row") {
        for (let rowIndex = selectedRange.startRow; rowIndex <= selectedRange.endRow; rowIndex += 1) {
          next = rowUpdate(next, { ...selected, rowIndex });
        }
        return next;
      }
      const resolution = ensureColumnHeaderRow(next, activeSheetIndex);
      if (resolution.rowOffset !== 0) {
        setSelection((currentSelection) => shiftSelectionRows(currentSelection, resolution.rowOffset));
      }
      next = resolution.workbook;
      for (let colIndex = selectedRange.startCol; colIndex <= selectedRange.endCol; colIndex += 1) {
        next = columnUpdate(next, resolution.headerRowIndex, colIndex);
      }
      return next;
    });
  };

  const handleToggleModifier = (key: ToggleModifierKey) => {
    applyScopedUpdate(
      (current, address) => toggleCellModifier(current, address, key),
      (current, address) => toggleRowModifier(current, address, key),
      (current, headerRowIndex, colIndex) => toggleColumnModifier(current, activeSheetIndex, headerRowIndex, colIndex, key)
    );
  };

  const handleSetColor = (key: ColorModifierKey, value: string) => {
    applyScopedUpdate(
      (current, address) => setCellColorModifier(current, address, key, value),
      (current, address) => setRowColorModifier(current, address, key, value),
      (current, headerRowIndex, colIndex) => setColumnColorModifier(current, activeSheetIndex, headerRowIndex, colIndex, key, value)
    );
  };

  const handleSetTone = (value: TextTone) => {
    applyScopedUpdate(
      (current, address) => setCellToneModifier(current, address, value),
      (current, address) => setRowToneModifier(current, address, value),
      (current, headerRowIndex, colIndex) => setColumnToneModifier(current, activeSheetIndex, headerRowIndex, colIndex, value)
    );
  };

  const handleContentChange = (value: string) => {
    commit((current) => selectedDefaultCol === null
      ? updateCellContentSource(current, selected, value)
      : updateDefaultCellSource(current, activeSheetIndex, selectedDefaultCol, composeCellSource(value, selectedModifierText)));
  };

  const handleModifierSourceChange = (value: string) => {
    if (selectedDefaultCol !== null) {
      commit((current) => updateDefaultCellSource(current, activeSheetIndex, selectedDefaultCol, composeCellSource(selectedContentText, value)));
      return;
    }
    commit((current) => {
      let next = current;
      if (modifierScope === "cell") {
        for (const address of getRangeAddresses(selectedRange)) {
          const content = getCellContentText(getCellAt(next.sheets[address.sheetIndex], address.rowIndex, address.colIndex));
          next = updateCellSource(next, address, composeCellSource(content, value));
        }
        return next;
      }
      if (modifierScope === "row") {
        for (let rowIndex = selectedRange.startRow; rowIndex <= selectedRange.endRow; rowIndex += 1) {
          next = updateRowModifierSource(next, { ...selected, rowIndex }, value);
        }
        return next;
      }
      const resolution = ensureColumnHeaderRow(next, activeSheetIndex);
      if (resolution.rowOffset !== 0) {
        setSelection((currentSelection) => shiftSelectionRows(currentSelection, resolution.rowOffset));
      }
      next = resolution.workbook;
      for (let colIndex = selectedRange.startCol; colIndex <= selectedRange.endCol; colIndex += 1) {
        next = updateColumnModifierSource(next, activeSheetIndex, resolution.headerRowIndex, colIndex, value);
      }
      return next;
    });
  };

  const materializeHeaderCell = (colIndex: number, value: string) => {
    if (!value) {
      return;
    }
    commit((current) => {
      const resolution = ensureColumnHeaderRow(current, activeSheetIndex);
      const address = { sheetIndex: activeSheetIndex, rowIndex: resolution.headerRowIndex, colIndex };
      setSelection(createCellSelection(address));
      return updateCellContentSource(resolution.workbook, address, value);
    });
  };

  const materializeDefaultCell = (colIndex: number, value: string) => {
    if (!value) {
      return;
    }
    commit((current) => {
      const resolution = ensureColumnHeaderRow(current, activeSheetIndex);
      setSelection({
        kind: "default",
        anchor: { sheetIndex: activeSheetIndex, rowIndex: resolution.headerRowIndex, colIndex },
        active: { sheetIndex: activeSheetIndex, rowIndex: resolution.headerRowIndex, colIndex }
      });
      return updateDefaultCellSource(resolution.workbook, activeSheetIndex, colIndex, value);
    });
  };

  const handleApplyPrefix = (prefix: string) => {
    if (selectedDefaultCol === null) {
      commit((current) => updateCellRaw(current, selected, setHeadingPrefix(selectedContentText, prefix)));
    }
  };

  const handleToggleInlineStrike = () => {
    if (selectedDefaultCol === null) {
      commit((current) => updateCellRaw(current, selected, toggleWrappedText(selectedContentText, inlineStrikeMarker)));
    }
  };

  const withHeaderColumn = (update: (current: EditorWorkbook, headerRowIndex: number) => EditorWorkbook) => {
    commit((current) => {
      const resolution = ensureColumnHeaderRow(current, activeSheetIndex);
      const nextSelected = { ...selected, rowIndex: selected.rowIndex + resolution.rowOffset };
      if (resolution.rowOffset !== 0) {
        setSelection(createCellSelection(nextSelected));
      }
      return update(resolution.workbook, resolution.headerRowIndex);
    });
  };

  const focusGrid = () => {
    gridRef.current?.focus();
  };

  const enterEditMode = (address: CellAddress, entry: EditingDraft["entry"], value?: string) => {
    const cell = getCellAt(workbook.sheets[address.sheetIndex], address.rowIndex, address.colIndex);
    const original = getCellContentText(cell);
    completedEditRef.current = null;
    setSelection(createCellSelection(address));
    setEditingDraft({
      address,
      entry,
      original,
      value: entry === "replace" ? value ?? "" : original
    });
  };

  const commitEditingDraft = (): boolean => {
    if (!editingDraft) {
      return true;
    }
    const draft = editingDraft;
    completedEditRef.current = getCellAddressKey(draft.address);
    setEditingDraft(null);
    if (draft.value === draft.original) {
      return true;
    }
    return commit((current) => updateCellContentSource(current, draft.address, draft.value));
  };

  const cancelEditingDraft = () => {
    if (editingDraft) {
      completedEditRef.current = getCellAddressKey(editingDraft.address);
    }
    setEditingDraft(null);
    pendingGridFocusRef.current = true;
  };

  const moveActiveCell = (direction: MoveDirection, extendRange: boolean) => {
    const owner = getMergeOwnerAddress(activeSheet, selected);
    const ownerSpan = getVisualCellSpan(activeSheet, owner.rowIndex, owner.colIndex);
    const adjacent = direction === "right"
      ? { ...owner, colIndex: owner.colIndex + ownerSpan.colspan }
      : direction === "down"
        ? { ...owner, rowIndex: owner.rowIndex + ownerSpan.rowspan }
        : moveAddress(owner, direction);
    const next = getMergeOwnerAddress(activeSheet, clampAddress(adjacent, workbook));
    setSelection((current) => ({
      kind: "cells",
      anchor: extendRange && current.kind === "cells" ? current.anchor : next,
      active: next
    }));
    pendingGridFocusRef.current = true;
  };

  const commitAndMove = (direction: MoveDirection, extendRange = false) => {
    if (!commitEditingDraft()) {
      return;
    }
    moveActiveCell(direction, extendRange);
  };

  const writeClipboardText = (value: string) => {
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(value).catch(() => undefined);
    }
  };

  const copySelectedRange = () => {
    const text = copyRangeAsTsv(workbook, selectedRange);
    writeClipboardText(text);
    const size = getCellRangeSize(selectedRange);
    setLiveMessage(`Copied ${size.cells} ${size.cells === 1 ? "cell" : "cells"}`);
    return text;
  };

  const cutSelectedRange = () => {
    copySelectedRange();
    if (commit((current) => clearRangeAll(current, selectedRange))) {
      const size = getCellRangeSize(selectedRange);
      setLiveMessage(`Cut ${size.cells} ${size.cells === 1 ? "cell" : "cells"}`);
    }
  };

  const pasteTextAtSelection = (text: string) => {
    const matrix = parseClipboardMatrix(text);
    if (matrix.length === 0) {
      return;
    }
    const singleValue = matrix.length === 1 && matrix[0]?.length === 1 ? matrix[0][0] : undefined;
    const fillsSelectedRange = singleValue !== undefined && getCellRangeSize(selectedRange).cells > 1;
    if (
      !isPasteCompatibleWithMergedCells(activeSheet, selected, matrix) ||
      (fillsSelectedRange && rangeContainsMergedCells(activeSheet, selectedRange))
    ) {
      setCommandError("Paste would split or replace part of a merged cell. Paste a range with the same merge layout.");
      return;
    }
    const didCommit = fillsSelectedRange
      ? commit((current) => fillRange(current, selectedRange, singleValue))
      : commit((current) => pasteMatrixAt(current, selected, matrix));
    if (didCommit) {
      const cellCount = matrix.reduce((total, row) => total + row.length, 0);
      setLiveMessage(`Pasted ${cellCount} ${cellCount === 1 ? "cell" : "cells"}`);
      if (singleValue === undefined || getCellRangeSize(selectedRange).cells === 1) {
        const rowCount = matrix.length;
        const columnCount = Math.max(0, ...matrix.map((row) => row.length));
        const active = {
          sheetIndex: selected.sheetIndex,
          rowIndex: selected.rowIndex + Math.max(0, rowCount - 1),
          colIndex: selected.colIndex + Math.max(0, columnCount - 1)
        };
        setSelection({ kind: "cells", anchor: selected, active });
      }
    }
  };

  const handleGridKeyDown = (event: ReactKeyboardEvent) => {
    handleGridKeyboardEvent(event, {
      editing: gridMode === "edit",
      editingEntry: editingDraft?.entry,
      selected,
      actions: {
        cancelEditing: cancelEditingDraft,
        clearSelection: () => {
          if (commit((current) => clearRange(current, selectedRange))) {
            setLiveMessage("Cleared selection");
          }
        },
        commitAndMove,
        copy: copySelectedRange,
        cut: cutSelectedRange,
        enterEditMode,
        move: moveActiveCell,
        paste: pasteTextAtSelection,
        redo,
        undo
      }
    });
  };

  const handleGridPaste = (event: ReactClipboardEvent) => {
    if (selectedDefaultCol !== null) {
      return;
    }
    const text = event.clipboardData.getData("text/plain");
    if (!text) {
      return;
    }
    event.preventDefault();
    pasteTextAtSelection(text);
  };

  const toolbarModel: EditorToolbarModel = {
    labels,
    selectedLabel,
    selectedContentText,
    selectedModifierText,
    modifiersMixed,
    inheritedGroups,
    controlsDisabled,
    boldActive: hasScopedModifier(
      activeSheet,
      selected,
      modifierScope,
      "bold"
    ),
    italicActive: hasScopedModifier(
      activeSheet,
      selected,
      modifierScope,
      "italic"
    ),
    strikeActive: hasScopedModifier(
      activeSheet,
      selected,
      modifierScope,
      "strike"
    ),
    selectedHeadingPrefix,
    selectedTextColor,
    selectedFillColor,
    selectedTone,
    columnsMode: activeSheet.layout?.columns ?? "normal",
    rowsMode: activeSheet.layout?.rows ?? "wrap",
    canAddColumn: visibleRowCount > 0,
    selectedColumnResolvedFit,
    selectedWidthDisplay,
    selectedColumnWidth,
    selectedRowWrap,
    selectedRowHeight,
    showSourceButton: onRequestSourceView !== undefined
  };

  const toolbarActions: EditorToolbarActions = {
    changeContent: handleContentChange,
    changeModifiers: handleModifierSourceChange,
    toggleModifier: handleToggleModifier,
    toggleInlineStrike: handleToggleInlineStrike,
    applyPrefix: handleApplyPrefix,
    setColor: handleSetColor,
    setTone: handleSetTone,
    setColumnsMode: (value) =>
      commit((current) =>
        setSheetColumnsMode(
          current,
          activeSheetIndex,
          value === "normal" ? undefined : value
        )
      ),
    setRowsMode: (value) =>
      commit((current) =>
        setSheetRowsMode(
          current,
          activeSheetIndex,
          value === "wrap" ? undefined : value
        )
      ),
    mergeLeft: () =>
      commit((current) => mergeCell(current, selected, "left")),
    mergeUp: () => commit((current) => mergeCell(current, selected, "up")),
    addRow: () =>
      commit((current) =>
        addRow(
          current,
          activeSheetIndex,
          visibleRowCount === 0 ? undefined : selected.rowIndex
        )
      ),
    addColumn: () =>
      commit((current) =>
        addColumn(current, activeSheetIndex, selected.colIndex)
      ),
    toggleColumnFit: () =>
      withHeaderColumn((current, headerRowIndex) =>
        toggleColumnFit(
          current,
          activeSheetIndex,
          headerRowIndex,
          selected.colIndex
        )
      ),
    setColumnWidth: (value) =>
      withHeaderColumn((current, headerRowIndex) =>
        setColumnWidth(
          current,
          activeSheetIndex,
          headerRowIndex,
          selected.colIndex,
          value
        )
      ),
    toggleRowWrap: () =>
      commit((current) => toggleRowWrap(current, selected)),
    setRowHeight: (value) =>
      commit((current) => setRowHeight(current, selected, value)),
    requestSourceView: () => onRequestSourceView?.()
  };

  return (
    <main className={["celloVisualEditorShell", className].filter(Boolean).join(" ")}>
      {diagnosticMessage ? (
        <div className="celloVisualCommandError" role="status">
          {diagnosticMessage}
        </div>
      ) : null}
      <section className="celloVisualToolbar" aria-label={labels.toolbar}>
        <EditorToolbarRows actions={toolbarActions} model={toolbarModel} />

        <SheetTabs
          activeSheetIndex={activeSheetIndex}
          labels={labels}
          workbook={workbook}
          onActivate={activateSheet}
          onAdd={handleAddSheet}
          onRemove={handleRemoveSheet}
          onRename={(name) =>
            commit((current) => renameSheet(current, activeSheetIndex, name))
          }
        />
      </section>

      <section className="celloVisualWorkbook" aria-label={labels.workbook}>
        <div
          ref={gridRef}
          className="celloVisualGridWrap"
          role="grid"
          tabIndex={0}
          aria-label={labels.workbook}
          aria-multiselectable="true"
          aria-activedescendant={selectedDefaultCol === null && visibleRowCount > 0 && visibleColumnCount > 0 ? getGridCellId(selected) : undefined}
          aria-rowcount={visibleRowCount}
          aria-colcount={renderedColumnCount}
          onKeyDown={handleGridKeyDown}
          onPaste={handleGridPaste}
          onMouseMove={(event) => {
            if (!draggingSelectionRef.current) {
              return;
            }
            scrollSelectionNearEdge(event.currentTarget, event.clientX, event.clientY);
          }}
        >
          {renderedColumnCount === 0 ? (
            <div className="celloVisualEmptySheet">
              <strong>Empty sheet</strong>
              <span>Add a row to start this table.</span>
              <button type="button" className="celloVisualButton celloVisualPrimaryAction" onClick={() => commit((current) => addRow(current, activeSheetIndex))}>
                {labels.newRow}
              </button>
            </div>
          ) : <table className="celloVisualGrid">
            <thead>
              <tr role="row">
                <th
                  className={`celloVisualCorner ${selection.kind === "cells" && getCellRangeSize(selectedRange).cells === visibleRowCount * visibleColumnCount ? "selectedHeader" : ""}`}
                  onClick={() => {
                    const anchor = { sheetIndex: activeSheetIndex, rowIndex: 0, colIndex: 0 };
                    const active = { sheetIndex: activeSheetIndex, rowIndex: visibleRowCount - 1, colIndex: visibleColumnCount - 1 };
                    setSelection({ kind: "cells", anchor, active });
                    setEditingDraft(null);
                    focusGrid();
                  }}
                />
                {Array.from({ length: renderedColumnCount }, (_, colIndex) => (
                  <th
                    key={colIndex}
                    role="columnheader"
                    aria-colindex={colIndex + 1}
                    aria-selected={modifierScope === "column" && colIndex >= selectedRange.startCol && colIndex <= selectedRange.endCol}
                    className={[
                      "celloVisualColumnHeader",
                      modifierScope === "column" && colIndex >= selectedRange.startCol && colIndex <= selectedRange.endCol ? "selectedHeader" : "",
                      modifierScope !== "row" && selected.colIndex === colIndex ? "activeHeader" : ""
                    ].filter(Boolean).join(" ")}
                    style={withMeasuredFitWidth(getVisualColumnStyle(workbookContext, activeSheet, selected.rowIndex, colIndex), measuredFitColumnWidths[colIndex])}
                    onClick={(event) => selectColumn(colIndex, event.shiftKey)}
                  >
                    {getColumnName(colIndex)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!activeSheet.rows.some((row) => row.kind === "header") ? (
                <VisualConfigurationScaffold
                  columnCount={renderedColumnCount}
                  labels={labels}
                  onDefaultCommit={materializeDefaultCell}
                  onHeaderCommit={materializeHeaderCell}
                />
              ) : null}
              {Array.from({ length: visibleRowCount }, (_, rowIndex) => (
                <VisualDataRows
                  key={rowIndex}
                  activeSheet={activeSheet}
                  activeSheetIndex={activeSheetIndex}
                  aliases={workbook.aliases}
                  computedValues={computedValues}
                  measuredFitColumnWidths={measuredFitColumnWidths}
                  labels={labels}
                  modifierScope={modifierScope}
                  rowIndex={rowIndex}
                  selectionKind={selection.kind}
                  selected={selected}
                  selectedRange={selectedRange}
                  selectedDefaultCol={selectedDefaultCol}
                  visibleColumnCount={visibleColumnCount}
                  commit={commit}
                  commitEditingDraft={commitEditingDraft}
                  completedEditRef={completedEditRef}
                  gridMode={gridMode}
                  handleGridKeyDown={handleGridKeyDown}
                  draftCell={draftCell}
                  enterEditMode={enterEditMode}
                  selectCell={selectCell}
                  selectRow={selectRow}
                  selectDefaultCell={selectDefaultCell}
                  draggingSelectionRef={draggingSelectionRef}
                  setEditingDraft={setEditingDraft}
                />
              ))}
            </tbody>
          </table>}
          <span className="celloVisualLiveRegion" aria-live="polite">{liveMessage}</span>
          <div ref={fitMeasureRef} className="celloVisualFitMeasure" aria-hidden="true">
            {fitMeasureEntries.map((entry) => (
              <span key={entry.id} className="celloVisualFitMeasureItem" data-cello-fit-column={entry.colIndex} style={entry.style}>
                {entry.text}
              </span>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function setHeadingPrefix(source: string, prefix: string): string {
  const stripped = source.replace(/^(#{1,3})\s+/, "");
  return source.startsWith(prefix) ? stripped : `${prefix}${stripped}`;
}

function toggleWrappedText(source: string, marker: string): string {
  return source.startsWith(marker) && source.endsWith(marker) && source.length > marker.length * 2
    ? source.slice(marker.length, -marker.length)
    : `${marker}${source}${marker}`;
}
