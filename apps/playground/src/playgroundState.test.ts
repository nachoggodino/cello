import { describe, expect, it } from "vitest";
import { defaultExampleId, getExample } from "./examples";
import { loadStoredState, saveStoredState, storageKey } from "./playgroundState";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

class ThrowingStorage extends MemoryStorage {
  override getItem(): string | null {
    throw new Error("storage blocked");
  }

  override setItem(): void {
    throw new Error("storage blocked");
  }
}

describe("playground state", () => {
  it("loads the default example when storage is empty", () => {
    expect(loadStoredState(new MemoryStorage())).toEqual({
      exampleId: defaultExampleId,
      source: getExample(defaultExampleId).source
    });
  });

  it("normalizes invalid stored example ids", () => {
    const storage = new MemoryStorage();
    storage.setItem(storageKey, JSON.stringify({ exampleId: "missing", source: "custom" }));

    expect(loadStoredState(storage)).toEqual({
      exampleId: defaultExampleId,
      source: "custom"
    });
  });

  it("falls back when storage is unavailable", () => {
    expect(loadStoredState(new ThrowingStorage())).toEqual({
      exampleId: defaultExampleId,
      source: getExample(defaultExampleId).source
    });
    expect(saveStoredState(new ThrowingStorage(), { exampleId: "basic", source: "x" })).toBe(false);
  });

  it("saves serialized state when storage is available", () => {
    const storage = new MemoryStorage();

    expect(saveStoredState(storage, { exampleId: "basic", source: "x" })).toBe(true);
    expect(storage.getItem(storageKey)).toBe(JSON.stringify({ exampleId: "basic", source: "x" }));
  });
});
