import { startTransition, useEffect, useLayoutEffect, useMemo, useRef, useState, type ClipboardEvent as ReactClipboardEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  composeCellSource,
  createEditorDocument,
  DEFAULT_SHEET_NAME,
  executeEditorCommand,
  getCellAddressKey,
  getCellAt,
  getCellContentText,
  getCellHeadingPrefix,
  getCellModifierSourceText,
  getCellSourceText,
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
  hasEditorVerticalMerges,
  projectEditorSheetView,
  parseClipboardMatrix,
} from "@nachoggodino/cello/editor-core";
import type {
  CellAddress,
  ColorModifierKey,
  CreateEditorWorkbookOptions,
  EditorCommandResult,
  EditorCommandTarget,
  EditorDocument,
  EditorDocumentCommand,
  EditorSheet,
  EditorWorkbook,
  SheetTableViewState,
  TextTone,
  ToggleModifierKey,
  ViewColumnRule
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
import { ColumnViewButton, TableViewBar } from "./components/tableViews.js";
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
import { useEditorSession } from "./useEditorSession.js";
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
  getSelectionRange,
  isPasteCompatibleWithMergedCells,
  rangeContainsMergedCells,
  resolveModifierScope,
  shiftSelectionRows
} from "./selection.js";
import type { GridSelection } from "./selection.js";
import { defaultLabels } from "./labels.js";
import type {
  CelloVisualEditorProps,
  ControlledCelloVisualEditorProps,
  SessionCelloVisualEditorProps
} from "./types.js";

export type {
  CelloVisualEditorLabels,
  CelloVisualEditorProps,
  ControlledCelloVisualEditorProps,
  SessionCelloVisualEditorProps
} from "./types.js";

const defaultTextColor = "#1f1e1b";
const defaultFillColor = "#fffaf4";
const defaultColumnWidthPlaceholder = "normal";
const fallbackSheet: EditorSheet = { name: DEFAULT_SHEET_NAME, format: { kind: "cello" }, layout: {}, rows: [], defaults: [], views: [] };
const inlineStrikeMarker = "~~";

type GridMode = "navigate" | "edit";
type HistoryMode = "push" | "skip";

interface VisualHistoryController {
  undo: () => void;
  redo: () => void;
}

interface InternalCelloVisualEditorProps extends ControlledCelloVisualEditorProps {
  document?: EditorDocument;
  executeCommand?: (command: EditorDocumentCommand) => EditorCommandResult;
  historyController?: VisualHistoryController;
  tableViewState?: SheetTableViewState;
  onTableViewStateChange?: (state: SheetTableViewState) => void;
}

const ignoreSourceChange = () => undefined;

export function CelloVisualEditor(props: CelloVisualEditorProps) {
  return props.session
    ? <SessionCelloVisualEditor {...props} />
    : <ControlledCelloVisualEditor {...props} />;
}

function SessionCelloVisualEditor({
  session,
  baseDir,
  className,
  labels,
  onActiveSheetChange,
  onRequestSourceView,
  onCommandFailure,
  onDiagnosticsChange,
  readExternalSource,
  strict
}: SessionCelloVisualEditorProps) {
  const snapshot = useEditorSession(session);
  const sessionOptions = session.getDocumentOptions();
  return (
    <ControlledCelloVisualEditor
      source={snapshot.source}
      onSourceChange={ignoreSourceChange}
      document={snapshot.document}
      executeCommand={(command) => session.execute(command)}
      activeSheetName={snapshot.activeSheetName}
      onActiveSheetChange={(sheetName) => {
        session.setActiveSheetName(sheetName);
        onActiveSheetChange?.(sheetName);
      }}
      sourceLayout={snapshot.sourceLayout}
      historyController={{
        undo: () => {
          session.undo("visual");
        },
        redo: () => {
          session.redo("visual");
        }
      }}
      tableViewState={snapshot.tableViews[snapshot.activeSheetName] ?? { enabled: false, columns: [] }}
      onTableViewStateChange={(state) => { session.setSheetTableViewState(snapshot.activeSheetName, state); }}
      {...(baseDir ?? sessionOptions.baseDir) === undefined
        ? {}
        : { baseDir: baseDir ?? sessionOptions.baseDir }}
      {...(className === undefined ? {} : { className })}
      {...(labels === undefined ? {} : { labels })}
      {...(onRequestSourceView === undefined ? {} : { onRequestSourceView })}
      {...(onCommandFailure === undefined ? {} : { onCommandFailure })}
      {...(onDiagnosticsChange === undefined ? {} : { onDiagnosticsChange })}
      {...(readExternalSource ?? sessionOptions.readExternalSource) === undefined
        ? {}
        : { readExternalSource: readExternalSource ?? sessionOptions.readExternalSource }}
      {...(strict ?? sessionOptions.strict) === undefined
        ? {}
        : { strict: strict ?? sessionOptions.strict }}
    />
  );
}

