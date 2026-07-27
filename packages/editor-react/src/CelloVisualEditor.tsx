import { startTransition, useEffect, useMemo, useState } from "react";
import {
  addColumn,
  addRow,
  addSheet,
  createEditorWorkbook,
  DEFAULT_SHEET_NAME,
  evaluateEditorWorkbookSource,
  getCellAddressKey,
  getCellAt,
  getCellDisplayText,
  getCellSourceText,
  getCellStyle,
  getColumnName,
  getScopedColorValue,
  getSelectedCell,
  getVisibleColumnCount,
  getVisibleRowCount,
  hasScopedModifier,
  mergeCell,
  removeSheet,
  renameSheet,
  serializeEditorWorkbook,
  setCellColorModifier,
  setRowColorModifier,
  toggleCellModifier,
  toggleRowModifier,
  updateCellRaw,
  updateCellSource
} from "@cello/editor-core";
import type {
  CellAddress,
  ColorModifierKey,
  ComputedCellValues,
  CreateEditorWorkbookOptions,
  EditorLayoutOptions,
  EditorSheet,
  EditorWorkbook,
  ToggleModifierKey
} from "@cello/editor-core";
import { EditorIcon } from "./icons.js";

export interface CelloVisualEditorLabels {
  bold: string;
  cellScope: string;
  deleteSheet: string;
  fillColor: string;
  headerRow: string;
  italic: string;
  mergeLeft: string;
  mergeUp: string;
  newColumn: string;
  newRow: string;
  newSheet: string;
  renameSheet: string;
  rowScope: string;
  selectedCellSource: string;
  source: string;
  textColor: string;
  toolbar: string;
  workbook: string;
}

export interface CelloVisualEditorProps {
  source: string;
  onSourceChange: (source: string) => void;
  className?: string;
  labels?: Partial<CelloVisualEditorLabels>;
  layout?: EditorLayoutOptions;
  onRequestSourceView?: () => void;
  readExternalSource?: CreateEditorWorkbookOptions["readExternalSource"];
}

const defaultLabels: CelloVisualEditorLabels = {
  bold: "Bold",
  cellScope: "cell",
  deleteSheet: "Delete sheet",
  fillColor: "Fill color",
  headerRow: "Header",
  italic: "Italic",
  mergeLeft: "Merge with left",
  mergeUp: "Merge with top",
  newColumn: "New column",
  newRow: "New row",
  newSheet: "New sheet",
  renameSheet: "Rename active sheet",
  rowScope: "row",
  selectedCellSource: "Selected cell source",
  source: "Source",
  textColor: "Text color",
  toolbar: "Visual editor toolbar",
  workbook: "Visual spreadsheet editor"
};

const defaultTextColor = "#1f1e1b";
const defaultFillColor = "#fffaf4";
const fallbackSheet: EditorSheet = { name: DEFAULT_SHEET_NAME, rows: [] };

type ModifierScope = "cell" | "row";

