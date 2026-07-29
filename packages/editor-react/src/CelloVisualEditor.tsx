import { startTransition, useEffect, useLayoutEffect, useMemo, useRef, useState, type ClipboardEvent as ReactClipboardEvent, type CSSProperties, type Dispatch, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type RefObject, type SetStateAction } from "react";
import {
  addColumn,
  addRow,
  addSheet,
  applyWorkbookPatch,
  CELLO_HEADING_STYLES,
  CELL_LAYOUT_METRICS,
  clearRange,
  clearRangeAll,
  composeCellSource,
  copyRangeAsTsv,
  createEditorDocument,
  DEFAULT_SHEET_NAME,
  ROW_HEIGHT_PRESETS,
  SHEET_COLUMNS_MODES,
  SHEET_ROWS_MODES,
  WIDTH_PRESET_NAMES,
  ensureColumnHeaderRow,
  evaluateEditorWorkbookSource,
  fillRange,
  getCellAddressKey,
  getCellAt,
  getCellFitMeasureText,
  getCellContentText,
  getCellFormattedDisplayText,
  getCellStyle,
  getCellSourceText,
  getCellHeadingPrefix,
  getCellModifierSourceText,
  getCellRangeSize,
  getCellToneClass,
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
  getVisualCellStyle,
  getVisualCellContentStyle,
  getVisualColumnStyle,
  hasScopedModifier,
  isAddressInRange,
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
  TEXT_TONES
} from "@nachoggodino/cello/editor-core";
import type {
  CellAddress,
  CellRange,
  ColorModifierKey,
  ComputedCellValues,
  CreateEditorWorkbookOptions,
  EditorCommandFailure,
  EditorDocument,
  EditorSheet,
  EditorWorkbook,
  TextTone,
  ToggleModifierKey
} from "@nachoggodino/cello/editor-core";
import { EditorIcon } from "./icons.js";
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
import type { GridSelection, SelectionKind } from "./selection.js";

export interface CelloVisualEditorLabels {
  bold: string;
  cellScope: string;
  columnScope: string;
  defaultsRow: string;
  deleteSheet: string;
  fillColor: string;
  h1: string;
  h2: string;
  h3: string;
  headerRow: string;
  inherited: string;
  italic: string;
  mergeLeft: string;
  mergeUp: string;
  newColumn: string;
  newRow: string;
  newSheet: string;
  noInheritedModifiers: string;
  modifiers: string;
  propertyScope: string;
  renameSheet: string;
  selectedColumn: string;
  selectedRow: string;
  rowScope: string;
  rowsMode: string;
  selectedCellSource: string;
  source: string;
  strike: string;
  tableGroup: string;
  textColor: string;
  textGroup: string;
  tone: string;
  toolbar: string;
  workbook: string;
  workbookSheets: string;
  columnsMode: string;
  defaultOption: string;
  columnsNormal: string;
  columnsFit: string;
  rowsEllipsis: string;
  rowsWrap: string;
  fit: string;
  width: string;
  wrap: string;
  height: string;
}

export interface CelloVisualEditorProps {
  source: string;
  onSourceChange: (source: string) => void;
  activeSheetName?: string;
  className?: string;
  labels?: Partial<CelloVisualEditorLabels>;
  onActiveSheetChange?: (sheetName: string) => void;
  onRequestSourceView?: () => void;
  onCommandFailure?: (failure: EditorCommandFailure) => void;
  onDiagnosticsChange?: (diagnostics: EditorDocument["diagnostics"]) => void;
  readExternalSource?: CreateEditorWorkbookOptions["readExternalSource"];
}

const defaultLabels: CelloVisualEditorLabels = {
  bold: "Bold",
  cellScope: "cell",
  columnScope: "column",
  defaultsRow: "Defaults",
  deleteSheet: "Delete sheet",
  fillColor: "Fill color",
  h1: "Large heading",
  h2: "Medium heading",
  h3: "Small heading",
  headerRow: "Header",
  inherited: "Inherited",
  italic: "Italic",
  mergeLeft: "Merge with left",
  mergeUp: "Merge with top",
  newColumn: "New column",
  newRow: "New row",
  newSheet: "New sheet",
  noInheritedModifiers: "None",
  modifiers: "Modifiers",
  propertyScope: "Property scope",
  renameSheet: "Rename active sheet",
  selectedColumn: "Column",
  selectedRow: "Row",
  rowScope: "row",
  rowsMode: "Rows",
  selectedCellSource: "Selected cell source",
  source: "Source",
  strike: "Strikethrough",
  tableGroup: "Table",
  textColor: "Text color",
  textGroup: "Text",
  tone: "Tone",
  toolbar: "Visual editor toolbar",
  workbook: "Visual spreadsheet editor",
  workbookSheets: "Workbook sheets",
  columnsMode: "Columns",
  defaultOption: "Default",
  columnsNormal: "Normal",
  columnsFit: "Fit",
  rowsEllipsis: "Ellipsis",
  rowsWrap: "Wrap",
  fit: "Fit",
  width: "Width",
  wrap: "Wrap",
  height: "Height"
};

