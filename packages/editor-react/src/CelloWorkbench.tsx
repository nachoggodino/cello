import { useId, useState } from "react";
import type { KeyboardEvent } from "react";
import type { EditorSession } from "@nachoggodino/cello/editor-core";
import { CelloHtmlPreview } from "./CelloHtmlPreview.js";
import type { CelloHtmlPreviewProps } from "./CelloHtmlPreview.js";
import { CelloSourceEditor } from "./CelloSourceEditor.js";
import type { CelloSourceEditorProps } from "./CelloSourceEditor.js";
import { CelloVisualEditor } from "./CelloVisualEditor.js";
import type { SessionCelloVisualEditorProps } from "./types.js";

export type CelloWorkbenchView = "source" | "visual" | "preview";

export interface CelloWorkbenchProps {
  session: EditorSession;
  activeView?: CelloWorkbenchView;
  defaultActiveView?: CelloWorkbenchView;
  views?: readonly CelloWorkbenchView[];
  labels?: Partial<Record<CelloWorkbenchView, string>>;
  className?: string;
  sourceEditorProps?: Omit<CelloSourceEditorProps, "session">;
  visualEditorProps?: Omit<SessionCelloVisualEditorProps, "session">;
  htmlPreviewProps?: Omit<CelloHtmlPreviewProps, "session">;
  onActiveViewChange?: (view: CelloWorkbenchView) => void;
}

const defaultViews: readonly [CelloWorkbenchView, ...CelloWorkbenchView[]] = [
  "source",
  "visual",
  "preview"
];
const defaultLabels: Record<CelloWorkbenchView, string> = {
  source: "Source",
  visual: "Visual editor",
  preview: "Preview"
};

/** Optional tabbed shell for hosts that want all three session-backed views. */
export function CelloWorkbench({
  session,
  activeView,
  defaultActiveView = "source",
  views = defaultViews,
  labels,
  className,
  sourceEditorProps,
  visualEditorProps,
  htmlPreviewProps,
  onActiveViewChange
}: CelloWorkbenchProps) {
  const id = useId();
  const availableViews = normalizeViews(views);
  const [internalView, setInternalView] = useState(defaultActiveView);
  const selectedView = availableViews.includes(activeView ?? internalView)
    ? activeView ?? internalView
    : availableViews[0];

  const selectView = (view: CelloWorkbenchView) => {
    if (activeView === undefined) {
      setInternalView(view);
    }
    onActiveViewChange?.(view);
  };

  const requestSourceView = () => {
    selectView("source");
    visualEditorProps?.onRequestSourceView?.();
  };

  const handleTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    view: CelloWorkbenchView
  ) => {
    const offset = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (offset === 0) {
      return;
    }
    event.preventDefault();
    const currentIndex = availableViews.indexOf(view);
    const nextIndex = (currentIndex + offset + availableViews.length) % availableViews.length;
    const nextView = availableViews[nextIndex] ?? availableViews[0];
    selectView(nextView);
    document.getElementById(`${id}-tab-${nextView}`)?.focus();
  };

  const shellClassName = ["celloWorkbench", className].filter(Boolean).join(" ");
  return (
    <section className={shellClassName}>
      <div className="celloWorkbenchTabs" role="tablist" aria-label="Workbook views">
        {availableViews.map((view) => (
          <button
            aria-controls={`${id}-panel-${view}`}
            aria-selected={selectedView === view}
            id={`${id}-tab-${view}`}
            key={view}
            onKeyDown={(event) => { handleTabKeyDown(event, view); }}
            onClick={() => { selectView(view); }}
            role="tab"
            tabIndex={selectedView === view ? 0 : -1}
            type="button"
          >
            {labels?.[view] ?? defaultLabels[view]}
          </button>
        ))}
      </div>
      <div
        aria-labelledby={`${id}-tab-${selectedView}`}
        className="celloWorkbenchPanel"
        id={`${id}-panel-${selectedView}`}
        role="tabpanel"
      >
        {selectedView === "source" ? (
          <CelloSourceEditor {...sourceEditorProps} session={session} />
        ) : selectedView === "visual" ? (
          <CelloVisualEditor
            {...visualEditorProps}
            session={session}
            onRequestSourceView={requestSourceView}
          />
        ) : (
          <CelloHtmlPreview {...htmlPreviewProps} session={session} />
        )}
      </div>
    </section>
  );
}

function normalizeViews(
  views: readonly CelloWorkbenchView[]
): readonly [CelloWorkbenchView, ...CelloWorkbenchView[]] {
  const uniqueViews = [...new Set(views)];
  const firstView = uniqueViews[0];
  return firstView === undefined ? defaultViews : [firstView, ...uniqueViews.slice(1)];
}