function ControlledCelloVisualEditor({
  source,
  onSourceChange,
  activeSheetName,
  baseDir,
  className,
  labels: labelOverrides,
  onActiveSheetChange,
  onRequestSourceView,
  onCommandFailure,
  onDiagnosticsChange,
  readExternalSource,
  sourceLayout,
  strict,
  document: providedDocument,
  executeCommand,
  historyController,
  tableViewState: providedTableViewState,
  onTableViewStateChange
}: InternalCelloVisualEditorProps) {
  const labels = useMemo(() => ({ ...defaultLabels, ...labelOverrides }), [labelOverrides]);
  const workbookOptions = useMemo<CreateEditorWorkbookOptions>(() => ({
    ...(baseDir === undefined ? {} : { baseDir }),
    ...(readExternalSource ? { readExternalSource } : {}),
    ...(sourceLayout ? { sourceLayout } : {}),
    ...(strict === undefined ? {} : { strict })
  }), [baseDir, readExternalSource, sourceLayout, strict]);
  const parseOptions = useMemo(() => ({
    ...(baseDir === undefined ? {} : { baseDir }),
    ...(readExternalSource ? { readExternalSource } : {}),
    ...(strict === undefined ? {} : { strict })
  }), [baseDir, readExternalSource, strict]);
  const [editorDocument, setEditorDocument] = useState(() =>
    providedDocument ?? createEditorDocument(source, workbookOptions));
  const editorDocumentRef = useRef(editorDocument);
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [selection, setSelection] = useState<GridSelection>(() => createCellSelection({ sheetIndex: 0, rowIndex: 0, colIndex: 0 }));
  const computedValues = useComputedValues(source, parseOptions);
  const [editingDraft, setEditingDraft] = useState<EditingDraft | null>(null);
  const [liveMessage, setLiveMessage] = useState("");
  const [commandError, setCommandError] = useState<string | null>(null);
  const [localTableViews, setLocalTableViews] = useState<Record<string, SheetTableViewState>>({});
  const gridRef = useRef<HTMLDivElement>(null);
  const draggingSelectionRef = useRef(false);
  const completedEditRef = useRef<string | null>(null);
  const pendingGridFocusRef = useRef(false);

  useEffect(() => {
    const nextDocument = providedDocument ?? createEditorDocument(source, workbookOptions);
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
  }, [activeSheetName, providedDocument, source, workbookOptions]);

  useEffect(() => {
    if (!commandError) {
      return;
    }
    const timeout = window.setTimeout(() => { setCommandError(null); }, 15000);
    return () => { window.clearTimeout(timeout); };
  }, [commandError]);

  useEffect(() => {
    const stopDragging = () => {
      draggingSelectionRef.current = false;
    };
    window.addEventListener("mouseup", stopDragging);
    return () => { window.removeEventListener("mouseup", stopDragging); };
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
  const diagnosticMessage = commandError ?? editorDocument.diagnostics[0]?.message ?? null;
  const fallbackTableViewState = getInitialTableViewState(activeSheet);
  const tableViewState = providedTableViewState ?? localTableViews[activeSheet.name] ?? fallbackTableViewState;
  const tableViewDisabled = hasEditorVerticalMerges(activeSheet);
  const tableViewEnabled = tableViewState.enabled && !tableViewDisabled;
  const tableProjection = tableViewEnabled
    ? projectEditorSheetView(activeSheet, activeSheetIndex, tableViewState.columns, computedValues, workbookContext)
    : { visibleRowIndices: Array.from({ length: visibleRowCount }, (_, index) => index), hiddenRowCount: 0 };
  const displayedRowIndices = tableProjection.visibleRowIndices;
  const selectedViewRowIndices = getSelectedViewRowIndices(selection, displayedRowIndices);
  const selectedViewRowSet = new Set(selectedViewRowIndices);
  const totalDataRows = activeSheet.rows.filter((row) => row.kind === "data").length;

  const updateTableViewState = (state: SheetTableViewState) => {
    if (state.enabled && !tableViewDisabled) {
      const nextProjection = projectEditorSheetView(activeSheet, activeSheetIndex, state.columns, computedValues, workbookContext);
      if (!nextProjection.visibleRowIndices.includes(selected.rowIndex) && nextProjection.visibleRowIndices.length > 0) {
        const rowIndex = nextProjection.visibleRowIndices.find((index) => activeSheet.rows[index]?.kind === "data")
          ?? nextProjection.visibleRowIndices[0]
          ?? 0;
        setSelection(createCellSelection({ ...selected, rowIndex }));
        setEditingDraft(null);
      }
    }
    if (onTableViewStateChange) onTableViewStateChange(state);
    else setLocalTableViews((current) => ({ ...current, [activeSheet.name]: state }));
  };

  const updateColumnViewRule = (colIndex: number, rule: ViewColumnRule) => {
    const columns = tableViewState.columns.map((candidate) => rule.sort
      ? withoutViewRuleKey(candidate, "sort")
      : { ...candidate });
    while (columns.length <= colIndex) columns.push({});
    columns[colIndex] = rule;
    updateTableViewState({ enabled: true, columns });
  };

  const selectSavedView = (name: string) => {
    const view = activeSheet.views.find((candidate) => candidate.name === name);
    updateTableViewState(view
      ? { enabled: true, columns: view.columns.map((rule) => ({ ...rule })), selectedSavedView: view.name }
      : { enabled: false, columns: tableViewState.columns.map((rule) => ({ ...rule })) });
  };

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
    const scrollIntoView: unknown = activeCell ? Reflect.get(activeCell, "scrollIntoView") : undefined;
    if (activeCell && typeof scrollIntoView === "function") {
      Reflect.apply(scrollIntoView, activeCell, [{ block: "nearest", inline: "nearest" }]);
    }
  }, [editingDraft, selected, selection.kind]);

  const applySourceSnapshot = (nextSource: string) => {
    const nextDocument = createEditorDocument(nextSource, workbookOptions);
    editorDocumentRef.current = nextDocument;
    setEditorDocument(nextDocument);
    setEditingDraft(null);
    setCommandError(null);
    onSourceChange(nextSource);
  };

  const localHistory = useSourceHistory(
    editorDocument.source,
    (nextSource) => { applySourceSnapshot(nextSource); },
    setLiveMessage
  );
  const undo = historyController?.undo ?? localHistory.undo;
  const redo = historyController?.redo ?? localHistory.redo;

  const runCommand = (
    command: EditorDocumentCommand,
    mode: HistoryMode = "push"
  ): EditorCommandResult => {
    const currentDocument = editorDocumentRef.current;
    const result = executeCommand
      ? executeCommand(command)
      : executeEditorCommand(currentDocument, command, workbookOptions);
    if (!result.ok) {
      setCommandError(result.message);
      onCommandFailure?.(result);
      return result;
    }
    setCommandError(null);
    if (mode === "push" && !historyController && result.source !== currentDocument.source) {
      localHistory.pushHistoryEntry(currentDocument.source);
    }
    editorDocumentRef.current = result.document;
    setEditorDocument(result.document);
    onSourceChange(result.source);
    return result;
  };

  const commit = (
    command: EditorDocumentCommand,
    mode: HistoryMode = "push"
  ): boolean => runCommand(command, mode).ok;

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
    const result = runCommand({ type: "add-sheet" });
    if (!result.ok) {
      return;
    }
    const nextSheetIndex = result.document.workbook.sheets.length - 1;
    const nextSelected = { sheetIndex: nextSheetIndex, rowIndex: 0, colIndex: 0 };
    setActiveSheetIndex(nextSheetIndex);
    setSelection(createCellSelection(nextSelected));
    setEditingDraft(null);
  };

  const handleRemoveSheet = () => {
    const result = runCommand({ type: "remove-sheet", sheetIndex: activeSheetIndex });
    if (!result.ok) {
      return;
    }
    const nextSheetIndex = Math.min(activeSheetIndex, result.document.workbook.sheets.length - 1);
    const nextSelected = { sheetIndex: nextSheetIndex, rowIndex: 0, colIndex: 0 };
    setActiveSheetIndex(nextSheetIndex);
    setSelection(createCellSelection(nextSelected));
    setEditingDraft(null);
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

  const getCommandTarget = (): EditorCommandTarget => {
    if (modifierScope === "cell") {
      return { scope: "cell", addresses: getViewRangeAddresses(selectedRange, selectedViewRowIndices) };
    }
    if (modifierScope === "row") {
      return {
        scope: "row",
        addresses: Array.from(
          selectedViewRowIndices,
          (rowIndex) => ({ ...selected, rowIndex })
        )
      };
    }
    return {
      scope: "column",
      sheetIndex: activeSheetIndex,
      colIndexes: Array.from(
        { length: selectedRange.endCol - selectedRange.startCol + 1 },
        (_, offset) => selectedRange.startCol + offset
      )
    };
  };

  const commitScopedCommand = (
    createCommand: (target: EditorCommandTarget) => EditorDocumentCommand
  ) => {
    if (selectedDefaultCol !== null) {
      return;
    }
    const addsHeader = modifierScope === "column" &&
      !activeSheet.rows.some((row) => row.kind === "header");
    if (commit(createCommand(getCommandTarget())) && addsHeader) {
      setSelection((currentSelection) => shiftSelectionRows(currentSelection, 1));
    }
  };

  const handleToggleModifier = (key: ToggleModifierKey) => {
    commitScopedCommand((target) => ({ type: "toggle-modifier", target, key }));
  };

  const handleSetColor = (key: ColorModifierKey, value: string) => {
    commitScopedCommand((target) => ({ type: "set-color", target, key, value }));
  };

  const handleSetTone = (value: TextTone) => {
    commitScopedCommand((target) => ({ type: "set-tone", target, value }));
  };

  const handleContentChange = (value: string) => {
    commit(selectedDefaultCol === null
      ? { type: "update-cell", address: selected, source: value, mode: "content" }
      : {
          type: "update-default",
          sheetIndex: activeSheetIndex,
          colIndex: selectedDefaultCol,
          source: composeCellSource(value, selectedModifierText)
        });
  };

  const handleModifierSourceChange = (value: string) => {
    if (selectedDefaultCol !== null) {
      commit({
        type: "update-default",
        sheetIndex: activeSheetIndex,
        colIndex: selectedDefaultCol,
        source: composeCellSource(selectedContentText, value)
      });
      return;
    }
    commitScopedCommand((target) => ({ type: "update-modifiers", target, source: value }));
  };

  const materializeHeaderCell = (colIndex: number, value: string) => {
    if (!value) {
      return;
    }
    const result = runCommand({ type: "update-header", sheetIndex: activeSheetIndex, colIndex, source: value });
    if (result.ok) {
      const headerRowIndex = result.document.workbook.sheets[activeSheetIndex]?.rows
        .findIndex((row) => row.kind === "header") ?? 0;
      const address = { sheetIndex: activeSheetIndex, rowIndex: Math.max(0, headerRowIndex), colIndex };
      setSelection(createCellSelection(address));
      setEditingDraft(null);
    }
  };

  const materializeDefaultCell = (colIndex: number, value: string) => {
    if (!value) {
      return;
    }
    const result = runCommand({
      type: "update-default",
      sheetIndex: activeSheetIndex,
      colIndex,
      source: value,
      ensureHeader: true
    });
    if (result.ok) {
      const headerRowIndex = result.document.workbook.sheets[activeSheetIndex]?.rows
        .findIndex((row) => row.kind === "header") ?? 0;
      const address = { sheetIndex: activeSheetIndex, rowIndex: Math.max(0, headerRowIndex), colIndex };
      setSelection({
        kind: "default",
        anchor: address,
        active: address
      });
    }
  };

  const handleApplyPrefix = (prefix: string) => {
    if (selectedDefaultCol === null) {
      commit({ type: "update-cell", address: selected, source: setHeadingPrefix(selectedContentText, prefix), mode: "raw" });
    }
  };

  const handleToggleInlineStrike = () => {
    if (selectedDefaultCol === null) {
      commit({ type: "update-cell", address: selected, source: toggleWrappedText(selectedContentText, inlineStrikeMarker), mode: "raw" });
    }
  };

  const commitHeaderColumn = (command: EditorDocumentCommand) => {
    const addsHeader = !activeSheet.rows.some((row) => row.kind === "header");
    if (commit(command) && addsHeader) {
      setSelection(createCellSelection({ ...selected, rowIndex: selected.rowIndex + 1 }));
    }
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
    return commit({ type: "update-cell", address: draft.address, source: draft.value, mode: "content" });
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
    const verticalPosition = displayedRowIndices.indexOf(owner.rowIndex);
    const verticalRowIndex = direction === "up" || direction === "down"
      ? displayedRowIndices[Math.max(0, Math.min(displayedRowIndices.length - 1, verticalPosition + (direction === "up" ? -1 : 1)))]
      : undefined;
    const adjacent = verticalRowIndex !== undefined
      ? { ...owner, rowIndex: verticalRowIndex }
      : direction === "right"
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
    const clipboard = navigator.clipboard as Clipboard | undefined;
    if (clipboard) {
      void clipboard.writeText(value).catch(() => undefined);
    }
  };

  const copySelectedRange = () => {
    const text = copyViewRangeAsTsv(workbook, selectedRange, selectedViewRowIndices);
    writeClipboardText(text);
    const size = { cells: selectedViewRowIndices.length * (selectedRange.endCol - selectedRange.startCol + 1) };
    setLiveMessage(`Copied ${size.cells} ${size.cells === 1 ? "cell" : "cells"}`);
    return text;
  };

  const cutSelectedRange = () => {
    copySelectedRange();
    if (clearVisibleSelection(true)) {
      const size = { cells: selectedViewRowIndices.length * (selectedRange.endCol - selectedRange.startCol + 1) };
      setLiveMessage(`Cut ${size.cells} ${size.cells === 1 ? "cell" : "cells"}`);
    }
  };

  const clearVisibleSelection = (includeModifiers: boolean): boolean => commit({
    type: "batch",
    commands: getViewRangeAddresses(selectedRange, selectedViewRowIndices).map((address) => ({
      type: "update-cell",
      address,
      source: "",
      mode: includeModifiers ? "source" : "raw"
    }))
  });

  const pasteTextAtSelection = (text: string) => {
    const matrix = parseClipboardMatrix(text);
    if (matrix.length === 0) {
      return;
    }
    const singleValue = matrix.length === 1 && matrix[0]?.length === 1 ? matrix[0][0] : undefined;
    const selectedCellCount = selectedViewRowIndices.length * (selectedRange.endCol - selectedRange.startCol + 1);
    const fillsSelectedRange = singleValue !== undefined && selectedCellCount > 1;
    if (
      !isPasteCompatibleWithMergedCells(activeSheet, selected, matrix) ||
      (fillsSelectedRange && rangeContainsMergedCells(activeSheet, selectedRange))
    ) {
      setCommandError("Paste would split or replace part of a merged cell. Paste a range with the same merge layout.");
      return;
    }
    const didCommit = tableViewEnabled
      ? commit(createVisiblePasteCommand(selected, selectedRange, selectedViewRowIndices, displayedRowIndices, matrix, singleValue))
      : fillsSelectedRange
        ? commit({ type: "fill-range", range: selectedRange, source: singleValue })
        : commit({ type: "paste-matrix", start: selected, matrix });
    if (didCommit) {
      const cellCount = matrix.reduce((total, row) => total + row.length, 0);
      setLiveMessage(`Pasted ${cellCount} ${cellCount === 1 ? "cell" : "cells"}`);
      if (singleValue === undefined || selectedCellCount === 1) {
        const rowCount = matrix.length;
        const columnCount = Math.max(0, ...matrix.map((row) => row.length));
        const startPosition = displayedRowIndices.indexOf(selected.rowIndex);
        const active = {
          sheetIndex: selected.sheetIndex,
          rowIndex: tableViewEnabled
            ? displayedRowIndices[Math.min(displayedRowIndices.length - 1, startPosition + Math.max(0, rowCount - 1))] ?? selected.rowIndex
            : selected.rowIndex + Math.max(0, rowCount - 1),
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
          if (clearVisibleSelection(false)) {
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
      commit({
        type: "set-sheet-columns",
        sheetIndex: activeSheetIndex,
        ...(value === "normal" ? {} : { mode: value })
      }),
    setRowsMode: (value) =>
      commit({
        type: "set-sheet-rows",
        sheetIndex: activeSheetIndex,
        ...(value === "wrap" ? {} : { mode: value })
      }),
    mergeLeft: () =>
      commit({ type: "merge-cell", address: selected, direction: "left" }),
    mergeUp: () => commit({ type: "merge-cell", address: selected, direction: "up" }),
    addRow: () =>
      commit({
        type: "add-row",
        sheetIndex: activeSheetIndex,
        ...(visibleRowCount === 0 ? {} : { afterRowIndex: selected.rowIndex })
      }),
    addColumn: () =>
      commit({
        type: "add-column",
        sheetIndex: activeSheetIndex,
        afterColIndex: selected.colIndex
      }),
    toggleColumnFit: () =>
      { commitHeaderColumn({
        type: "toggle-column-fit",
        sheetIndex: activeSheetIndex,
        colIndex: selected.colIndex
      }); },
    setColumnWidth: (value) =>
      { commitHeaderColumn({
        type: "set-column-width",
        sheetIndex: activeSheetIndex,
        colIndex: selected.colIndex,
        ...(value === undefined ? {} : { value })
      }); },
    toggleRowWrap: () =>
      commit({ type: "toggle-row-wrap", address: selected }),
    setRowHeight: (value) =>
      commit({
        type: "set-row-height",
        address: selected,
        ...(value === undefined ? {} : { value })
      }),
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
            commit({ type: "rename-sheet", sheetIndex: activeSheetIndex, name })
          }
        />
      </section>

      <section className="celloVisualWorkbook" aria-label={labels.workbook}>
        <TableViewBar
          disabled={tableViewDisabled}
          enabled={tableViewEnabled}
          hiddenRowCount={tableProjection.hiddenRowCount}
          labels={labels}
          {...(tableViewState.selectedSavedView === undefined ? {} : { selectedSavedView: tableViewState.selectedSavedView })}
          totalDataRows={totalDataRows}
          views={activeSheet.views}
          onClear={() => { updateTableViewState({ enabled: true, columns: [] }); }}
          onSelect={selectSavedView}
          onToggle={() => { updateTableViewState({ ...tableViewState, enabled: !tableViewState.enabled }); }}
        />
        <div
          ref={gridRef}
          className="celloVisualGridWrap"
          role="grid"
          tabIndex={0}
          aria-label={labels.workbook}
          aria-multiselectable="true"
          aria-activedescendant={selectedDefaultCol === null && visibleRowCount > 0 && visibleColumnCount > 0 ? getGridCellId(selected) : undefined}
          aria-rowcount={displayedRowIndices.length}
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
              <button type="button" className="celloVisualButton celloVisualPrimaryAction" onClick={() => commit({ type: "add-row", sheetIndex: activeSheetIndex })}>
                {labels.newRow}
              </button>
            </div>
          ) : <table className="celloVisualGrid">
            <thead>
              <tr role="row">
                <th
                  className={`celloVisualCorner ${selection.kind === "cells" && selectedViewRowIndices.length === displayedRowIndices.length && selectedRange.endCol - selectedRange.startCol + 1 === visibleColumnCount ? "selectedHeader" : ""}`}
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
                    onClick={(event) => { selectColumn(colIndex, event.shiftKey); }}
                  >
                    <span className="celloVisualColumnHeaderInner">
                      <span>{getColumnName(colIndex)}</span>
                      <ColumnViewButton
                        colIndex={colIndex}
                        columnLabel={getColumnName(colIndex)}
                        enabled={tableViewEnabled}
                        labels={labels}
                        rule={tableViewState.columns[colIndex]}
                        onChange={(rule) => { updateColumnViewRule(colIndex, rule); }}
                      />
                    </span>
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
              {displayedRowIndices.map((rowIndex) => (
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
                  selectedRowIndexes={selectedViewRowSet}
                  rangeStartRow={selectedViewRowIndices[0] ?? selectedRange.startRow}
                  rangeEndRow={selectedViewRowIndices.at(-1) ?? selectedRange.endRow}
                  selectedDefaultCol={selectedDefaultCol}
                  visibleColumnCount={visibleColumnCount}
                  commitCommand={commit}
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

function getInitialTableViewState(sheet: EditorSheet): SheetTableViewState {
  const view = sheet.views.find((candidate) => candidate.default);
  return view
    ? { enabled: true, columns: view.columns.map((rule) => ({ ...rule })), selectedSavedView: view.name }
    : { enabled: false, columns: [] };
}

function withoutViewRuleKey(rule: ViewColumnRule, key: keyof ViewColumnRule): ViewColumnRule {
  const next = { ...rule };
  Reflect.deleteProperty(next, key);
  return next;
}

function getSelectedViewRowIndices(selection: GridSelection, displayedRowIndices: readonly number[]): number[] {
  if (selection.kind === "columns") return [...displayedRowIndices];
  const anchor = displayedRowIndices.indexOf(selection.anchor.rowIndex);
  const active = displayedRowIndices.indexOf(selection.active.rowIndex);
  if (anchor < 0 || active < 0) return [selection.active.rowIndex];
  return displayedRowIndices.slice(Math.min(anchor, active), Math.max(anchor, active) + 1);
}

function getViewRangeAddresses(range: ReturnType<typeof getSelectionRange>, rowIndices: readonly number[]): CellAddress[] {
  return rowIndices.flatMap((rowIndex) => Array.from(
    { length: range.endCol - range.startCol + 1 },
    (_, offset) => ({ sheetIndex: range.sheetIndex, rowIndex, colIndex: range.startCol + offset })
  ));
}

function copyViewRangeAsTsv(
  workbook: EditorWorkbook,
  range: ReturnType<typeof getSelectionRange>,
  rowIndices: readonly number[]
): string {
  const sheet = workbook.sheets[range.sheetIndex];
  return rowIndices.map((rowIndex) => Array.from(
    { length: range.endCol - range.startCol + 1 },
    (_, offset) => getCellSourceText(getCellAt(sheet, rowIndex, range.startCol + offset))
      .replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\t/g, " ")
  ).join("\t")).join("\n");
}

function createVisiblePasteCommand(
  selected: CellAddress,
  range: ReturnType<typeof getSelectionRange>,
  selectedRows: readonly number[],
  displayedRows: readonly number[],
  matrix: string[][],
  singleValue: string | undefined
): EditorDocumentCommand {
  if (singleValue !== undefined && getCellRangeSize(range).cells > 1) {
    return {
      type: "batch",
      commands: getViewRangeAddresses(range, selectedRows).map((address) => ({
        type: "update-cell",
        address,
        source: singleValue,
        mode: "source"
      }))
    };
  }
  const startPosition = displayedRows.indexOf(selected.rowIndex);
  const commands: EditorDocumentCommand[] = [];
  for (const [rowOffset, values] of matrix.entries()) {
    const rowIndex = displayedRows[startPosition + rowOffset];
    if (rowIndex === undefined) break;
    for (const [colOffset, source] of values.entries()) {
      commands.push({
        type: "update-cell",
        address: { ...selected, rowIndex, colIndex: selected.colIndex + colOffset },
        source,
        mode: "source"
      });
    }
  }
  return { type: "batch", commands };
}
