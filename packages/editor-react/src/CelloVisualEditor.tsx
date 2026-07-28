import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import {
  addColumn,
  addRow,
  addSheet,
  applyWorkbookPatch,
  createEditorDocument,
  DEFAULT_COLUMN_WIDTH,
  DEFAULT_ROW_LAYOUT,
  DEFAULT_SHEET_NAME,
  ROW_HEIGHT_PRESETS,
  SHEET_LAYOUT_DEFAULT_SENTINEL,
  SHEET_COLUMNS_MODES,
  SHEET_ROWS_MODES,
  WIDTH_PRESET_NAMES,
  ensureColumnHeaderRow,
  evaluateEditorWorkbookSource,
  getCellAddressKey,
  getCellAt,
  getCellDisplayText,
  getCellHeadingPrefix,
  getCellSourceText,
  getCellStyle,
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
  className?: string;
  labels?: Partial<CelloVisualEditorLabels>;
  layout?: EditorLayoutOptions;
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
const defaultColumnWidthPlaceholder = DEFAULT_COLUMN_WIDTH.value === undefined ? "" : String(DEFAULT_COLUMN_WIDTH.value);
const defaultRowHeightPlaceholder = DEFAULT_ROW_LAYOUT.height.value === undefined ? "" : String(DEFAULT_ROW_LAYOUT.height.value);
const fallbackSheet: EditorSheet = { name: DEFAULT_SHEET_NAME, layout: {}, rows: [], defaults: [] };
const headingStyles = [
  { labelKey: "h1", prefix: "## " },
  { labelKey: "h2", prefix: "# " },
  { labelKey: "h3", prefix: "### " }
] as const;
const formulaTokenPattern = /([A-Za-z_][\w ]*!|!!)|(\[[^\]]+\])|([+\-*/^(),[\]])|(=)|([A-Za-z_][\w ]*)|(\s+|.)/g;
const inlineStrikeMarker = "~~";

type ModifierScope = "cell" | "row";

