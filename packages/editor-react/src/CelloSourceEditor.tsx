import { lazy, Suspense, useCallback, useRef } from "react";
import type { EditorSession } from "../../editor-core/src/internal.js";
import { useEditorSession } from "./useEditorSession.js";

const typingMergeWindowMs = 1000;

interface TypingGroup {
  id: number;
  inputType: string;
  lastInputAt: number;
}

export interface CelloSourceEditorProps {
  session: EditorSession;
  ariaLabel?: string;
  className?: string;
  readOnly?: boolean;
  showToolbar?: boolean;
}

const CodeMirrorSourceSurface = lazy(async () => ({
  default: (await import("./CodeMirrorSourceSurface.js")).CodeMirrorSourceSurface
}));

/** A syntax-highlighted source view backed by the shared editor session. */
export function CelloSourceEditor({ session, ariaLabel = "Cello source", className, readOnly = false, showToolbar = true }: CelloSourceEditorProps) {
  const snapshot = useEditorSession(session);
  const typingGroupRef = useRef<TypingGroup>({ id: 0, inputType: "", lastInputAt: 0 });

  const updateSource = useCallback(
    (source: string, inputType: string) => {
      const now = Date.now();
      const typingGroup = typingGroupRef.current;
      if (typingGroup.inputType !== inputType || now - typingGroup.lastInputAt > typingMergeWindowMs) {
        typingGroup.id += 1;
      }
      typingGroup.inputType = inputType;
      typingGroup.lastInputAt = now;
      session.setSource(source, {
        history: "merge",
        historyGroup: `source-input-${typingGroup.id}`
      });
    },
    [session]
  );
  const undo = useCallback(() => {
    typingGroupRef.current.lastInputAt = 0;
    session.undo("source");
  }, [session]);
  const redo = useCallback(() => {
    typingGroupRef.current.lastInputAt = 0;
    session.redo("source");
  }, [session]);

  const shellClassName = ["celloSourceEditor", className].filter(Boolean).join(" ");
  return (
    <section className={shellClassName} data-revision={snapshot.revision}>
      {showToolbar ? (
        <div className="celloSourceToolbar" role="toolbar" aria-label="Source formatting and history">
          <button type="button" disabled={readOnly || !snapshot.histories.source.canUndo} onClick={undo}>
            Undo
          </button>
          <button type="button" disabled={readOnly || !snapshot.histories.source.canRedo} onClick={redo}>
            Redo
          </button>
          <button
            type="button"
            disabled={readOnly}
            onClick={() => {
              session.format("compact");
            }}
          >
            Compact
          </button>
          <button
            type="button"
            disabled={readOnly}
            onClick={() => {
              session.format("pretty");
            }}
          >
            Pretty
          </button>
        </div>
      ) : null}
      <Suspense
        fallback={
          <div className="celloSourceLoading" role="status">
            Loading source editor…
          </div>
        }
      >
        <CodeMirrorSourceSurface
          ariaLabel={ariaLabel}
          onBlur={() => {
            typingGroupRef.current.lastInputAt = 0;
          }}
          onChange={updateSource}
          onRedo={redo}
          onUndo={undo}
          readOnly={readOnly}
          source={snapshot.source}
        />
      </Suspense>
    </section>
  );
}
