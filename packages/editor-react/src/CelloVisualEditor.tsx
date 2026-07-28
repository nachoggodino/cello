import { startTransition, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import {
  addColumn,
  addRow,
  addSheet,
  applyWorkbookPatch,
  CELLO_HEADING_STYLES,
  CELL_LAYOUT_METRICS,
  composeCellSource,
  createEditorDocument,
  DEFAULT_SHEET_NAME,
  ROW_HEIGHT_PRESETS,
  SHEET_COLUMNS_MODES,
  SHEET_ROWS_MODES,
  WIDTH_PRESET_NAMES,
  ensureColumnHeaderRow,
  evaluateEditorWorkbookSource,
  getCellAddressKey,
  getCellAt,
  getCellFitMeasureText,
  getCellContentText,
  getCellFormattedDisplayText,
  getCellStyle,
  getCellSourceText,
  getCellHeadingPrefix,
  getCellModifierSourceText,
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
  isColumnFit,
  isRowWrap,
  mergeCell,
  removeSheet,
  renameSheet,
  setCellColorModifier,
  setCellToneModifier,
  setColumnWidth,
  setRowHeight,
  setRowColorModifier,
  setRowToneModifier,
  setSheetColumnsMode,
  setSheetRowsMode,
  toggleColumnFit,
  toggleCellModifier,
  toggleRowWrap,
  toggleRowModifier,
  updateCellRaw,
  updateCellSource,
  updateDefaultCellSource,
  TEXT_TONES
} from "@nachoggodino/cello/editor-core";
import type {
  CellAddress,
  ColorModifierKey,
  ComputedCellValues,
  CreateEditorWorkbookOptions,
  EditorCommandFailure,
  EditorDocument,
  EditorLayoutOptions,
  EditorSheet,
  EditorWorkbook,
  TextTone,
  ToggleModifierKey
} from "@nachoggodino/cello/editor-core";
import { EditorIcon } from "./icons.js";

export interface CelloVisualEditorLabels {
  bold: string;
  cellScope: string;
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
  layout?: EditorLayoutOptions;
  onActiveSheetChange?: (sheetName: string) => void;
  onRequestSourceView?: () => void;
  onCommandFailure?: (failure: EditorCommandFailure) => void;
  onDiagnosticsChange?: (diagnostics: EditorDocument["diagnostics"]) => void;
  readExternalSource?: CreateEditorWorkbookOptions["readExternalSource"];
}

const defaultLabels: CelloVisualEditorLabels = {
  bold: "Bold",
  cellScope: "cell",
  defaultsRow: "Defaults",
  deleteSheet: "Delete sheet",
  fillColor: "Fill color",
  h1: "H1",
  h2: "H2",
  h3: "H3",
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

type ModifierScope = "cell" | "row";
type DraftCell = { key: string; value: string } | null;
type FitColumnWidths = Readonly<Record<number, number>>;

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
  layout,
  onActiveSheetChange,
  onRequestSourceView,
  onCommandFailure,
  onDiagnosticsChange,
  readExternalSource
}: CelloVisualEditorProps) {
  const labels = useMemo(() => ({ ...defaultLabels, ...labelOverrides }), [labelOverrides]);
  const workbookOptions = useMemo(() => ({ ...(readExternalSource ? { readExternalSource } : {}) }), [readExternalSource]);
  const [editorDocument, setEditorDocument] = useState(() => createEditorDocument(source, workbookOptions));
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [selected, setSelected] = useState<CellAddress>({ sheetIndex: 0, rowIndex: 0, colIndex: 0 });
  const [selectedDefaultCol, setSelectedDefaultCol] = useState<number | null>(null);
  const [modifierScope, setModifierScope] = useState<ModifierScope>("cell");
  const [computedValues, setComputedValues] = useState<ComputedCellValues>({});
  const [editingCellKey, setEditingCellKey] = useState<string | null>(null);
  const [draftCell, setDraftCell] = useState<DraftCell>(null);
  const [commandError, setCommandError] = useState<string | null>(null);

  useEffect(() => {
    const nextDocument = createEditorDocument(source, workbookOptions);
    startTransition(() => {
      setEditorDocument(nextDocument);
      setActiveSheetIndex((index) => {
        const requestedIndex = activeSheetName ? nextDocument.workbook.sheets.findIndex((sheet) => sheet.name === activeSheetName) : -1;
        return requestedIndex >= 0 ? requestedIndex : Math.min(index, nextDocument.workbook.sheets.length - 1);
      });
      setSelected((address) => clampAddress(address, nextDocument.workbook, layout));
    });
  }, [activeSheetName, layout, source, workbookOptions]);

  useEffect(() => {
    if (!commandError) {
      return;
    }
    const timeout = window.setTimeout(() => setCommandError(null), 15000);
    return () => window.clearTimeout(timeout);
  }, [commandError]);

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
  const workbookContext = useMemo(() => (workbook.aliases ? { aliases: workbook.aliases } : {}), [workbook.aliases]);
  const selectedCell = selectedDefaultCol === null ? getSelectedCell(workbook, selected) : getDefaultCellAt(activeSheet, selectedDefaultCol);
  const selectedLabel = selectedDefaultCol === null
    ? `${activeSheet.name}!${getColumnName(selected.colIndex)}${selected.rowIndex + 1}`
    : `${activeSheet.name}!Defaults:${getColumnName(selectedDefaultCol)}`;
  const selectedTextColor = getScopedColorValue(activeSheet, selected, modifierScope, "color", defaultTextColor);
  const selectedFillColor = getScopedColorValue(activeSheet, selected, modifierScope, "bg", defaultFillColor);
  const selectedTone = getScopedToneValue(activeSheet, selected, modifierScope);
  const selectedHeadingPrefix = getCellHeadingPrefix(selectedCell);
  const visibleRowCount = getVisibleRowCount(activeSheet, layout);
  const visibleColumnCount = getVisibleColumnCount(activeSheet, layout);
  const selectedContentText = useMemo(() => getCellContentText(selectedCell), [selectedCell]);
  const selectedModifierText = useMemo(() => getCellModifierSourceText(selectedCell), [selectedCell]);
  const inheritedGroups = selectedDefaultCol === null ? getInheritedModifierGroups(activeSheet, selected.rowIndex, selected.colIndex) : [];
  const selectedColumnFit = isColumnFit(activeSheet, selected.rowIndex, selected.colIndex);
  const selectedColumnWidth = getColumnWidthValue(activeSheet, selected.rowIndex, selected.colIndex);
  const fitMeasureRef = useRef<HTMLDivElement>(null);
  const fitMeasureEntries = useMemo(
    () => getFitMeasureEntries(workbookContext, activeSheet, activeSheetIndex, selected.rowIndex, visibleColumnCount, computedValues),
    [activeSheet, activeSheetIndex, computedValues, selected.rowIndex, visibleColumnCount, workbookContext]
  );
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

  const commit = (update: (current: EditorWorkbook) => EditorWorkbook) => {
    setEditorDocument((currentDocument: EditorDocument) => {
      const nextWorkbook = update(currentDocument.workbook);
      const result = applyWorkbookPatch(currentDocument, nextWorkbook, workbookOptions);
      if (!result.ok) {
        setCommandError(result.message);
        onCommandFailure?.(result);
        return currentDocument;
      }
      setCommandError(null);
      onSourceChange(result.source);
      return result.document;
    });
  };

  const selectCell = (rowIndex: number, colIndex: number) => {
    setSelected({ sheetIndex: activeSheetIndex, rowIndex, colIndex });
    setSelectedDefaultCol(null);
  };

  const selectDefaultCell = (colIndex: number) => {
    setSelected({ sheetIndex: activeSheetIndex, rowIndex: 0, colIndex });
    setSelectedDefaultCol(colIndex);
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
      setActiveSheetIndex(nextSheetIndex);
      setSelected({ sheetIndex: nextSheetIndex, rowIndex: 0, colIndex: 0 });
      setSelectedDefaultCol(null);
      setEditingCellKey(null);
      setDraftCell(null);
      setCommandError(null);
      onSourceChange(result.source);
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
      setActiveSheetIndex(nextSheetIndex);
      setSelected({ sheetIndex: nextSheetIndex, rowIndex: 0, colIndex: 0 });
      setSelectedDefaultCol(null);
      setEditingCellKey(null);
      setDraftCell(null);
      setCommandError(null);
      onSourceChange(result.source);
      return result.document;
    });
  };

  const controlsDisabled = selectedDefaultCol !== null;

  const handleToggleModifier = (key: ToggleModifierKey) => {
    if (selectedDefaultCol !== null) {
      return;
    }
    commit((current) => modifierScope === "cell" ? toggleCellModifier(current, selected, key, layout) : toggleRowModifier(current, selected, key, layout));
  };

  const handleSetColor = (key: ColorModifierKey, value: string) => {
    if (selectedDefaultCol !== null) {
      return;
    }
    commit((current) => modifierScope === "cell" ? setCellColorModifier(current, selected, key, value, layout) : setRowColorModifier(current, selected, key, value, layout));
  };

  const handleSetTone = (value: TextTone) => {
    if (selectedDefaultCol !== null) {
      return;
    }
    commit((current) => modifierScope === "cell" ? setCellToneModifier(current, selected, value, layout) : setRowToneModifier(current, selected, value, layout));
  };

  const handleContentChange = (value: string) => {
    commit((current) => selectedDefaultCol === null
      ? updateCellRaw(current, selected, value, layout)
      : updateDefaultCellSource(current, activeSheetIndex, selectedDefaultCol, composeCellSource(value, selectedModifierText)));
  };

  const handleModifierSourceChange = (value: string) => {
    commit((current) => selectedDefaultCol === null
      ? updateCellSource(current, selected, composeCellSource(selectedContentText, value), layout)
      : updateDefaultCellSource(current, activeSheetIndex, selectedDefaultCol, composeCellSource(selectedContentText, value)));
  };

  const handleApplyPrefix = (prefix: string) => {
    if (selectedDefaultCol === null) {
      commit((current) => updateCellRaw(current, selected, setHeadingPrefix(selectedContentText, prefix), layout));
    }
  };

  const handleToggleInlineStrike = () => {
    if (selectedDefaultCol === null) {
      commit((current) => updateCellRaw(current, selected, toggleWrappedText(selectedContentText, inlineStrikeMarker), layout));
    }
  };

  const withHeaderColumn = (update: (current: EditorWorkbook, headerRowIndex: number) => EditorWorkbook) => {
    commit((current) => {
      const resolution = ensureColumnHeaderRow(current, activeSheetIndex, layout);
      const nextSelected = { ...selected, rowIndex: selected.rowIndex + resolution.rowOffset };
      if (resolution.rowOffset !== 0) {
        setSelected(nextSelected);
      }
      return update(resolution.workbook, resolution.headerRowIndex);
    });
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
          <div className="celloVisualToolbarGroup celloVisualScopeSwitch" role="tablist" aria-label={labels.propertyScope}>
            {([
              ["cell", labels.cellScope],
              ["row", labels.rowScope]
            ] as const).map(([scope, label]) => (
              <button
                key={scope}
                type="button"
                role="tab"
                disabled={controlsDisabled}
                aria-selected={modifierScope === scope}
                className={modifierScope === scope ? "active" : ""}
                onClick={() => setModifierScope(scope)}
              >
                {label}
              </button>
            ))}
          </div>

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
              buttonClassName={selectedTone ? `celloVisualTone-${selectedTone}` : ""}
              displayValue={selectedTone ? `${labels.tone}: ${selectedTone}` : labels.tone}
              disabled={controlsDisabled}
              options={TEXT_TONES.map((tone) => ({ label: tone, value: tone, className: `celloVisualTone-${tone}` }))}
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
            <IconButton label={labels.mergeLeft} icon="mergeLeft" disabled={controlsDisabled} onClick={() => commit((current) => mergeCell(current, selected, "left", layout))} />
            <IconButton label={labels.mergeUp} icon="mergeUp" disabled={controlsDisabled} onClick={() => commit((current) => mergeCell(current, selected, "up", layout))} />
            <IconButton label={labels.newRow} icon="row" onClick={() => commit((current) => addRow(current, activeSheetIndex, layout, selected.rowIndex))} />
            <IconButton label={labels.newColumn} icon="column" onClick={() => commit((current) => addColumn(current, activeSheetIndex, selected.colIndex))} />
          </div>

          <div className="celloVisualToolbarGroup celloVisualLabeledGroup">
            <span className="celloVisualGroupLabel">{labels.selectedColumn}</span>
            <button
              type="button"
              className={`celloVisualButton ${selectedColumnResolvedFit ? "active" : ""}`}
              aria-label={labels.fit}
              disabled={controlsDisabled}
              onClick={() => withHeaderColumn((current, headerRowIndex) => toggleColumnFit(current, activeSheetIndex, headerRowIndex, selected.colIndex, layout))}
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
              onChange={(value) => withHeaderColumn((current, headerRowIndex) => setColumnWidth(current, activeSheetIndex, headerRowIndex, selected.colIndex, value.trim() || undefined, layout))}
            />
          </div>

          <div className="celloVisualToolbarGroup celloVisualLabeledGroup">
            <span className="celloVisualGroupLabel">{labels.selectedRow}</span>
            <button
              type="button"
              className={`celloVisualButton ${selectedRowWrap ? "active" : ""}`}
              aria-label={labels.wrap}
              disabled={controlsDisabled}
              onClick={() => commit((current) => toggleRowWrap(current, selected, layout))}
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
              onChange={(value) => commit((current) => setRowHeight(current, selected, value.trim() || undefined, layout))}
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
                setActiveSheetIndex(sheetIndex);
                setSelected({ sheetIndex, rowIndex: 0, colIndex: 0 });
                setSelectedDefaultCol(null);
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
        <div className="celloVisualGridWrap">
          <table className="celloVisualGrid">
            <thead>
              <tr>
                <th className="celloVisualCorner" />
                {Array.from({ length: visibleColumnCount }, (_, colIndex) => (
                  <th
                    key={colIndex}
                    className="celloVisualColumnHeader"
                    style={withMeasuredFitWidth(getVisualColumnStyle(workbookContext, activeSheet, selected.rowIndex, colIndex), measuredFitColumnWidths[colIndex])}
                  >
                    {getColumnName(colIndex)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
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
                  selected={selected}
                  selectedDefaultCol={selectedDefaultCol}
                  visibleColumnCount={visibleColumnCount}
                  commit={commit}
                  layout={layout}
                  editingCellKey={editingCellKey}
                  draftCell={draftCell}
                  selectCell={selectCell}
                  selectDefaultCell={selectDefaultCell}
                  setDraftCell={setDraftCell}
                  setEditingCellKey={setEditingCellKey}
                />
              ))}
            </tbody>
          </table>
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

function VisualDataRows({
  activeSheet,
  activeSheetIndex,
  aliases,
  computedValues,
  commit,
  draftCell,
  editingCellKey,
  labels,
  layout,
  measuredFitColumnWidths,
  modifierScope,
  rowIndex,
  selectCell,
  selectDefaultCell,
  setEditingCellKey,
  setDraftCell,
  selected,
  selectedDefaultCol,
  visibleColumnCount
}: {
  activeSheet: EditorSheet;
  activeSheetIndex: number;
  aliases: EditorWorkbook["aliases"];
  computedValues: ComputedCellValues;
  commit: (update: (current: EditorWorkbook) => EditorWorkbook) => void;
  editingCellKey: string | null;
  draftCell: DraftCell;
  labels: CelloVisualEditorLabels;
  layout: EditorLayoutOptions | undefined;
  measuredFitColumnWidths: FitColumnWidths;
  modifierScope: ModifierScope;
  rowIndex: number;
  selectCell: (rowIndex: number, colIndex: number) => void;
  selectDefaultCell: (colIndex: number) => void;
  setEditingCellKey: (key: string | null) => void;
  setDraftCell: (draft: DraftCell) => void;
  selected: CellAddress;
  selectedDefaultCol: number | null;
  visibleColumnCount: number;
}) {
  const rows = [
    <tr key={rowIndex} className={activeSheet.rows[rowIndex]?.kind === "header" ? "celloVisualHeaderRow" : undefined}>
      <th className={`celloVisualRowHeader ${modifierScope === "row" && selectedDefaultCol === null && selected.rowIndex === rowIndex ? "selectedRow" : ""}`}>
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
        const cellKey = getCellAddressKey({ sheetIndex: activeSheetIndex, rowIndex, colIndex });
        const workbookContext = aliases ? { aliases } : {};
        const toneClass = getCellToneClass(activeSheet, rowIndex, colIndex, workbookContext);
        const isEditing = editingCellKey === cellKey || draftCell?.key === cellKey;
        const computed = computedValues[cellKey];
        const displayValue = getCellFormattedDisplayText(activeSheet, rowIndex, colIndex, computed, workbookContext);
        const inputValue = draftCell?.key === cellKey ? draftCell.value : displayValue;
        const cellStyle = withMeasuredFitWidth(getVisualCellStyle(workbookContext, activeSheet, rowIndex, colIndex), measuredFitColumnWidths[colIndex]);
        const contentStyle = getVisualCellContentStyle(workbookContext, activeSheet, rowIndex);
        const editorStyle = getVisualCellStyle(workbookContext, activeSheet, rowIndex, colIndex);
        delete editorStyle.width;
        delete editorStyle.minWidth;
        delete editorStyle.maxWidth;
        const shouldHighlightFormula = inputValue.startsWith("=") && isEditing;
        const showDisplayOverlay = !isEditing && displayValue !== "";
        return (
          <td key={colIndex} className={[isSelected ? "selected" : "", toneClass, span.colspan > 1 || span.rowspan > 1 ? "merged" : ""].filter(Boolean).join(" ")} style={cellStyle} colSpan={span.colspan} rowSpan={span.rowspan}>
            <div className={`celloVisualCellEditor ${shouldHighlightFormula ? "hasFormulaHighlight" : ""} ${showDisplayOverlay ? "hasDisplayOverlay" : ""}`} style={contentStyle}>
              {showDisplayOverlay ? (
                <div className="celloVisualCellDisplay" style={{ ...editorStyle, ...contentStyle }} aria-hidden="true">
                  {renderInlineDisplay(displayValue)}
                </div>
              ) : null}
              {shouldHighlightFormula ? (
                <div className="celloVisualCellFormulaHighlight" aria-hidden="true">
                  {renderFormulaHighlight(inputValue)}
                </div>
              ) : null}
              <textarea
                aria-label={`${getColumnName(colIndex)}${rowIndex + 1}`}
                value={inputValue}
                style={{ ...editorStyle, ...contentStyle }}
                rows={1}
                onFocus={() => {
                  selectCell(rowIndex, colIndex);
                  setEditingCellKey(cell.raw.startsWith("=") ? cellKey : null);
                  setDraftCell({ key: cellKey, value: getCellContentText(cell) });
                }}
                onBlur={() => {
                  setEditingCellKey(null);
                  setDraftCell(null);
                }}
                onChange={(event) => {
                  const nextAddress = { sheetIndex: activeSheetIndex, rowIndex, colIndex };
                  selectCell(rowIndex, colIndex);
                  setDraftCell({ key: cellKey, value: event.target.value });
                  commit((current) => updateCellRaw(current, nextAddress, event.target.value, layout));
                }}
              />
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

function clampAddress(address: CellAddress, workbook: EditorWorkbook, layout: EditorLayoutOptions | undefined): CellAddress {
  const sheetIndex = Math.min(address.sheetIndex, workbook.sheets.length - 1);
  const sheet = workbook.sheets[sheetIndex];
  return {
    sheetIndex,
    rowIndex: Math.min(address.rowIndex, getVisibleRowCount(sheet, layout) - 1),
    colIndex: Math.min(address.colIndex, getVisibleColumnCount(sheet, layout) - 1)
  };
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
