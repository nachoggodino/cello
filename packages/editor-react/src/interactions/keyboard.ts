import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import type { CellAddress } from "@nachoggodino/cello/editor-core";
import type { EditingDraft } from "../components/gridRows.js";
import {
  isPrintableKey,
  keyToDirection
} from "./grid.js";
import type { MoveDirection } from "./grid.js";

export interface GridKeyboardActions {
  cancelEditing: () => void;
  clearSelection: () => void;
  commitAndMove: (direction: MoveDirection) => void;
  copy: () => void;
  cut: () => void;
  enterEditMode: (
    address: CellAddress,
    entry: EditingDraft["entry"],
    value?: string
  ) => void;
  move: (direction: MoveDirection, extendRange: boolean) => void;
  paste: (text: string) => void;
  redo: () => void;
  undo: () => void;
}

export function handleGridKeyDown(
  event: ReactKeyboardEvent,
  {
  actions,
  editingEntry,
  editing,
  selected
}: {
  actions: GridKeyboardActions;
  editingEntry: EditingDraft["entry"] | undefined;
  editing: boolean;
  selected: CellAddress;
}): void {
  if (editing) {
    handleEditingKey(event, editingEntry, actions);
    return;
  }
  handleNavigationKey(event, selected, actions);
}

function handleEditingKey(
  event: ReactKeyboardEvent,
  editingEntry: EditingDraft["entry"] | undefined,
  actions: GridKeyboardActions
): void {
  if (event.key === "Escape") {
    event.preventDefault();
    actions.cancelEditing();
    return;
  }
  const editDirection = keyToDirection(event.key);
  if (editDirection) {
    if (
      editingEntry === "pointer" &&
      (editDirection === "left" || editDirection === "right")
    ) {
      return;
    }
    event.preventDefault();
    actions.commitAndMove(editDirection);
    return;
  }
  if (event.key === "Enter") {
    if (event.shiftKey) {
      return;
    }
    event.preventDefault();
    actions.commitAndMove("down");
    return;
  }
  if (event.key === "Tab") {
    event.preventDefault();
    actions.commitAndMove(event.shiftKey ? "left" : "right");
  }
}

function handleNavigationKey(
  event: ReactKeyboardEvent,
  selected: CellAddress,
  actions: GridKeyboardActions
): void {
  const key = event.key.toLowerCase();
  const isMeta = event.metaKey || event.ctrlKey;
  if (isMeta && key === "z" && !event.shiftKey) {
    event.preventDefault();
    actions.undo();
    return;
  }
  if (
    (isMeta && event.shiftKey && key === "z") ||
    (event.ctrlKey && key === "y")
  ) {
    event.preventDefault();
    actions.redo();
    return;
  }
  if (isMeta && key === "c") {
    event.preventDefault();
    actions.copy();
    return;
  }
  if (isMeta && key === "x") {
    event.preventDefault();
    actions.cut();
    return;
  }
  if (isMeta && key === "v") {
    const clipboard = navigator.clipboard as Clipboard | undefined;
    if (clipboard) {
      event.preventDefault();
      void clipboard
        .readText()
        .then(actions.paste)
        .catch(() => undefined);
    }
    return;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    actions.cancelEditing();
    return;
  }
  if (event.key === "F2") {
    event.preventDefault();
    actions.enterEditMode(selected, "f2");
    return;
  }
  const direction = keyToDirection(event.key);
  if (direction) {
    event.preventDefault();
    actions.move(direction, event.shiftKey);
    return;
  }
  if (event.key === "Enter") {
    event.preventDefault();
    actions.move("down", false);
    return;
  }
  if (event.key === "Backspace" || event.key === "Delete") {
    event.preventDefault();
    actions.clearSelection();
    return;
  }
  if (isPrintableKey(event)) {
    event.preventDefault();
    actions.enterEditMode(selected, "replace", event.key);
  }
}
