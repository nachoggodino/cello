import type {
  Dispatch,
  KeyboardEvent as ReactKeyboardEvent,
  RefObject,
  SetStateAction
} from "react";
import {
  getCellAddressKey,
  getCellAt,
  getCellContentText,
  getCellFormattedDisplayText,
  getCellSourceText,
  getCellToneClass,
  getColumnName,
  getDefaultCellAt,
  getVisualCellContentStyle,
  getVisualCellSpan,
  getVisualCellStyle,
  isAddressInRange,
  updateDefaultCellSource
} from "@nachoggodino/cello/editor-core";
import type {
  CellAddress,
  CellRange,
  ComputedCellValues,
  EditorSheet,
  EditorWorkbook
} from "@nachoggodino/cello/editor-core";
import type { ModifierScope } from "../derivedSelection.js";
import { withMeasuredFitWidth } from "../fitColumns.js";
import type { FitColumnWidths } from "../fitColumns.js";
import { getGridCellId } from "../interactions/grid.js";
import type { SelectionKind } from "../selection.js";
import {
  renderFormulaHighlight,
  renderInlineDisplay
} from "../textPresentation.js";
import type { CelloVisualEditorLabels } from "../types.js";

export interface EditingDraft {
  address: CellAddress;
  entry: "pointer" | "f2" | "replace";
  original: string;
  value: string;
}

type DraftCell = { key: string; value: string } | null;
type GridMode = "navigate" | "edit";

export function VisualConfigurationScaffold({
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
              onBlur={(event) =>
                onHeaderCommit(colIndex, event.currentTarget.value)
              }
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
              onBlur={(event) =>
                onDefaultCommit(colIndex, event.currentTarget.value)
              }
              onKeyDown={blurOnEnter}
            />
          </td>
        ))}
      </tr>
    </>
  );
}

export function VisualDataRows({
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
  enterEditMode: (
    address: CellAddress,
    entry: EditingDraft["entry"],
    value?: string
  ) => void;
  selectCell: (
    rowIndex: number,
    colIndex: number,
    extendRange?: boolean
  ) => void;
  selectRow: (rowIndex: number, extendRange: boolean) => void;
  selectDefaultCell: (colIndex: number) => void;
  setEditingDraft: Dispatch<SetStateAction<EditingDraft | null>>;
  selected: CellAddress;
  selectedRange: CellRange;
  selectedDefaultCol: number | null;
  visibleColumnCount: number;
}) {
  const rows = [
    <tr
      key={rowIndex}
      role="row"
      aria-rowindex={rowIndex + 1}
      className={
        activeSheet.rows[rowIndex]?.kind === "header"
          ? "celloVisualHeaderRow"
          : undefined
      }
    >
      <th
        role="rowheader"
        aria-rowindex={rowIndex + 1}
        aria-selected={
          modifierScope === "row" &&
          rowIndex >= selectedRange.startRow &&
          rowIndex <= selectedRange.endRow
        }
        className={[
          "celloVisualRowHeader",
          modifierScope === "row" &&
          rowIndex >= selectedRange.startRow &&
          rowIndex <= selectedRange.endRow
            ? "selectedHeader"
            : "",
          modifierScope !== "column" && selected.rowIndex === rowIndex
            ? "activeHeader"
            : "",
          modifierScope === "row" &&
          selectedDefaultCol === null &&
          selected.rowIndex === rowIndex
            ? "selectedRow"
            : ""
        ].filter(Boolean).join(" ")}
        onClick={(event) => selectRow(rowIndex, event.shiftKey)}
      >
        <span>{rowIndex + 1}</span>
        {activeSheet.rows[rowIndex]?.kind === "header" ? (
          <span className="celloVisualHeaderBadge">{labels.headerRow}</span>
        ) : null}
      </th>
      {Array.from({ length: visibleColumnCount }, (_, colIndex) => {
        const span = getVisualCellSpan(activeSheet, rowIndex, colIndex);
        if (span.hidden) {
          return null;
        }
        const cell = getCellAt(activeSheet, rowIndex, colIndex);
        const isSelected =
          selected.sheetIndex === activeSheetIndex &&
          selectedDefaultCol === null &&
          selected.rowIndex === rowIndex &&
          selected.colIndex === colIndex;
        const address = { sheetIndex: activeSheetIndex, rowIndex, colIndex };
        const isInRange = isAddressInRange(address, selectedRange);
        const cellKey = getCellAddressKey(address);
        const workbookContext = aliases ? { aliases } : {};
        const toneClass = getCellToneClass(
          activeSheet,
          rowIndex,
          colIndex,
          workbookContext
        );
        const isEditing = draftCell?.key === cellKey;
        const computed = computedValues[cellKey];
        const displayValue = getCellFormattedDisplayText(
          activeSheet,
          rowIndex,
          colIndex,
          computed,
          workbookContext
        );
        const inputValue =
          draftCell?.key === cellKey
            ? draftCell.value
            : getCellContentText(cell);
        const cellStyle = withMeasuredFitWidth(
          getVisualCellStyle(
            workbookContext,
            activeSheet,
            rowIndex,
            colIndex
          ),
          measuredFitColumnWidths[colIndex]
        );
        const contentStyle = getVisualCellContentStyle(
          workbookContext,
          activeSheet,
          rowIndex
        );
        const editorStyle = getVisualCellStyle(
          workbookContext,
          activeSheet,
          rowIndex,
          colIndex
        );
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
              isInRange && rowIndex === selectedRange.startRow
                ? "rangeTop"
                : "",
              isInRange &&
              rowIndex + span.rowspan - 1 === selectedRange.endRow
                ? "rangeBottom"
                : "",
              isInRange && colIndex === selectedRange.startCol
                ? "rangeLeft"
                : "",
              isInRange &&
              colIndex + span.colspan - 1 === selectedRange.endCol
                ? "rangeRight"
                : "",
              selectionKind === "cells" && selected.rowIndex === rowIndex
                ? "activeRowGuide"
                : "",
              selectionKind === "cells" && selected.colIndex === colIndex
                ? "activeColumnGuide"
                : "",
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
                <div
                  className="celloVisualCellDisplay"
                  style={{ ...editorStyle, ...contentStyle }}
                  aria-hidden="true"
                >
                  {renderInlineDisplay(displayValue)}
                </div>
              ) : null}
              {shouldHighlightFormula ? (
                <div
                  className="celloVisualCellFormulaHighlight"
                  aria-hidden="true"
                >
                  {renderFormulaHighlight(inputValue)}
                </div>
              ) : null}
              {isEditing || isSelected ? (
                <textarea
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
                    setEditingDraft((current) =>
                      current &&
                      getCellAddressKey(current.address) === cellKey
                        ? { ...current, value: event.target.value }
                        : current
                    );
                  }}
                />
              ) : null}
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
                  commit((current) =>
                    updateDefaultCellSource(
                      current,
                      activeSheetIndex,
                      colIndex,
                      event.target.value
                    )
                  );
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
