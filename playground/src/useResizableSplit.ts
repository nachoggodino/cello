import { useCallback, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { splitPane } from "./playgroundConfig";

interface DragState {
  startBasis: number;
  startX: number;
}

function clampEditorBasis(value: number): number {
  return Math.min(splitPane.max, Math.max(splitPane.min, value));
}

export function useResizableSplit() {
  const [editorBasis, setEditorBasis] = useState<number>(splitPane.initial);
  const dragState = useRef<DragState | null>(null);

  const resizeEditor = useCallback((nextBasis: number) => {
    setEditorBasis(clampEditorBasis(nextBasis));
  }, []);

  const onDividerPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      dragState.current = { startX: event.clientX, startBasis: editorBasis };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [editorBasis]
  );

  const onDividerPointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const drag = dragState.current;
    const container = event.currentTarget.parentElement;
    if (!drag || !container) {
      return;
    }
    const delta = ((event.clientX - drag.startX) / container.clientWidth) * 100;
    setEditorBasis(clampEditorBasis(drag.startBasis + delta));
  }, []);

  const stopDrag = useCallback(() => {
    dragState.current = null;
  }, []);

  const onDividerKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "ArrowLeft") {
        resizeEditor(editorBasis - splitPane.keyboardStep);
        event.preventDefault();
        return;
      }
      if (event.key === "ArrowRight") {
        resizeEditor(editorBasis + splitPane.keyboardStep);
        event.preventDefault();
        return;
      }
      if (event.key === "Home") {
        resizeEditor(splitPane.min);
        event.preventDefault();
        return;
      }
      if (event.key === "End") {
        resizeEditor(splitPane.max);
        event.preventDefault();
      }
    },
    [editorBasis, resizeEditor]
  );

  return {
    editorBasis,
    onDividerKeyDown,
    onDividerPointerDown,
    onDividerPointerMove,
    splitPane,
    stopDrag
  };
}