export function CelloVisualEditor({
  source,
  onSourceChange,
  className,
  labels: labelOverrides,
  layout,
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
  const [commandError, setCommandError] = useState<string | null>(null);
  const [toneMenuOpen, setToneMenuOpen] = useState(false);
  const toneMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const nextDocument = createEditorDocument(source, workbookOptions);
    startTransition(() => {
      setEditorDocument(nextDocument);
      setActiveSheetIndex((index) => Math.min(index, nextDocument.workbook.sheets.length - 1));
      setSelected((address) => clampAddress(address, nextDocument.workbook, layout));
      setEditingCellKey(null);
    });
  }, [layout, source, workbookOptions]);

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

  useEffect(() => {
    if (!toneMenuOpen) {
      return;
    }

    const closeMenu = (event: MouseEvent) => {
      if (!toneMenuRef.current?.contains(event.target as Node)) {
        setToneMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", closeMenu);
    return () => document.removeEventListener("mousedown", closeMenu);
  }, [toneMenuOpen]);

  const workbook = editorDocument.workbook;
  const activeSheet = workbook.sheets[activeSheetIndex] ?? workbook.sheets[0] ?? fallbackSheet;
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
  const selectedSourceText = useMemo(() => getCellSourceText(selectedCell), [selectedCell]);
  const inheritedGroups = selectedDefaultCol === null ? getInheritedModifierGroups(activeSheet, selected.rowIndex, selected.colIndex) : [];
  const selectedColumnFit = isColumnFit(activeSheet, selected.rowIndex, selected.colIndex);
  const selectedColumnWidth = getColumnWidthValue(activeSheet, selected.rowIndex, selected.colIndex);
  const selectedRowWrap = isRowWrap(activeSheet, selected.rowIndex);
  const selectedRowHeight = getRowHeightValue(activeSheet, selected.rowIndex);
  const diagnosticMessage = commandError ?? editorDocument.diagnostics.find((diagnostic) => diagnostic.level === "warning" || diagnostic.level === "error")?.message ?? null;

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
      setCommandError(null);
      onSourceChange(result.source);
      return result.document;
    });
  };

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
    setToneMenuOpen(false);
  };

  const handleSourceChange = (value: string) => {
    commit((current) => selectedDefaultCol === null
      ? updateCellSource(current, selected, value, layout)
      : updateDefaultCellSource(current, activeSheetIndex, selectedDefaultCol, value));
  };

  const handleApplyPrefix = (prefix: string) => {
    if (selectedDefaultCol === null) {
      commit((current) => updateCellSource(current, selected, setHeadingPrefix(selectedSourceText, prefix), layout));
    }
  };

  const handleToggleInlineStrike = () => {
    if (selectedDefaultCol === null) {
      commit((current) => updateCellSource(current, selected, toggleWrappedText(selectedSourceText, inlineStrikeMarker), layout));
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
                {renderFormulaHighlight(selectedSourceText)}
              </div>
              <textarea
                className={`celloVisualFormulaInput celloVisualFormulaArea ${selectedSourceText.startsWith("=") ? "hasHighlight" : ""}`}
                aria-label={labels.selectedCellSource}
                rows={1}
                value={selectedSourceText}
                onChange={(event) => handleSourceChange(event.target.value)}
              />
            </div>
          </div>

          <div className="celloVisualInheritedPanel" aria-label={labels.inherited}>
            <span>{labels.inherited}</span>
            <div>
              {inheritedGroups.length > 0 ? inheritedGroups.map((group) => (
                <span key={group.scope} className={`celloVisualInheritedToken ${group.scope}`}>
                  {group.scope}: {group.modifiers.map((modifier) => `[${modifier.raw}]`).join("")}
                </span>
              )) : <span className="celloVisualInheritedEmpty">None</span>}
            </div>
          </div>
        </div>

        <div className="celloVisualToolbarRow celloVisualToolbarFormatRow">
          <div className="celloVisualToolbarGroup celloVisualScopeSwitch" role="tablist" aria-label="Property scope">
            {([
              ["cell", labels.cellScope],
              ["row", labels.rowScope]
            ] as const).map(([scope, label]) => (
              <button
                key={scope}
                type="button"
                role="tab"
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
              onClick={() => handleToggleModifier("bold")}
            >
              <strong>B</strong>
            </button>
            <button
              type="button"
              className={`celloVisualButton celloVisualIconButton ${hasScopedModifier(activeSheet, selected, modifierScope, "italic") ? "active" : ""}`}
              aria-label={labels.italic}
              title={labels.italic}
              onClick={() => handleToggleModifier("italic")}
            >
              <em>I</em>
            </button>
            <button
              type="button"
              className={`celloVisualButton celloVisualIconButton ${hasScopedModifier(activeSheet, selected, modifierScope, "strike") ? "active" : ""}`}
              aria-label={labels.strike}
              title={labels.strike}
              onClick={() => handleToggleModifier("strike")}
              onDoubleClick={handleToggleInlineStrike}
            >
              <span className="celloVisualStrikeIcon">S</span>
            </button>
            {headingStyles.map((style) => (
              <IconTextButton key={style.labelKey} active={selectedHeadingPrefix === style.prefix} label={labels[style.labelKey]} onClick={() => handleApplyPrefix(style.prefix)} />
            ))}
            <label className="celloVisualColorTool" title={labels.textColor} aria-label={labels.textColor}>
              <span style={{ color: selectedTextColor }}>A</span>
              <input type="color" value={selectedTextColor} onChange={(event) => handleSetColor("color", event.target.value)} />
            </label>
            <label className="celloVisualColorTool" title={labels.fillColor} aria-label={labels.fillColor} style={{ background: selectedFillColor }}>
              <EditorIcon name="paint" />
              <input type="color" value={selectedFillColor} onChange={(event) => handleSetColor("bg", event.target.value)} />
            </label>
            <div className="celloVisualToneMenu" ref={toneMenuRef}>
              <button
                type="button"
                className={["celloVisualButton", selectedTone ? `celloVisualTone-${selectedTone}` : ""].filter(Boolean).join(" ")}
                aria-expanded={toneMenuOpen}
                aria-haspopup="menu"
                aria-label={labels.tone}
                onClick={() => setToneMenuOpen((open) => !open)}
              >
                {labels.tone}{selectedTone ? `: ${selectedTone}` : ""}
              </button>
              {toneMenuOpen ? (
              <div className="celloVisualToneOptions">
                {TEXT_TONES.map((tone) => (
                  <button
                    key={tone}
                    type="button"
                    role="menuitemradio"
                    aria-checked={selectedTone === tone}
                    className={[`celloVisualTone-${tone}`, selectedTone === tone ? "active" : ""].join(" ")}
                    onClick={() => handleSetTone(tone)}
                  >
                    {tone}
                  </button>
                ))}
              </div>
              ) : null}
            </div>
          </div>

          <div className="celloVisualToolbarGroup celloVisualLabeledGroup">
            <span className="celloVisualGroupLabel">{labels.tableGroup}</span>
            <label className="celloVisualSelectTool">
              <span>{labels.columnsMode}</span>
              <select
                aria-label={labels.columnsMode}
                value={activeSheet.layout?.columns ?? SHEET_LAYOUT_DEFAULT_SENTINEL}
                onChange={(event) => commit((current) => setSheetColumnsMode(current, activeSheetIndex, event.target.value === SHEET_LAYOUT_DEFAULT_SENTINEL ? undefined : event.target.value as "normal" | "fit"))}
              >
                <option value={SHEET_LAYOUT_DEFAULT_SENTINEL}>{labels.defaultOption}</option>
                {SHEET_COLUMNS_MODES.map((mode) => <option key={mode} value={mode}>{mode === "normal" ? labels.columnsNormal : labels.columnsFit}</option>)}
              </select>
            </label>
            <label className="celloVisualSelectTool">
              <span>{labels.rowsMode}</span>
              <select
                aria-label={labels.rowsMode}
                value={activeSheet.layout?.rows ?? SHEET_LAYOUT_DEFAULT_SENTINEL}
                onChange={(event) => commit((current) => setSheetRowsMode(current, activeSheetIndex, event.target.value === SHEET_LAYOUT_DEFAULT_SENTINEL ? undefined : event.target.value as "ellipsis" | "wrap"))}
              >
                <option value={SHEET_LAYOUT_DEFAULT_SENTINEL}>{labels.defaultOption}</option>
                {SHEET_ROWS_MODES.map((mode) => <option key={mode} value={mode}>{mode === "ellipsis" ? labels.rowsEllipsis : labels.rowsWrap}</option>)}
              </select>
            </label>
            <IconButton label={labels.mergeLeft} icon="mergeLeft" onClick={() => commit((current) => mergeCell(current, selected, "left", layout))} />
            <IconButton label={labels.mergeUp} icon="mergeUp" onClick={() => commit((current) => mergeCell(current, selected, "up", layout))} />
            <IconButton label={labels.newRow} icon="row" onClick={() => commit((current) => addRow(current, activeSheetIndex, layout, selected.rowIndex))} />
            <IconButton label={labels.newColumn} icon="column" onClick={() => commit((current) => addColumn(current, activeSheetIndex, selected.colIndex))} />
          </div>

          {selectedDefaultCol === null ? (
            <div className="celloVisualToolbarGroup celloVisualLabeledGroup">
              <span className="celloVisualGroupLabel">{labels.selectedColumn}</span>
              <button
                type="button"
                className={`celloVisualButton ${selectedColumnFit ? "active" : ""}`}
                aria-label={labels.fit}
                onClick={() => withHeaderColumn((current, headerRowIndex) => toggleColumnFit(current, activeSheetIndex, headerRowIndex, selected.colIndex, layout))}
              >
                {labels.fit}
              </button>
              <label className="celloVisualInputTool">
                <span>{labels.width}</span>
                <input
                  aria-label={labels.width}
                  list="cello-width-presets"
                  value={selectedColumnWidth}
                  placeholder={defaultColumnWidthPlaceholder}
                  onChange={(event) => withHeaderColumn((current, headerRowIndex) => setColumnWidth(current, activeSheetIndex, headerRowIndex, selected.colIndex, event.target.value.trim() || undefined, layout))}
                />
              </label>
              <datalist id="cello-width-presets">
                {WIDTH_PRESET_NAMES.map((value) => <option key={value} value={value} />)}
              </datalist>
            </div>
          ) : null}

          {selectedDefaultCol === null ? (
            <div className="celloVisualToolbarGroup celloVisualLabeledGroup">
              <span className="celloVisualGroupLabel">{labels.selectedRow}</span>
              <button
                type="button"
                className={`celloVisualButton ${selectedRowWrap ? "active" : ""}`}
                aria-label={labels.wrap}
                onClick={() => commit((current) => toggleRowWrap(current, selected, layout))}
              >
                {labels.wrap}
              </button>
              <label className="celloVisualInputTool">
                <span>{labels.height}</span>
                <input
                  aria-label={labels.height}
                  list="cello-height-presets"
                  value={selectedRowHeight}
                  placeholder={defaultRowHeightPlaceholder}
                  onChange={(event) => commit((current) => setRowHeight(current, selected, event.target.value.trim() || undefined, layout))}
                />
              </label>
              <datalist id="cello-height-presets">
                {ROW_HEIGHT_PRESETS.map((value) => <option key={value} value={value} />)}
              </datalist>
            </div>
          ) : null}

          {onRequestSourceView ? (
            <button type="button" className="celloVisualButton celloVisualIconTextButton celloVisualSourceButton" aria-label={labels.source} onClick={onRequestSourceView}>
              <EditorIcon name="format" />
              <span>{labels.source}</span>
            </button>
          ) : null}
        </div>
      </section>

      <section className="celloVisualWorkbook" aria-label={labels.workbook}>
        <div className="celloVisualGridWrap">
          <table className="celloVisualGrid">
            <thead>
              <tr>
                <th className="celloVisualCorner" />
                {Array.from({ length: visibleColumnCount }, (_, colIndex) => (
                  <th key={colIndex} className="celloVisualColumnHeader">{getColumnName(colIndex)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: visibleRowCount }, (_, rowIndex) => (
                <VisualDataRows
                  key={rowIndex}
                  activeSheet={activeSheet}
                  activeSheetIndex={activeSheetIndex}
                  computedValues={computedValues}
                  labels={labels}
                  modifierScope={modifierScope}
                  rowIndex={rowIndex}
                  selected={selected}
                  selectedDefaultCol={selectedDefaultCol}
                  visibleColumnCount={visibleColumnCount}
                  commit={commit}
                  layout={layout}
                  editingCellKey={editingCellKey}
                  selectCell={selectCell}
                  selectDefaultCell={selectDefaultCell}
                  setEditingCellKey={setEditingCellKey}
                />
              ))}
            </tbody>
          </table>
        </div>

        <div className="celloVisualSheetTabs" role="tablist" aria-label="Workbook sheets">
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
    </main>
  );
}

function VisualDataRows({
  activeSheet,
  activeSheetIndex,
  computedValues,
  commit,
  editingCellKey,
  labels,
  layout,
  modifierScope,
  rowIndex,
  selectCell,
  selectDefaultCell,
  setEditingCellKey,
  selected,
  selectedDefaultCol,
  visibleColumnCount
}: {
  activeSheet: EditorSheet;
  activeSheetIndex: number;
  computedValues: ComputedCellValues;
  commit: (update: (current: EditorWorkbook) => EditorWorkbook) => void;
  editingCellKey: string | null;
  labels: CelloVisualEditorLabels;
  layout: EditorLayoutOptions | undefined;
  modifierScope: ModifierScope;
  rowIndex: number;
  selectCell: (rowIndex: number, colIndex: number) => void;
  selectDefaultCell: (colIndex: number) => void;
  setEditingCellKey: (key: string | null) => void;
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
        const computed = computedValues[cellKey];
        const toneClass = getCellToneClass(activeSheet, rowIndex, colIndex);
        const inputValue = cell.raw.startsWith("=") && editingCellKey === cellKey
          ? getCellSourceText(cell)
          : getCellDisplayText(cell, computed);
        return (
          <td key={colIndex} className={[isSelected ? "selected" : "", toneClass, span.colspan > 1 || span.rowspan > 1 ? "merged" : ""].filter(Boolean).join(" ")} colSpan={span.colspan} rowSpan={span.rowspan}>
            <input
              aria-label={`${getColumnName(colIndex)}${rowIndex + 1}`}
              value={inputValue}
              style={getCellStyle(activeSheet, rowIndex, colIndex)}
              onFocus={() => {
                selectCell(rowIndex, colIndex);
                setEditingCellKey(cell.raw.startsWith("=") ? cellKey : null);
              }}
              onBlur={() => setEditingCellKey(null)}
              onChange={(event) => {
                const nextAddress = { sheetIndex: activeSheetIndex, rowIndex, colIndex };
                selectCell(rowIndex, colIndex);
                commit((current) => updateCellRaw(current, nextAddress, event.target.value, layout));
              }}
            />
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

function IconTextButton({ active, label, onClick }: { active?: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" className={["celloVisualButton", "celloVisualTextStyleButton", active ? "active" : ""].filter(Boolean).join(" ")} aria-label={label} title={label} onClick={onClick}>
      {label}
    </button>
  );
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

function tokenizeFormula(source: string): Array<{ kind: string; text: string }> {
  const tokens: Array<{ kind: string; text: string }> = [];
  for (const match of source.matchAll(formulaTokenPattern)) {
    const text = match[0];
    const kind = match[4] ? "equals" : match[1] ? "sheet" : match[2] ? "range" : match[3] ? "operator" : match[5] ? "column" : "plain";
    tokens.push({ kind, text });
  }
  return tokens;
}
