import { useSyncExternalStore } from "react";
import type { EditorSession, EditorSessionSnapshot } from "../../editor-core/src/internal.js";

/** Subscribes a React view to a synchronous framework-independent editor session. */
export function useEditorSession(session: EditorSession): EditorSessionSnapshot {
  return useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
}
