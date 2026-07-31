import { useLayoutEffect, useState } from "react";
import type { CSSProperties, RefObject } from "react";
import { CELL_LAYOUT_METRICS, getCellAddressKey, getCellFitMeasureText, getCellStyle, getColumnWidthValue, isColumnFit } from "../../editor-core/src/internal.js";
import type { ComputedCellValues, EditorSheet, EditorWorkbook } from "../../editor-core/src/internal.js";

const fitColumnMeasurementGuardPx = 2;

export type FitColumnWidths = Readonly<Record<number, number>>;

export interface FitMeasureEntry {
  id: string;
  colIndex: number;
  text: string;
  style: CSSProperties;
}

export function useMeasuredFitColumnWidths(measureRef: RefObject<HTMLDivElement | null>, entries: FitMeasureEntry[]): FitColumnWidths {
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

export function getFitMeasureEntries(
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

export function withMeasuredFitWidth(style: CSSProperties, measuredWidth: number | undefined): CSSProperties {
  if (measuredWidth === undefined) {
    return style;
  }
  const width = `${measuredWidth}px`;
  return { ...style, width, minWidth: width, maxWidth: width };
}

export function formatMeasuredWidth(width: number | undefined): string | undefined {
  return width === undefined ? undefined : `${width}px`;
}

function isResolvedFitColumn(sheet: EditorSheet, rowIndex: number, colIndex: number): boolean {
  const explicitWidth = getColumnWidthValue(sheet, rowIndex, colIndex);
  return isColumnFit(sheet, rowIndex, colIndex) || (!explicitWidth && sheet.layout?.columns === "fit");
}

function areFitWidthsEqual(current: FitColumnWidths, next: FitColumnWidths): boolean {
  const currentKeys = Object.keys(current);
  const nextKeys = Object.keys(next);
  return currentKeys.length === nextKeys.length && nextKeys.every((key) => current[Number(key)] === next[Number(key)]);
}