const defaultTextColor = "#1f1e1b";
const defaultFillColor = "#fffaf4";
const defaultColumnWidthPlaceholder = "normal";
const defaultRowHeightPlaceholder = "auto";
const fitColumnMeasurementGuardPx = 2;
const fallbackSheet: EditorSheet = { name: DEFAULT_SHEET_NAME, format: { kind: "cello" }, layout: {}, rows: [], defaults: [] };
const headingStyles = CELLO_HEADING_STYLES.map((heading) => ({ labelKey: heading.level, prefix: heading.prefix }));
const formulaTokenPattern = /([A-Za-z_][\w ]*!|!!)|(\[[^\]]+\])|([+\-*/^(),[\]])|(=)|([A-Za-z_][\w ]*)|(\s+|.)/g;
const inlineStrikeMarker = "~~";
const maxHistoryEntries = 100;

type ModifierScope = "cell" | "row" | "column";
type DraftCell = { key: string; value: string } | null;
type FitColumnWidths = Readonly<Record<number, number>>;
type GridMode = "navigate" | "edit";
type HistoryMode = "push" | "skip";
type MoveDirection = "up" | "down" | "left" | "right";
interface EditingDraft {
  address: CellAddress;
  entry: "pointer" | "f2" | "replace";
  original: string;
  value: string;
}

interface SourceHistory {
  past: string[];
  future: string[];
}

