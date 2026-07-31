import { useCallback, useEffect, useRef, useState } from "react";
import type { EditorSession } from "@nachoggodino/cello/editor-core";
import { render } from "../../core/src/renderer/render.js";
import type { RenderOptions } from "../../core/src/shared/types.js";
import { synchronizePreviewSheet } from "./previewDom.js";
import { useEditorSession } from "./useEditorSession.js";

export type CelloPreviewStatus = "idle" | "rendering" | "ready" | "error";

export interface CelloPreviewState {
  revision: number;
  html: string;
  status: CelloPreviewStatus;
  error?: string;
}

export interface CelloHtmlPreviewProps {
  session: EditorSession;
  className?: string;
  debounceMs?: number;
  iframeTitle?: string;
  sandbox?: string;
  renderOptions?: RenderOptions;
  renderSource?: (source: string) => Promise<string>;
  onFrameLoad?: (frame: HTMLIFrameElement) => void;
  onStateChange?: (state: CelloPreviewState) => void;
}

const initialState: CelloPreviewState = {
  revision: -1,
  html: "",
  status: "idle"
};

/** A read-only HTML view that never publishes output from a stale source revision. */
export function CelloHtmlPreview({
  session,
  className,
  debounceMs = 0,
  iframeTitle = "Cello HTML preview",
  sandbox = "allow-scripts allow-same-origin",
  renderOptions,
  renderSource,
  onFrameLoad,
  onStateChange
}: CelloHtmlPreviewProps) {
  const snapshot = useEditorSession(session);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [state, setState] = useState<CelloPreviewState>(initialState);

  useEffect(() => {
    let cancelled = false;
    const revision = snapshot.revision;
    const timeout = window.setTimeout(() => {
      setState((current) => ({
        revision,
        html: current.html,
        status: "rendering"
      }));
      const renderPromise = renderSource
        ? renderSource(snapshot.source)
        : renderDefaultPreview(session, snapshot.source, renderOptions);
      void renderPromise.then(
        (html) => {
          if (!cancelled && session.isCurrentRevision(revision)) {
            setState({ revision, html, status: "ready" });
          }
        },
        (error: unknown) => {
          if (!cancelled && session.isCurrentRevision(revision)) {
            setState((current) => ({
              ...current,
              revision,
              status: "error",
              error: error instanceof Error ? error.message : String(error)
            }));
          }
        }
      );
    }, debounceMs);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [debounceMs, renderOptions, renderSource, session, snapshot.revision, snapshot.source]);

  useEffect(() => {
    onStateChange?.(state);
  }, [onStateChange, state]);

  const synchronizeSheet = useCallback(() => {
    const document = frameRef.current?.contentDocument;
    if (document) {
      synchronizePreviewSheet(document, snapshot.activeSheetName, (sheetName) => {
        session.setActiveSheetName(sheetName);
      });
    }
  }, [session, snapshot.activeSheetName]);
  const handleFrameLoad = useCallback(() => {
    synchronizeSheet();
    const frame = frameRef.current;
    if (frame) {
      onFrameLoad?.(frame);
    }
  }, [onFrameLoad, synchronizeSheet]);

  useEffect(() => {
    synchronizeSheet();
  }, [state.html, synchronizeSheet]);

  const shellClassName = ["celloHtmlPreview", className].filter(Boolean).join(" ");
  return (
    <section className={shellClassName} data-preview-status={state.status} data-revision={state.revision}>
      {state.error ? <div className="celloPreviewError" role="alert">{state.error}</div> : null}
      <iframe
        className="celloPreviewFrame"
        onLoad={handleFrameLoad}
        ref={frameRef}
        sandbox={sandbox}
        srcDoc={state.html}
        title={iframeTitle}
      />
    </section>
  );
}

function renderDefaultPreview(
  session: EditorSession,
  source: string,
  renderOptions: RenderOptions | undefined
): Promise<string> {
  const sessionOptions = session.getDocumentOptions();
  return render(source, {
    ...(sessionOptions.baseDir === undefined ? {} : { baseDir: sessionOptions.baseDir }),
    ...(sessionOptions.readExternalSource === undefined
      ? {}
      : { readExternalSource: sessionOptions.readExternalSource }),
    ...(sessionOptions.strict === undefined ? {} : { strict: sessionOptions.strict }),
    ...renderOptions,
    interactive: true
  });
}
