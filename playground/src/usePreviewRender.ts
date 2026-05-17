import { useDeferredValue, useEffect, useRef, useState } from "react";
import type { Diagnostic } from "@cello/core";
import { renderDebounceMs } from "./playgroundConfig";
import { renderPreview } from "./preview";

export type RenderState = "idle" | "rendering" | "failed";

interface PreviewState {
  diagnostics: Diagnostic[];
  lastGoodHtml: string;
  previewHtml: string;
  renderState: RenderState;
}

const initialPreviewState: PreviewState = {
  diagnostics: [],
  lastGoodHtml: "",
  previewHtml: "",
  renderState: "rendering"
};

export function usePreviewRender(source: string): PreviewState {
  const deferredSource = useDeferredValue(source);
  const [state, setState] = useState<PreviewState>(initialPreviewState);
  const renderRun = useRef(0);

  useEffect(() => {
    const runId = ++renderRun.current;
    const timeout = window.setTimeout(() => {
      setState((current) => ({ ...current, renderState: "rendering" }));

      void renderPreview(deferredSource)
        .then((result) => {
          if (runId !== renderRun.current) {
            return;
          }
          setState({
            diagnostics: result.diagnostics,
            lastGoodHtml: result.html,
            previewHtml: result.html,
            renderState: "idle"
          });
        })
        .catch((error: unknown) => {
          if (runId !== renderRun.current) {
            return;
          }
          const message = error instanceof Error ? error.message : String(error);
          setState((current) => ({
            diagnostics: [{ level: "error", message: `Render failed: ${message}` }],
            lastGoodHtml: current.lastGoodHtml,
            previewHtml: current.lastGoodHtml,
            renderState: "failed"
          }));
        });
    }, renderDebounceMs);

    return () => window.clearTimeout(timeout);
  }, [deferredSource]);

  return state;
}