export function CelloVisualEditor({
  source,
  onSourceChange,
  className,
  labels: labelOverrides,
  layout,
  onRequestSourceView,
  readExternalSource
}: CelloVisualEditorProps) {
  const labels = useMemo(() => ({ ...defaultLabels, ...labelOverrides }), [labelOverrides]);
  const workbookOptions = useMemo(() => ({ ...(readExternalSource ? { readExternalSource } : {}) }), [readExternalSource]);
  const [workbook, setWorkbook] = useState(() => createEditorWorkbook(source, workbookOptions));
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [selected, setSelected] = useState<CellAddress>({ sheetIndex: 0, rowIndex: 0, colIndex: 0 });
  const [modifierScope, setModifierScope] = useState<ModifierScope>("cell");
  const [computedValues, setComputedValues] = useState<ComputedCellValues>({});

  useEffect(() => {
    const nextWorkbook = createEditorWorkbook(source, workbookOptions);
    startTransition(() => {
      setWorkbook(nextWorkbook);
      setActiveSheetIndex((index) => Math.min(index, nextWorkbook.sheets.length - 1));
      setSelected((address) => clampAddress(address, nextWorkbook, layout));
    });
  }, [layout, source, workbookOptions]);

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

  const activeSheet = workbook.sheets[activeSheetIndex] ?? workbook.sheets[0] ?? fallbackSheet;
  const selectedCell = getSelectedCell(workbook, selected);
  const selectedLabel = `${activeSheet.name}!${getColumnName(selected.colIndex)}${selected.rowIndex + 1}`;
  const selectedTextColor = getScopedColorValue(activeSheet, selected, modifierScope, "color", defaultTextColor);
  const selectedFillColor = getScopedColorValue(activeSheet, selected, modifierScope, "bg", defaultFillColor);
  const visibleRowCount = getVisibleRowCount(activeSheet, layout);
  const visibleColumnCount = getVisibleColumnCount(activeSheet, layout);
  const selectedSourceText = useMemo(() => getCellSourceText(selectedCell), [selectedCell]);

  const commit = (update: (current: EditorWorkbook) => EditorWorkbook) => {
    setWorkbook((current) => {
      const next = update(current);
      onSourceChange(serializeEditorWorkbook(next));
      return next;
    });
  };

  const selectCell = (rowIndex: number, colIndex: number) => {
    setSelected({ sheetIndex: activeSheetIndex, rowIndex, colIndex });
  };

  const handleAddSheet = () => {
    setWorkbook((current) => {
      const next = addSheet(current);
      const nextSheetIndex = next.sheets.length - 1;
      setActiveSheetIndex(nextSheetIndex);
      setSelected({ sheetIndex: nextSheetIndex, rowIndex: 0, colIndex: 0 });
      onSourceChange(serializeEditorWorkbook(next));
      return next;
    });
  };

  const handleRemoveSheet = () => {
    setWorkbook((current) => {
      const next = removeSheet(current, activeSheetIndex);
      const nextSheetIndex = Math.min(activeSheetIndex, next.sheets.length - 1);
      setActiveSheetIndex(nextSheetIndex);
      setSelected({ sheetIndex: nextSheetIndex, rowIndex: 0, colIndex: 0 });
      onSourceChange(serializeEditorWorkbook(next));
      return next;
    });
  };

  const handleToggleModifier = (key: ToggleModifierKey) => {
    commit((current) => modifierScope === "cell" ? toggleCellModifier(current, selected, key, layout) : toggleRowModifier(current, selected, key, layout));
  };

  const handleSetColor = (key: ColorModifierKey, value: string) => {
    commit((current) => modifierScope === "cell" ? setCellColorModifier(current, selected, key, value, layout) : setRowColorModifier(current, selected, key, value, layout));
  };

  return (
    <main className={["celloVisualEditorShell", className].filter(Boolean).join(" ")}>
      <section className="celloVisualToolbar" aria-label={labels.toolbar}>
        <div className="celloVisualToolbarGroup celloVisualToolbarIdentity">
          <span className="celloVisualCellAddress">{selectedLabel}</span>
          <textarea
            className="celloVisualFormulaInput celloVisualFormulaArea"
            aria-label={labels.selectedCellSource}
            rows={1}
            value={selectedSourceText}
            onChange={(event) => commit((current) => updateCellSource(current, selected, event.target.value, layout))}
          />
        </div>

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

        <div className="celloVisualToolbarGroup">
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
          <label className="celloVisualColorTool" title={labels.textColor} aria-label={labels.textColor}>
            <span>A</span>
            <input type="color" value={selectedTextColor} onChange={(event) => handleSetColor("color", event.target.value)} />
          </label>
          <label className="celloVisualColorTool" title={labels.fillColor} aria-label={labels.fillColor}>
            <EditorIcon name="paint" />
            <input type="color" value={selectedFillColor} onChange={(event) => handleSetColor("bg", event.target.value)} />
          </label>
        </div>

        <div className="celloVisualToolbarGroup">
          <IconButton label={labels.mergeLeft} icon="mergeLeft" onClick={() => commit((current) => mergeCell(current, selected, "left", layout))} />
          <IconButton label={labels.mergeUp} icon="mergeUp" onClick={() => commit((current) => mergeCell(current, selected, "up", layout))} />
        </div>

        <div className="celloVisualToolbarGroup">
          <IconButton label={labels.newRow} icon="row" onClick={() => commit((current) => addRow(current, activeSheetIndex, layout))} />
          <IconButton label={labels.newColumn} icon="column" onClick={() => commit((current) => addColumn(current, activeSheetIndex))} />
          <IconButton label={labels.newSheet} icon="sheet" className="celloVisualPrimaryAction" onClick={handleAddSheet} />
          <IconButton label={labels.deleteSheet} icon="trash" disabled={workbook.sheets.length <= 1} onClick={handleRemoveSheet} />
        </div>

        {onRequestSourceView ? (
          <button type="button" className="celloVisualButton celloVisualIconTextButton celloVisualSourceButton" aria-label={labels.source} onClick={onRequestSourceView}>
            <EditorIcon name="format" />
            <span>{labels.source}</span>
          </button>
        ) : null}
      </section>

      <section className="celloVisualWorkbook" aria-label={labels.workbook}>
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
              }}
            >
              {sheet.name}
            </button>
          ))}
          <input
            className="celloVisualSheetNameInput"
            aria-label={labels.renameSheet}
            value={activeSheet.name}
            onChange={(event) => commit((current) => renameSheet(current, activeSheetIndex, event.target.value))}
          />
        </div>

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
                <tr key={rowIndex} className={activeSheet.rows[rowIndex]?.kind === "header" ? "celloVisualHeaderRow" : undefined}>
                  <th className="celloVisualRowHeader">
                    <span>{rowIndex + 1}</span>
                    {activeSheet.rows[rowIndex]?.kind === "header" ? <span className="celloVisualHeaderBadge">{labels.headerRow}</span> : null}
                  </th>
                  {Array.from({ length: visibleColumnCount }, (_, colIndex) => {
                    const cell = getCellAt(activeSheet, rowIndex, colIndex);
                    const isSelected = selected.sheetIndex === activeSheetIndex && selected.rowIndex === rowIndex && selected.colIndex === colIndex;
                    const computed = computedValues[getCellAddressKey({ sheetIndex: activeSheetIndex, rowIndex, colIndex })];
                    return (
                      <td key={colIndex} className={isSelected ? "selected" : undefined}>
                        <input
                          aria-label={`${getColumnName(colIndex)}${rowIndex + 1}`}
                          value={getCellDisplayText(cell, computed)}
                          style={getCellStyle(activeSheet, rowIndex, colIndex)}
                          onFocus={() => selectCell(rowIndex, colIndex)}
                          onChange={(event) => {
                            const nextAddress = { sheetIndex: activeSheetIndex, rowIndex, colIndex };
                            setSelected(nextAddress);
                            commit((current) => updateCellRaw(current, nextAddress, event.target.value, layout));
                          }}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
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

function clampAddress(address: CellAddress, workbook: EditorWorkbook, layout: EditorLayoutOptions | undefined): CellAddress {
  const sheetIndex = Math.min(address.sheetIndex, workbook.sheets.length - 1);
  const sheet = workbook.sheets[sheetIndex];
  return {
    sheetIndex,
    rowIndex: Math.min(address.rowIndex, getVisibleRowCount(sheet, layout) - 1),
    colIndex: Math.min(address.colIndex, getVisibleColumnCount(sheet, layout) - 1)
  };
}