interface FitMeasureEntry {
  id: string;
  colIndex: number;
  text: string;
  style: CSSProperties;
}

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
  const [computedValues, setComputedValues] = useState<ComputedCellValues>({});
  const [editingDraft, setEditingDraft] = useState<EditingDraft | null>(null);
  const [, setHistory] = useState<SourceHistory>({ past: [], future: [] });
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

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const nextValues = await evaluateEditorWorkbookSource(source, { parse: workbookOptions });
        if (!cancelled) {
          setComputedValues(nextValues);
        }
      } catch {
        if (!cancelled) {
          setComputedValues({});
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [source, workbookOptions]);

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
  const selectedContentText = useMemo(() => getCellContentText(selectedCell), [selectedCell]);
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

  const pushHistoryEntry = (previousSource: string) => {
    setHistory((current) => ({
      past: [...current.past, previousSource].slice(-maxHistoryEntries),
      future: []
    }));
  };

  const applySourceSnapshot = (nextSource: string, mode: HistoryMode = "skip") => {
    const nextDocument = createEditorDocument(nextSource, workbookOptions);
    editorDocumentRef.current = nextDocument;
    setEditorDocument(nextDocument);
    setEditingDraft(null);
    setCommandError(null);
    onSourceChange(nextSource);
    if (mode === "push") {
      pushHistoryEntry(editorDocument.source);
    }
  };

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

  const undo = () => {
    setHistory((current) => {
      const previous = current.past[current.past.length - 1];
      if (previous === undefined) {
        return current;
      }
      applySourceSnapshot(previous);
      setLiveMessage("Undo");
      return {
        past: current.past.slice(0, -1),
        future: [editorDocument.source, ...current.future].slice(0, maxHistoryEntries)
      };
    });
  };

  const redo = () => {
    setHistory((current) => {
      const next = current.future[0];
      if (next === undefined) {
        return current;
      }
      applySourceSnapshot(next);
      setLiveMessage("Redo");
      return {
        past: [...current.past, editorDocument.source].slice(-maxHistoryEntries),
        future: current.future.slice(1)
      };
    });
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
    if (gridMode === "edit") {
      if (event.key === "Escape") {
        event.preventDefault();
        cancelEditingDraft();
        return;
      }
      const editDirection = keyToDirection(event.key);
      if (editDirection) {
        if (editingDraft?.entry === "pointer" && (editDirection === "left" || editDirection === "right")) {
          return;
        }
        event.preventDefault();
        commitAndMove(editDirection);
        return;
      }
      if (event.key === "Enter") {
        if (event.shiftKey) {
          return;
        }
        event.preventDefault();
        commitAndMove("down");
        return;
      }
      if (event.key === "Tab") {
        event.preventDefault();
        commitAndMove(event.shiftKey ? "left" : "right");
      }
      return;
    }

    const isMeta = event.metaKey || event.ctrlKey;
    if (isMeta && event.key.toLowerCase() === "z" && !event.shiftKey) {
      event.preventDefault();
      undo();
      return;
    }
    if ((isMeta && event.shiftKey && event.key.toLowerCase() === "z") || (event.ctrlKey && event.key.toLowerCase() === "y")) {
      event.preventDefault();
      redo();
      return;
    }
    if (isMeta && event.key.toLowerCase() === "c") {
      event.preventDefault();
      copySelectedRange();
      return;
    }
    if (isMeta && event.key.toLowerCase() === "x") {
      event.preventDefault();
      cutSelectedRange();
      return;
    }
    if (isMeta && event.key.toLowerCase() === "v") {
      if (navigator.clipboard?.readText) {
        event.preventDefault();
        void navigator.clipboard.readText().then((text) => pasteTextAtSelection(text)).catch(() => undefined);
      }
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      cancelEditingDraft();
      return;
    }
    if (event.key === "F2") {
      event.preventDefault();
      enterEditMode(selected, "f2");
      return;
    }
    const direction = keyToDirection(event.key);
    if (direction) {
      event.preventDefault();
      moveActiveCell(direction, event.shiftKey);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      moveActiveCell("down", false);
      return;
    }
    if (event.key === "Backspace" || event.key === "Delete") {
      event.preventDefault();
      if (commit((current) => clearRange(current, selectedRange))) {
        setLiveMessage("Cleared selection");
      }
      return;
    }
    if (isPrintableKey(event)) {
      event.preventDefault();
      enterEditMode(selected, "replace", event.key);
    }
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

  return (
    <main className={["celloVisualEditorShell", className].filter(Boolean).join(" ")}>
      {diagnosticMessage ? (
        <div className="celloVisualCommandError" role="status">
          {diagnosticMessage}
        </div>
      ) : null}
      <section className="celloVisualToolbar" aria-label={labels.toolbar}>
        <div className="celloVisualToolbarRow celloVisualToolbarTopRow">
          <div className="celloVisualToolbarGroup celloVisualToolbarIdentity">
            <span className="celloVisualCellAddress">{selectedLabel}</span>
            <div className="celloVisualFormulaEditor">
              <div className="celloVisualFormulaHighlight" aria-hidden="true">
                {renderFormulaHighlight(selectedContentText)}
              </div>
              <textarea
                className={`celloVisualFormulaInput celloVisualFormulaArea ${selectedContentText.startsWith("=") ? "hasHighlight" : ""}`}
                aria-label={labels.selectedCellSource}
                rows={1}
                value={selectedContentText}
                onChange={(event) => handleContentChange(event.target.value)}
              />
            </div>
          </div>

          <label className="celloVisualModifiersPanel">
            <span>{labels.modifiers}</span>
            <input
              aria-label={labels.modifiers}
              value={selectedModifierText}
              placeholder={modifiersMixed ? "Mixed" : undefined}
              onChange={(event) => handleModifierSourceChange(event.target.value)}
            />
          </label>

          <div className="celloVisualInheritedPanel" aria-label={labels.inherited}>
            <span>{labels.inherited}</span>
            <div>
              {inheritedGroups.length > 0 ? inheritedGroups.map((group) => (
                <span key={group.scope} className={`celloVisualInheritedToken ${group.scope}`}>
                  {group.scope}: {group.modifiers.map(formatInheritedModifier).join("")}
                </span>
              )) : <span className="celloVisualInheritedEmpty">{labels.noInheritedModifiers}</span>}
            </div>
          </div>
        </div>

        <div className="celloVisualToolbarRow celloVisualToolbarFormatRow">
          <div className="celloVisualToolbarGroup celloVisualLabeledGroup">
            <span className="celloVisualGroupLabel">{labels.textGroup}</span>
            <button
              type="button"
              className={`celloVisualButton celloVisualIconButton ${hasScopedModifier(activeSheet, selected, modifierScope, "bold") ? "active" : ""}`}
              aria-label={labels.bold}
              title={labels.bold}
              disabled={controlsDisabled}
              onClick={() => handleToggleModifier("bold")}
            >
              <strong>B</strong>
            </button>
            <button
              type="button"
              className={`celloVisualButton celloVisualIconButton ${hasScopedModifier(activeSheet, selected, modifierScope, "italic") ? "active" : ""}`}
              aria-label={labels.italic}
              title={labels.italic}
              disabled={controlsDisabled}
              onClick={() => handleToggleModifier("italic")}
            >
              <em>I</em>
            </button>
            <button
              type="button"
              className={`celloVisualButton celloVisualIconButton ${hasScopedModifier(activeSheet, selected, modifierScope, "strike") ? "active" : ""}`}
              aria-label={labels.strike}
              title={labels.strike}
              disabled={controlsDisabled}
              onClick={() => handleToggleModifier("strike")}
              onDoubleClick={handleToggleInlineStrike}
            >
              <span className="celloVisualStrikeIcon">S</span>
            </button>
            {headingStyles.map((style) => (
              <IconTextButton key={style.labelKey} active={selectedHeadingPrefix === style.prefix} disabled={controlsDisabled} label={labels[style.labelKey]} onClick={() => handleApplyPrefix(style.prefix)} />
            ))}
            <label className="celloVisualColorTool" title={labels.textColor} aria-label={labels.textColor}>
              <span style={{ color: selectedTextColor }}>A</span>
              <input type="color" value={selectedTextColor} disabled={controlsDisabled} onChange={(event) => handleSetColor("color", event.target.value)} />
            </label>
            <label className="celloVisualColorTool" title={labels.fillColor} aria-label={labels.fillColor} style={{ background: selectedFillColor }}>
              <EditorIcon name="paint" />
              <input type="color" value={selectedFillColor} disabled={controlsDisabled} onChange={(event) => handleSetColor("bg", event.target.value)} />
            </label>
            <ValueMenu
              ariaLabel={labels.tone}
              buttonClassName={selectedTone ? `celloVisualTone celloVisualTone-${selectedTone}` : ""}
              displayValue={selectedTone ? `${labels.tone}: ${selectedTone}` : labels.tone}
              disabled={controlsDisabled}
              options={TEXT_TONES.map((tone) => ({ label: tone, value: tone, className: `celloVisualTone celloVisualTone-${tone}` }))}
              value={selectedTone}
              onChange={(value) => handleSetTone(value as TextTone)}
            />
          </div>

          <div className="celloVisualToolbarGroup celloVisualLabeledGroup">
            <span className="celloVisualGroupLabel">{labels.tableGroup}</span>
            <ValueMenu
              ariaLabel={labels.columnsMode}
              displayValue={`Col: ${formatLayoutValue(activeSheet.layout?.columns ?? "normal")}`}
              options={SHEET_COLUMNS_MODES.map((mode) => ({ label: mode === "normal" ? labels.columnsNormal : labels.columnsFit, value: mode }))}
              value={activeSheet.layout?.columns ?? "normal"}
              disabled={controlsDisabled}
              onChange={(value) => commit((current) => setSheetColumnsMode(current, activeSheetIndex, value === "normal" ? undefined : value as "fit"))}
            />
            <ValueMenu
              ariaLabel={labels.rowsMode}
              displayValue={`Row: ${formatLayoutValue(activeSheet.layout?.rows ?? "wrap")}`}
              options={SHEET_ROWS_MODES.map((mode) => ({ label: mode === "ellipsis" ? labels.rowsEllipsis : labels.rowsWrap, value: mode }))}
              value={activeSheet.layout?.rows ?? "wrap"}
              disabled={controlsDisabled}
              onChange={(value) => commit((current) => setSheetRowsMode(current, activeSheetIndex, value === "wrap" ? undefined : value as "ellipsis"))}
            />
            <IconButton label={labels.mergeLeft} icon="mergeLeft" disabled={controlsDisabled} onClick={() => commit((current) => mergeCell(current, selected, "left"))} />
            <IconButton label={labels.mergeUp} icon="mergeUp" disabled={controlsDisabled} onClick={() => commit((current) => mergeCell(current, selected, "up"))} />
            <IconButton label={labels.newRow} icon="row" onClick={() => commit((current) => addRow(current, activeSheetIndex, visibleRowCount === 0 ? undefined : selected.rowIndex))} />
            <IconButton label={labels.newColumn} icon="column" disabled={visibleRowCount === 0} onClick={() => commit((current) => addColumn(current, activeSheetIndex, selected.colIndex))} />
          </div>

          <div className="celloVisualToolbarGroup celloVisualLabeledGroup">
            <span className="celloVisualGroupLabel">{labels.selectedColumn}</span>
            <button
              type="button"
              className={`celloVisualButton ${selectedColumnResolvedFit ? "active" : ""}`}
              aria-label={labels.fit}
              disabled={controlsDisabled}
              onClick={() => withHeaderColumn((current, headerRowIndex) => toggleColumnFit(current, activeSheetIndex, headerRowIndex, selected.colIndex))}
            >
              {labels.fit}
            </button>
            <ValueMenu
              ariaLabel={labels.width}
              displayValue={selectedWidthDisplay}
              customPlaceholder={labels.width}
              options={WIDTH_PRESET_NAMES.map((value) => ({ label: value, value }))}
              value={selectedColumnWidth}
              disabled={controlsDisabled}
              onChange={(value) => withHeaderColumn((current, headerRowIndex) => setColumnWidth(current, activeSheetIndex, headerRowIndex, selected.colIndex, value.trim() || undefined))}
            />
          </div>

          <div className="celloVisualToolbarGroup celloVisualLabeledGroup">
            <span className="celloVisualGroupLabel">{labels.selectedRow}</span>
            <button
              type="button"
              className={`celloVisualButton ${selectedRowWrap ? "active" : ""}`}
              aria-label={labels.wrap}
              disabled={controlsDisabled}
              onClick={() => commit((current) => toggleRowWrap(current, selected))}
            >
              {labels.wrap}
            </button>
            <ValueMenu
              ariaLabel={labels.height}
              displayValue={selectedRowHeight || defaultRowHeightPlaceholder}
              customPlaceholder={labels.height}
              options={ROW_HEIGHT_PRESETS.map((value) => ({ label: value, value }))}
              value={selectedRowHeight}
              disabled={controlsDisabled}
              onChange={(value) => commit((current) => setRowHeight(current, selected, value.trim() || undefined))}
            />
          </div>

          {onRequestSourceView ? (
            <button type="button" className="celloVisualButton celloVisualIconTextButton celloVisualSourceButton" aria-label={labels.source} disabled={controlsDisabled} onClick={onRequestSourceView}>
              <EditorIcon name="format" />
              <span>{labels.source}</span>
            </button>
          ) : null}
        </div>

        <div className="celloVisualSheetTabs" role="tablist" aria-label={labels.workbookSheets}>
          {workbook.sheets.map((sheet, sheetIndex) => (
            <button
              key={`${sheet.name}-${sheetIndex}`}
              type="button"
              role="tab"
              aria-selected={activeSheetIndex === sheetIndex}
              className={activeSheetIndex === sheetIndex ? "active" : ""}
              onClick={() => {
                const nextSelected = { sheetIndex, rowIndex: 0, colIndex: 0 };
                setActiveSheetIndex(sheetIndex);
                setSelection(createCellSelection(nextSelected));
                setEditingDraft(null);
                onActiveSheetChange?.(sheet.name);
              }}
            >
              {sheet.name}
            </button>
          ))}
          <IconButton label={labels.newSheet} icon="sheetPlus" className="celloVisualPrimaryAction" onClick={handleAddSheet} />
          <input
            className="celloVisualSheetNameInput"
            aria-label={labels.renameSheet}
            value={activeSheet.name}
            onChange={(event) => commit((current) => renameSheet(current, activeSheetIndex, event.target.value))}
          />
          <IconButton label={labels.deleteSheet} icon="trash" disabled={workbook.sheets.length <= 1} onClick={handleRemoveSheet} />
        </div>
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

function VisualConfigurationScaffold({
  columnCount,
  labels,
  onDefaultCommit,
  onHeaderCommit
}: {
  columnCount: number;
  labels: CelloVisualEditorLabels;
  onDefaultCommit: (colIndex: number, value: string) => void;
  onHeaderCommit: (colIndex: number, value: string) => void;
}) {
  return (
    <>
      <tr className="celloVisualHeaderRow celloVisualConfigurationScaffold">
        <th className="celloVisualRowHeader">
          <span className="celloVisualHeaderBadge">{labels.headerRow}</span>
        </th>
        {Array.from({ length: columnCount }, (_, colIndex) => (
          <td key={colIndex}>
            <input
              aria-label={`Header ${getColumnName(colIndex)}`}
              defaultValue=""
              onBlur={(event) => onHeaderCommit(colIndex, event.currentTarget.value)}
              onKeyDown={blurOnEnter}
            />
          </td>
        ))}
      </tr>
      <tr className="celloVisualDefaultsRow celloVisualConfigurationScaffold">
        <th className="celloVisualRowHeader">
          <span className="celloVisualHeaderBadge">{labels.defaultsRow}</span>
        </th>
        {Array.from({ length: columnCount }, (_, colIndex) => (
          <td key={colIndex}>
            <input
              aria-label={`Defaults ${getColumnName(colIndex)}`}
              defaultValue=""
              onBlur={(event) => onDefaultCommit(colIndex, event.currentTarget.value)}
              onKeyDown={blurOnEnter}
            />
          </td>
        ))}
      </tr>
    </>
  );
}

function VisualDataRows({
  activeSheet,
  activeSheetIndex,
  aliases,
  computedValues,
  commit,
  commitEditingDraft,
  completedEditRef,
  draftCell,
  draggingSelectionRef,
  labels,
  measuredFitColumnWidths,
  modifierScope,
  rowIndex,
  selectionKind,
  selectCell,
  selectRow,
  selectDefaultCell,
  setEditingDraft,
  selected,
  selectedRange,
  selectedDefaultCol,
  gridMode,
  handleGridKeyDown,
  enterEditMode,
  visibleColumnCount
}: {
  activeSheet: EditorSheet;
  activeSheetIndex: number;
  aliases: EditorWorkbook["aliases"];
  computedValues: ComputedCellValues;
  commit: (update: (current: EditorWorkbook) => EditorWorkbook) => boolean;
  commitEditingDraft: () => boolean;
  completedEditRef: RefObject<string | null>;
  draftCell: DraftCell;
  draggingSelectionRef: RefObject<boolean>;
  labels: CelloVisualEditorLabels;
  measuredFitColumnWidths: FitColumnWidths;
  modifierScope: ModifierScope;
  rowIndex: number;
  selectionKind: SelectionKind;
  gridMode: GridMode;
  handleGridKeyDown: (event: ReactKeyboardEvent) => void;
  enterEditMode: (address: CellAddress, entry: EditingDraft["entry"], value?: string) => void;
  selectCell: (rowIndex: number, colIndex: number, extendRange?: boolean) => void;
  selectRow: (rowIndex: number, extendRange: boolean) => void;
  selectDefaultCell: (colIndex: number) => void;
  setEditingDraft: Dispatch<SetStateAction<EditingDraft | null>>;
  selected: CellAddress;
  selectedRange: CellRange;
  selectedDefaultCol: number | null;
  visibleColumnCount: number;
}) {
  const rows = [
    <tr key={rowIndex} role="row" aria-rowindex={rowIndex + 1} className={activeSheet.rows[rowIndex]?.kind === "header" ? "celloVisualHeaderRow" : undefined}>
      <th
        role="rowheader"
        aria-rowindex={rowIndex + 1}
        aria-selected={modifierScope === "row" && rowIndex >= selectedRange.startRow && rowIndex <= selectedRange.endRow}
        className={[
          "celloVisualRowHeader",
          modifierScope === "row" && rowIndex >= selectedRange.startRow && rowIndex <= selectedRange.endRow ? "selectedHeader" : "",
          modifierScope !== "column" && selected.rowIndex === rowIndex ? "activeHeader" : "",
          modifierScope === "row" && selectedDefaultCol === null && selected.rowIndex === rowIndex ? "selectedRow" : ""
        ].filter(Boolean).join(" ")}
        onClick={(event) => selectRow(rowIndex, event.shiftKey)}
      >
        <span>{rowIndex + 1}</span>
        {activeSheet.rows[rowIndex]?.kind === "header" ? <span className="celloVisualHeaderBadge">{labels.headerRow}</span> : null}
      </th>
      {Array.from({ length: visibleColumnCount }, (_, colIndex) => {
        const span = getVisualCellSpan(activeSheet, rowIndex, colIndex);
        if (span.hidden) {
          return null;
        }
        const cell = getCellAt(activeSheet, rowIndex, colIndex);
        const isSelected = selected.sheetIndex === activeSheetIndex && selectedDefaultCol === null && selected.rowIndex === rowIndex && selected.colIndex === colIndex;
        const address = { sheetIndex: activeSheetIndex, rowIndex, colIndex };
        const isInRange = isAddressInRange(address, selectedRange);
        const cellKey = getCellAddressKey({ sheetIndex: activeSheetIndex, rowIndex, colIndex });
        const workbookContext = aliases ? { aliases } : {};
        const toneClass = getCellToneClass(activeSheet, rowIndex, colIndex, workbookContext);
        const isEditing = draftCell?.key === cellKey;
        const computed = computedValues[cellKey];
        const displayValue = getCellFormattedDisplayText(activeSheet, rowIndex, colIndex, computed, workbookContext);
        const inputValue = draftCell?.key === cellKey ? draftCell.value : getCellContentText(cell);
        const cellStyle = withMeasuredFitWidth(getVisualCellStyle(workbookContext, activeSheet, rowIndex, colIndex), measuredFitColumnWidths[colIndex]);
        const contentStyle = getVisualCellContentStyle(workbookContext, activeSheet, rowIndex);
        const editorStyle = getVisualCellStyle(workbookContext, activeSheet, rowIndex, colIndex);
        delete editorStyle.width;
        delete editorStyle.minWidth;
        delete editorStyle.maxWidth;
        const shouldHighlightFormula = inputValue.startsWith("=") && isEditing;
        return (
          <td
            key={colIndex}
            role="gridcell"
            id={getGridCellId(address)}
            aria-label={`${getColumnName(colIndex)}${rowIndex + 1}`}
            aria-colindex={colIndex + 1}
            aria-rowindex={rowIndex + 1}
            aria-selected={isInRange}
            data-cell-address={cellKey}
            className={[
              isSelected ? "selected activeCell" : "",
              isInRange && !isSelected ? "rangeSelected" : "",
              isInRange && rowIndex === selectedRange.startRow ? "rangeTop" : "",
              isInRange && rowIndex + span.rowspan - 1 === selectedRange.endRow ? "rangeBottom" : "",
              isInRange && colIndex === selectedRange.startCol ? "rangeLeft" : "",
              isInRange && colIndex + span.colspan - 1 === selectedRange.endCol ? "rangeRight" : "",
              selectionKind === "cells" && selected.rowIndex === rowIndex ? "activeRowGuide" : "",
              selectionKind === "cells" && selected.colIndex === colIndex ? "activeColumnGuide" : "",
              toneClass ? "celloVisualTone" : "",
              toneClass,
              span.colspan > 1 || span.rowspan > 1 ? "merged" : ""
            ].filter(Boolean).join(" ")}
            style={cellStyle}
            colSpan={span.colspan}
            rowSpan={span.rowspan}
            onMouseDown={(event) => {
              if (event.target instanceof HTMLTextAreaElement) {
                if (!isEditing && event.detail < 2) {
                  event.preventDefault();
                }
                return;
              }
              event.preventDefault();
              draggingSelectionRef.current = true;
              selectCell(rowIndex, colIndex, event.shiftKey);
            }}
            onMouseEnter={() => {
              if (draggingSelectionRef.current) {
                selectCell(rowIndex, colIndex, true);
              }
            }}
            onClick={(event) => {
              if (!(event.target instanceof HTMLTextAreaElement)) {
                selectCell(rowIndex, colIndex, event.shiftKey);
              }
            }}
            onDoubleClick={() => enterEditMode(address, "pointer")}
          >
            <div
              className={[
                "celloVisualCellEditor",
                shouldHighlightFormula ? "hasFormulaHighlight" : "",
                isSelected && !isEditing ? "hasDisplayOverlay" : ""
              ].filter(Boolean).join(" ")}
              style={contentStyle}
            >
              {!isEditing ? (
                <div className="celloVisualCellDisplay" style={{ ...editorStyle, ...contentStyle }} aria-hidden="true">
                  {renderInlineDisplay(displayValue)}
                </div>
              ) : null}
              {shouldHighlightFormula ? (
                <div className="celloVisualCellFormulaHighlight" aria-hidden="true">
                  {renderFormulaHighlight(inputValue)}
                </div>
              ) : null}
              {isEditing || isSelected ? <textarea
                aria-label={`${getColumnName(colIndex)}${rowIndex + 1}`}
                value={inputValue}
                style={{ ...editorStyle, ...contentStyle }}
                rows={1}
                readOnly={!isEditing}
                tabIndex={isEditing ? 0 : -1}
                onKeyDown={(event) => {
                  event.stopPropagation();
                  handleGridKeyDown(event);
                }}
                onPaste={(event) => {
                  if (isEditing) {
                    event.stopPropagation();
                  }
                }}
                onBlur={() => {
                  if (
                    gridMode === "edit" &&
                    isEditing &&
                    completedEditRef.current !== cellKey
                  ) {
                    commitEditingDraft();
                  }
                }}
                onChange={(event) => {
                  setEditingDraft((current) => current && getCellAddressKey(current.address) === cellKey
                    ? { ...current, value: event.target.value }
                    : current);
                }}
              /> : null}
            </div>
          </td>
        );
      })}
    </tr>
  ];

  if (activeSheet.rows[rowIndex]?.kind === "header") {
    rows.push(
      <tr key={`${rowIndex}-defaults`} className="celloVisualDefaultsRow">
        <th className="celloVisualRowHeader">
          <span className="celloVisualHeaderBadge">{labels.defaultsRow}</span>
        </th>
        {Array.from({ length: visibleColumnCount }, (_, colIndex) => {
          const cell = getDefaultCellAt(activeSheet, colIndex);
          const isSelected = selectedDefaultCol === colIndex;
          return (
            <td key={colIndex} className={isSelected ? "selected" : undefined}>
              <input
                aria-label={`Defaults ${getColumnName(colIndex)}`}
                value={getCellSourceText(cell)}
                onFocus={() => selectDefaultCell(colIndex)}
                onChange={(event) => {
                  selectDefaultCell(colIndex);
                  commit((current) => updateDefaultCellSource(current, activeSheetIndex, colIndex, event.target.value));
                }}
              />
            </td>
          );
        })}
      </tr>
    );
  }

  return <>{rows}</>;
}

function blurOnEnter(event: ReactKeyboardEvent<HTMLInputElement>): void {
  event.stopPropagation();
  if (event.key === "Enter") {
    event.preventDefault();
    event.currentTarget.blur();
  }
}

function IconButton({
  className,
  disabled,
  icon,
  label,
  onClick
}: {
  className?: string;
  disabled?: boolean;
  icon: Parameters<typeof EditorIcon>[0]["name"];
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={["celloVisualButton", "celloVisualIconButton", className].filter(Boolean).join(" ")}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      <EditorIcon name={icon} />
    </button>
  );
}

function IconTextButton({ active, disabled, label, onClick }: { active?: boolean; disabled?: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" className={["celloVisualButton", "celloVisualTextStyleButton", active ? "active" : ""].filter(Boolean).join(" ")} aria-label={label} title={label} disabled={disabled} onClick={onClick}>
      {label}
    </button>
  );
}

function ValueMenu({
  ariaLabel,
  buttonClassName,
  customPlaceholder,
  disabled,
  displayValue,
  options,
  value,
  onChange
}: {
  ariaLabel: string;
  buttonClassName?: string;
  customPlaceholder?: string;
  disabled?: boolean;
  displayValue: string;
  options: Array<{ label: string; value: string; className?: string }>;
  value: string | undefined;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [customValue, setCustomValue] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const closeMenu = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", closeMenu);
    return () => document.removeEventListener("mousedown", closeMenu);
  }, [open]);

  const commitCustom = () => {
    if (disabled) {
      return;
    }
    const nextValue = customValue.trim();
    if (nextValue) {
      onChange(nextValue);
      setCustomValue("");
      setOpen(false);
    }
  };

  return (
    <div className="celloVisualValueMenu" ref={ref}>
      <button
        type="button"
        className={["celloVisualButton", buttonClassName].filter(Boolean).join(" ")}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        {displayValue}
      </button>
      {open ? (
        <div className="celloVisualValueOptions" role="menu">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={value === option.value}
              className={[option.className, value === option.value ? "active" : ""].filter(Boolean).join(" ")}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
          {customPlaceholder ? (
            <input
              aria-label={customPlaceholder}
              value={customValue}
              placeholder={customPlaceholder}
              onChange={(event) => setCustomValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  commitCustom();
                }
              }}
              onBlur={commitCustom}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function useMeasuredFitColumnWidths(measureRef: RefObject<HTMLDivElement | null>, entries: FitMeasureEntry[]): FitColumnWidths {
  const [widths, setWidths] = useState<FitColumnWidths>({});

  useLayoutEffect(() => {
    const measureRoot = measureRef.current;
    if (!measureRoot || entries.length === 0) {
      setWidths((current) => (Object.keys(current).length === 0 ? current : {}));
      return;
    }

    const next: Record<number, number> = {};
    for (const element of measureRoot.querySelectorAll<HTMLElement>("[data-cello-fit-column]")) {
      const column = Number(element.dataset.celloFitColumn);
      if (!Number.isInteger(column)) {
        continue;
      }
      const measuredTextWidth = Math.ceil(element.getBoundingClientRect().width);
      const measuredWidth = measuredTextWidth + CELL_LAYOUT_METRICS.paddingInlinePx * 2 + fitColumnMeasurementGuardPx;
      if (measuredWidth <= 0) {
        continue;
      }
      next[column] = Math.max(next[column] ?? 0, measuredWidth, CELL_LAYOUT_METRICS.paddingInlinePx * 2);
    }

    setWidths((current) => (areFitWidthsEqual(current, next) ? current : next));
  }, [entries, measureRef]);

  return widths;
}

function getFitMeasureEntries(
  workbook: Pick<EditorWorkbook, "aliases">,
  sheet: EditorSheet,
  sheetIndex: number,
  columnModifierRowIndex: number,
  visibleColumnCount: number,
  computedValues: ComputedCellValues
): FitMeasureEntry[] {
  const entries: FitMeasureEntry[] = [];
  for (let colIndex = 0; colIndex < visibleColumnCount; colIndex += 1) {
    if (!isResolvedFitColumn(sheet, columnModifierRowIndex, colIndex)) {
      continue;
    }

    for (let rowIndex = 0; rowIndex < sheet.rows.length; rowIndex += 1) {
      const cell = sheet.rows[rowIndex]?.cells[colIndex];
      if (!cell) {
        continue;
      }
      const cellKey = getCellAddressKey({ sheetIndex, rowIndex, colIndex });
      const computed = computedValues[cellKey];
      const text = getCellFitMeasureText(sheet, rowIndex, colIndex, computed, workbook);
      if (text === undefined) {
        continue;
      }
      entries.push({
        id: cellKey,
        colIndex,
        text,
        style: getCellStyle(sheet, rowIndex, colIndex, workbook)
      });
    }
  }
  return entries;
}

function isResolvedFitColumn(sheet: EditorSheet, rowIndex: number, colIndex: number): boolean {
  const explicitWidth = getColumnWidthValue(sheet, rowIndex, colIndex);
  return isColumnFit(sheet, rowIndex, colIndex) || (!explicitWidth && sheet.layout?.columns === "fit");
}

function withMeasuredFitWidth(style: CSSProperties, measuredWidth: number | undefined): CSSProperties {
  if (measuredWidth === undefined) {
    return style;
  }
  const width = `${measuredWidth}px`;
  return { ...style, width, minWidth: width, maxWidth: width };
}

function areFitWidthsEqual(current: FitColumnWidths, next: FitColumnWidths): boolean {
  const currentKeys = Object.keys(current);
  const nextKeys = Object.keys(next);
  return currentKeys.length === nextKeys.length && nextKeys.every((key) => current[Number(key)] === next[Number(key)]);
}

function formatLayoutValue(value: string): string {
  return value[0]?.toUpperCase() + value.slice(1);
}

function formatMeasuredWidth(width: number | undefined): string | undefined {
  return width === undefined ? undefined : `${width}px`;
}

function formatInheritedModifier(modifier: { key: string; raw: string; value?: string }): string {
  return modifier.key === "default" && modifier.value ? `[${modifier.value}]` : `[${modifier.raw}]`;
}

function getSelectionModifierSources(sheet: EditorSheet, range: CellRange, scope: ModifierScope): string[] {
  if (scope === "row") {
    return Array.from({ length: range.endRow - range.startRow + 1 }, (_, offset) =>
      formatModifierSource(sheet.rows[range.startRow + offset]?.modifiers ?? [])
    );
  }
  if (scope === "column") {
    const header = sheet.rows.find((row) => row.kind === "header");
    return Array.from({ length: range.endCol - range.startCol + 1 }, (_, offset) =>
      formatModifierSource(header?.cells[range.startCol + offset]?.modifiers ?? [])
    );
  }
  return getRangeAddresses(range).map((address) =>
    getCellModifierSourceText(getCellAt(sheet, address.rowIndex, address.colIndex))
  );
}

function formatModifierSource(modifiers: Array<{ raw: string }>): string {
  return modifiers.map((modifier) => `[${modifier.raw}]`).join("");
}

function getCommonValue(values: string[]): string | undefined {
  const first = values[0];
  return first !== undefined && values.every((value) => value === first) ? first : undefined;
}

function scrollSelectionNearEdge(container: HTMLElement, clientX: number, clientY: number): void {
  const bounds = container.getBoundingClientRect();
  const threshold = 28;
  const step = 18;
  if (clientX < bounds.left + threshold) {
    container.scrollLeft -= step;
  } else if (clientX > bounds.right - threshold) {
    container.scrollLeft += step;
  }
  if (clientY < bounds.top + threshold) {
    container.scrollTop -= step;
  } else if (clientY > bounds.bottom - threshold) {
    container.scrollTop += step;
  }
}

function getGridCellId(address: CellAddress): string {
  return `cello-grid-cell-${address.sheetIndex}-${address.rowIndex}-${address.colIndex}`;
}

function clampAddress(address: CellAddress, workbook: EditorWorkbook): CellAddress {
  const sheetIndex = Math.max(0, Math.min(address.sheetIndex, workbook.sheets.length - 1));
  const sheet = workbook.sheets[sheetIndex];
  const rowCount = getVisibleRowCount(sheet);
  const columnCount = getVisibleColumnCount(sheet);
  return {
    sheetIndex,
    rowIndex: Math.max(0, Math.min(address.rowIndex, Math.max(0, rowCount - 1))),
    colIndex: Math.max(0, Math.min(address.colIndex, Math.max(0, columnCount - 1)))
  };
}

function moveAddress(address: CellAddress, direction: MoveDirection): CellAddress {
  if (direction === "up") {
    return { ...address, rowIndex: address.rowIndex - 1 };
  }
  if (direction === "down") {
    return { ...address, rowIndex: address.rowIndex + 1 };
  }
  if (direction === "left") {
    return { ...address, colIndex: address.colIndex - 1 };
  }
  return { ...address, colIndex: address.colIndex + 1 };
}

function keyToDirection(key: string): MoveDirection | undefined {
  if (key === "ArrowUp") {
    return "up";
  }
  if (key === "ArrowDown") {
    return "down";
  }
  if (key === "ArrowLeft") {
    return "left";
  }
  if (key === "ArrowRight") {
    return "right";
  }
  return undefined;
}

function isPrintableKey(event: ReactKeyboardEvent): boolean {
  return event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey;
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

function renderFormulaHighlight(source: string) {
  if (!source.startsWith("=")) {
    return source;
  }
  return tokenizeFormula(source).map((token, index) => <span key={`${token.text}-${index}`} className={`formula-${token.kind}`}>{token.text}</span>);
}

function renderInlineDisplay(source: string): ReactNode {
  const nodes: ReactNode[] = [];
  const pattern = /(\*([^*]+)\*)|(_([^_]+)_)|(~~([^~]+)~~)/g;
  let cursor = 0;
  for (const match of source.matchAll(pattern)) {
    if (match.index === undefined) {
      continue;
    }
    if (match.index > cursor) {
      nodes.push(source.slice(cursor, match.index));
    }
    const text = match[2] ?? match[4] ?? match[6] ?? "";
    const style = match[2] ? { fontWeight: 700 } : match[4] ? { fontStyle: "italic" } : { textDecoration: "line-through" };
    nodes.push(<span key={`${match.index}-${text}`} style={style}>{text}</span>);
    cursor = match.index + match[0].length;
  }
  if (cursor < source.length) {
    nodes.push(source.slice(cursor));
  }
  return nodes.length > 0 ? nodes : source;
}

function tokenizeFormula(source: string): Array<{ kind: string; text: string }> {
  const tokens: Array<{ kind: string; text: string }> = [];
  for (const match of source.matchAll(formulaTokenPattern)) {
    const text = match[0];
    const kind = match[4] ? "equals" : match[1] ? "sheet" : match[2] ? "range" : match[3] ? "operator" : match[5] ? "column" : "plain";
    tokens.push({ kind, text });
  }
  return tokens;
}
