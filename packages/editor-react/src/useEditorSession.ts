import { useSyncExternalStore } from "react";
import type {
  EditorSession,
  EditorSessionSnapshot
} from "@nachoggodino/cello/editor-core";

/** Subscribes a React view to a synchronous framework-independent editor session. */
export function useEditorSession(session: EditorSession): EditorSessionSnapshot {
  return useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot
  );
}
