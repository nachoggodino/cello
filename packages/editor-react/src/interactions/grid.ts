import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  getVisibleColumnCount,
  getVisibleRowCount
} from "@nachoggodino/cello/editor-core";
import type {
  CellAddress,
  EditorWorkbook
} from "@nachoggodino/cello/editor-core";

export type MoveDirection = "up" | "down" | "left" | "right";

export function scrollSelectionNearEdge(
  container: HTMLElement,
  clientX: number,
  clientY: number
): void {
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

export function getGridCellId(address: CellAddress): string {
  return `cello-grid-cell-${address.sheetIndex}-${address.rowIndex}-${address.colIndex}`;
}

export function clampAddress(
  address: CellAddress,
  workbook: EditorWorkbook
): CellAddress {
  const sheetIndex = Math.max(
    0,
    Math.min(address.sheetIndex, workbook.sheets.length - 1)
  );
  const sheet = workbook.sheets[sheetIndex];
  const rowCount = getVisibleRowCount(sheet);
  const columnCount = getVisibleColumnCount(sheet);
  return {
    sheetIndex,
    rowIndex: Math.max(
      0,
      Math.min(address.rowIndex, Math.max(0, rowCount - 1))
    ),
    colIndex: Math.max(
      0,
      Math.min(address.colIndex, Math.max(0, columnCount - 1))
    )
  };
}

export function moveAddress(
  address: CellAddress,
  direction: MoveDirection
): CellAddress {
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

export function keyToDirection(key: string): MoveDirection | undefined {
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

export function isPrintableKey(event: ReactKeyboardEvent): boolean {
  return (
    event.key.length === 1 &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey
  );
}
