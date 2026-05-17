import { defaultExampleId, getExample } from "./examples";

export const storageKey = "cello-playground:v1";

export interface StoredState {
  exampleId: string;
  source: string;
}

export function loadStoredState(storage: Storage): StoredState {
  const fallback = getExample(defaultExampleId);
  try {
    const raw = storage.getItem(storageKey);
    if (!raw) {
      return { exampleId: fallback.id, source: fallback.source };
    }
    const parsed = JSON.parse(raw) as Partial<StoredState>;
    const example = getExample(parsed.exampleId ?? fallback.id);
    return {
      exampleId: example.id,
      source: typeof parsed.source === "string" ? parsed.source : example.source
    };
  } catch {
    return { exampleId: fallback.id, source: fallback.source };
  }
}

export function saveStoredState(storage: Storage, state: StoredState): boolean {
  try {
    storage.setItem(storageKey, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
