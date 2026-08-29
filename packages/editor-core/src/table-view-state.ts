import { findDefaultView } from "../../core/src/index.js";
import type { SheetView } from "../../core/src/index.js";
import type { SheetTableViewState } from "./model.js";

export function getInitialSheetTableViewState(views: readonly SheetView[]): SheetTableViewState {
  const view = findDefaultView(views);
  return view ? savedViewState(view, true) : { enabled: false, columns: [] };
}

export function reconcileSheetTableViewState(
  views: readonly SheetView[],
  current: SheetTableViewState | undefined
): SheetTableViewState {
  if (!current) return getInitialSheetTableViewState(views);
  if (current.selectedSavedView === undefined) return cloneTableViewState(current);
  const view = views.find((candidate) => candidate.name === current.selectedSavedView);
  return view ? savedViewState(view, current.enabled) : getInitialSheetTableViewState(views);
}

export function cloneTableViewState(state: SheetTableViewState): SheetTableViewState {
  return {
    enabled: state.enabled,
    columns: state.columns.map((rule) => ({ ...rule })),
    ...(state.selectedSavedView === undefined ? {} : { selectedSavedView: state.selectedSavedView })
  };
}

function savedViewState(view: SheetView, enabled: boolean): SheetTableViewState {
  return {
    enabled,
    columns: view.columns.map((rule) => ({ ...rule })),
    selectedSavedView: view.name
  };
}
