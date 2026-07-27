// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@cello/editor-core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@cello/editor-core")>()),
  evaluateEditorWorkbookSource: vi.fn().mockRejectedValue(new Error("Evaluation failed"))
}));

const { CelloVisualEditor } = await import("@cello/editor-react");

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
    root = undefined;
  }
  document.body.replaceChildren();
});

describe("CelloVisualEditor evaluation failures", () => {
  it("keeps the editor shell available when computed value loading fails", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    act(() => {
      root?.render(<CelloVisualEditor source="@sheet Report\n| Ada |" onSourceChange={vi.fn()} />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(document.querySelector("main.celloVisualEditorShell")).toBeTruthy();
    expect(document.querySelector("[aria-label='Visual spreadsheet editor']")).toBeTruthy();
  });
});
