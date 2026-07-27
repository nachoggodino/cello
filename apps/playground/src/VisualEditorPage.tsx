import { evaluate, parse } from "@cello/core";
import { startTransition, useEffect, useMemo, useState } from "react";
import { ToolbarIcon } from "./icons";
import {
  addColumn,
  addRow,
  addSheet,
  createEditorWorkbook,
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
} from "./visualEditorState";
import type { CellAddress, EditorWorkbook } from "./visualEditorState";

interface VisualEditorPageProps {
  source: string;
  onOpenSource: () => void;
  onSourceChange: (source: string) => void;
}

type ModifierScope = "cell" | "row";

export function VisualEditorPage({ source, onOpenSource, onSourceChange }: VisualEditorPageProps) {
  const [workbook, setWorkbook] = useState(() => createEditorWorkbook(source));
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [selected, setSelected] = useState<CellAddress>({ sheetIndex: 0, rowIndex: 0, colIndex: 0 });
  const [modifierScope, setModifierScope] = useState<ModifierScope>("cell");
  const [computedValues, setComputedValues] = useState<Record<string, string | number | boolean | null>>({});

  useEffect(() => {
    const nextWorkbook = createEditorWorkbook(source);
    startTransition(() => {
      setWorkbook(nextWorkbook);
      setActiveSheetIndex((index) => Math.min(index, nextWorkbook.sheets.length - 1));
      setSelected((address) => {
        const nextSheetIndex = Math.min(address.sheetIndex, nextWorkbook.sheets.length - 1);
        const nextSheet = nextWorkbook.sheets[nextSheetIndex];
        return {
          sheetIndex: nextSheetIndex,
          rowIndex: Math.min(address.rowIndex, getVisibleRowCount(nextSheet) - 1),
          colIndex: Math.min(address.colIndex, getVisibleColumnCount(nextSheet) - 1)
        };
      });
    });
  }, [source]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const ast = parse(source);
        const evaluated = await evaluate(ast);
        if (cancelled) {
          return;
        }
        const nextValues: Record<string, string | number | boolean | null> = {};
        for (const [sheetIndex, sheet] of evaluated.sheets.entries()) {
          for (const row of sheet.rows) {
            for (const cell of row.cells) {
              if (cell.kind === "formula") {
                nextValues[`${sheetIndex}:${row.index - 1}:${cell.col - 1}`] = cell.computed ?? null;
              }
            }
          }
        }
        setComputedValues(nextValues);
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
  }, [source]);

  const activeSheet = workbook.sheets[activeSheetIndex] ?? workbook.sheets[0];
  const selectedCell = getSelectedCell(workbook, selected);
  const selectedLabel = `${activeSheet ? activeSheet.name : "Sheet"}!${getColumnName(selected.colIndex)}${selected.rowIndex + 1}`;
  const selectedTextColor = getScopedColorValue(activeSheet, selected, modifierScope, "color", "#1f1e1b");
  const selectedFillColor = getScopedColorValue(activeSheet, selected, modifierScope, "bg", "#fffaf4");
  const visibleRowCount = getVisibleRowCount(activeSheet);
  const visibleColumnCount = getVisibleColumnCount(activeSheet);

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

  const handleToggleModifier = (key: "bold" | "italic") => {
    if (modifierScope === "cell") {
      commit((current) => toggleCellModifier(current, selected, key));
      return;
    }
    commit((current) => toggleRowModifier(current, selected, key));
  };

  const handleSetColor = (key: "bg" | "color", value: string) => {
    if (modifierScope === "cell") {
      commit((current) => setCellColorModifier(current, selected, key, value));
      return;
    }
    commit((current) => setRowColorModifier(current, selected, key, value));
  };

  const handleRemoveSheet = () => {
    if (workbook.sheets.length <= 1) {
      return;
    }
    setWorkbook((current) => {
      const next = removeSheet(current, activeSheetIndex);
      const nextSheetIndex = Math.min(activeSheetIndex, next.sheets.length - 1);
      setActiveSheetIndex(nextSheetIndex);
      setSelected({ sheetIndex: nextSheetIndex, rowIndex: 0, colIndex: 0 });
      onSourceChange(serializeEditorWorkbook(next));
      return next;
    });
  };

  if (!activeSheet) {
    return null;
  }

  return (
    <main className="visualEditorShell">
      <section className="visualToolbar" aria-label="Visual editor toolbar">
        <div className="visualToolbarGroup visualToolbarIdentity">
          <span className="visualCellAddress">{selectedLabel}</span>
          <textarea
            className="visualFormulaInput visualFormulaArea"
            aria-label="Selected cell source"
            rows={1}
            value={selectedSourceText}
            onChange={(event) => commit((current) => updateCellSource(current, selected, event.target.value))}
          />
        </div>

        <div className="visualToolbarGroup visualScopeSwitch" role="tablist" aria-label="Property scope">
          {(["cell", "row"] as const).map((scope) => (
            <button
              key={scope}
              type="button"
              role="tab"
              aria-selected={modifierScope === scope}
              className={modifierScope === scope ? "active" : ""}
              onClick={() => setModifierScope(scope)}
            >
              {scope}
            </button>
          ))}
        </div>

        <div className="visualToolbarGroup">
          <button
            type="button"
            className={`glassButton iconButton ${hasScopedModifier(activeSheet, selected, modifierScope, "bold") ? "active" : ""}`}
            aria-label="Bold"
            title="Bold"
            onClick={() => handleToggleModifier("bold")}
          >
            <strong>B</strong>
          </button>
          <button
            type="button"
            className={`glassButton iconButton ${hasScopedModifier(activeSheet, selected, modifierScope, "italic") ? "active" : ""}`}
            aria-label="Italic"
            title="Italic"
            onClick={() => handleToggleModifier("italic")}
          >
            <em>I</em>
          </button>
          <label className="colorTool" title="Text color" aria-label="Text color">
            <span>A</span>
            <input type="color" value={selectedTextColor} onChange={(event) => handleSetColor("color", event.target.value)} />
          </label>
          <label className="colorTool fillTool" title="Fill color" aria-label="Fill color">
            <ToolbarIcon name="paint" />
            <input type="color" value={selectedFillColor} onChange={(event) => handleSetColor("bg", event.target.value)} />
          </label>
        </div>

        <div className="visualToolbarGroup">
          <button type="button" className="glassButton iconButton" aria-label="Merge with left" title="Merge with left" onClick={() => commit((current) => mergeCell(current, selected, "left"))}>
            <ToolbarIcon name="mergeLeft" />
          </button>
          <button type="button" className="glassButton iconButton" aria-label="Merge with top" title="Merge with top" onClick={() => commit((current) => mergeCell(current, selected, "up"))}>
            <ToolbarIcon name="mergeUp" />
          </button>
        </div>

        <div className="visualToolbarGroup">
          <button type="button" className="glassButton iconButton" aria-label="New row" title="New row" onClick={() => commit((current) => addRow(current, activeSheetIndex))}>
            <ToolbarIcon name="row" />
          </button>
          <button type="button" className="glassButton iconButton" aria-label="New column" title="New column" onClick={() => commit((current) => addColumn(current, activeSheetIndex))}>
            <ToolbarIcon name="column" />
          </button>
          <button type="button" className="glassButton iconButton primaryAction" aria-label="New sheet" title="New sheet" onClick={handleAddSheet}>
            <ToolbarIcon name="sheet" />
          </button>
          <button
            type="button"
            className="glassButton iconButton"
            aria-label="Delete sheet"
            title="Delete sheet"
            disabled={workbook.sheets.length <= 1}
            onClick={handleRemoveSheet}
          >
            <ToolbarIcon name="trash" />
          </button>
        </div>

        <button type="button" className="glassButton iconTextButton visualSourceButton" onClick={onOpenSource}>
          <ToolbarIcon name="format" />
          <span>Source</span>
        </button>
      </section>

      <section className="visualWorkbook" aria-label="Visual spreadsheet editor">
        <div className="visualSheetTabs" role="tablist" aria-label="Workbook sheets">
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
            className="sheetNameInput"
            aria-label="Rename active sheet"
            value={activeSheet.name}
            onChange={(event) => commit((current) => renameSheet(current, activeSheetIndex, event.target.value))}
          />
        </div>

        <div className="visualGridWrap">
          <table className="visualGrid">
            <thead>
              <tr>
                <th className="visualCorner" />
                {Array.from({ length: visibleColumnCount }, (_, colIndex) => (
                  <th key={colIndex} className="visualColumnHeader">{getColumnName(colIndex)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: visibleRowCount }, (_, rowIndex) => {
                const row = activeSheet.rows[rowIndex];
                return (
                  <tr key={rowIndex} className={row?.kind === "header" ? "visualHeaderRow" : undefined}>
                    <th className="visualRowHeader">
                      <span>{rowIndex + 1}</span>
                      {row?.kind === "header" ? <span className="visualHeaderBadge">Header</span> : null}
                    </th>
                    {Array.from({ length: visibleColumnCount }, (_, colIndex) => {
                      const cell = getCellAt(activeSheet, rowIndex, colIndex);
                      const isSelected = selected.sheetIndex === activeSheetIndex && selected.rowIndex === rowIndex && selected.colIndex === colIndex;
                      const computed = computedValues[`${activeSheetIndex}:${rowIndex}:${colIndex}`];
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
                              commit((current) => updateCellRaw(current, nextAddress, event.target.value));
                            }}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
