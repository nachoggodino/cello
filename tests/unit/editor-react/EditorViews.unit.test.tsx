// @vitest-environment jsdom

import { act } from "react";
import type { ReactNode } from "react";
import { EditorView } from "@codemirror/view";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createEditorSession } from "../../../packages/editor-core/src/session.js";
import {
  CelloHtmlPreview,
  CelloSourceEditor,
  CelloVisualEditor,
  CelloWorkbench
} from "../../../packages/editor-react/src/index.js";
import { synchronizePreviewSheet } from "../../../packages/editor-react/src/previewDom.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

Object.defineProperties(Range.prototype, {
  getBoundingClientRect: { value: () => new DOMRect() },
  getClientRects: { value: () => [] }
});

let root: Root | undefined;

beforeAll(async () => {
  await import("../../../packages/editor-react/src/CodeMirrorSourceSurface.js");
});

afterEach(async () => {
  if (root) {
    await act(async () => {
      root?.unmount();
    });
    root = undefined;
  }
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("session-backed editor views", () => {
  it("keeps the source editor synchronized and routes keyboard undo through source history", async () => {
    const session = createEditorSession({ source: "| A |" });
    await renderView(<CelloSourceEditor session={session} />);
    const editor = getSourceEditor("Cello source");

    changeSourceEditor(editor, "| AB |");
    expect(session.getSnapshot()).toMatchObject({
      source: "| AB |",
      revision: 1,
      histories: { source: { canUndo: true } }
    });

    await act(async () => {
      editor.dispatchEvent(new KeyboardEvent("keydown", {
        bubbles: true,
        ctrlKey: true,
        key: "z"
      }));
    });

    expect(session.getSnapshot().source).toBe("| A |");
    expect(getSourceEditorView(editor).state.doc.toString()).toBe("| A |");
  });

  it("formats source through the toolbar and exposes history availability", async () => {
    const session = createEditorSession({
      source: "@sheet Report\n| A | 1 |\n| Longer | 22 |"
    });
    await renderView(<CelloSourceEditor session={session} />);

    clickButton("Pretty");
    expect(session.getSnapshot().source).toBe(
      "@sheet Report\n| A      | 1  |\n| Longer | 22 |"
    );
    expect(getButton("Undo").disabled).toBe(false);

    clickButton("Undo");
    expect(session.getSnapshot().source).toBe(
      "@sheet Report\n| A | 1 |\n| Longer | 22 |"
    );
    expect(getButton("Redo").disabled).toBe(false);

    clickButton("Redo");
    clickButton("Compact");
    expect(session.getSnapshot().source).toBe(
      "@sheet Report\n|A|1|\n|Longer|22|"
    );
  });

  it("supports a read-only source surface without the bundled toolbar", async () => {
    const session = createEditorSession({ source: "| A |" });
    session.setSource("| B |");
    await renderView(
      <CelloSourceEditor
        session={session}
        ariaLabel="Read-only source"
        className="hostSource"
        readOnly
        showToolbar={false}
      />
    );
    const editor = getSourceEditor("Read-only source");

    expect(editor.getAttribute("contenteditable")).toBe("false");
    expect(editor.getAttribute("aria-readonly")).toBe("true");
    expect(document.querySelector(".hostSource")).toBeTruthy();
    expect(document.querySelector("[role='toolbar']")).toBeNull();
    act(() => {
      editor.focus();
      editor.blur();
      editor.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "a" }));
      editor.dispatchEvent(new KeyboardEvent("keydown", {
        bubbles: true,
        ctrlKey: true,
        key: "z"
      }));
    });
    expect(session.getSnapshot().source).toBe("| B |");
  });

  it("renders line numbers and Cello syntax highlighting", async () => {
    const session = createEditorSession({
      source: "@sheet Report\n| =SUM(A1) | [bold] value |"
    });
    await renderView(<CelloSourceEditor session={session} showToolbar={false} />);

    expect(document.querySelector(".cm-lineNumbers")).toBeTruthy();
    expect(document.querySelector(".cm-activeLine")).toBeTruthy();
    expect(document.querySelector(".cm-activeLineGutter")).toBeTruthy();
    expect(document.querySelectorAll(".cm-line span").length).toBeGreaterThan(0);

    await act(async () => {
      getSourceEditor("Cello source").dispatchEvent(new KeyboardEvent("keydown", {
        bubbles: true,
        ctrlKey: true,
        key: "f"
      }));
    });
    expect(document.querySelector(".cm-search")).toBeTruthy();
  });

  it("discards HTML produced for stale revisions", async () => {
    const session = createEditorSession({ source: "| A |" });
    const resolvers = new Map<string, (html: string) => void>();
    const renderSource = vi.fn((source: string) =>
      new Promise<string>((resolve) => {
        resolvers.set(source, resolve);
      })
    );
    await renderView(
      <CelloHtmlPreview session={session} renderSource={renderSource} />
    );
    await flushTimer();

    await act(async () => {
      session.setSource("| B |");
    });
    await flushTimer();

    await resolvePreview(resolvers, "| B |", "<p>B</p>");
    expect(getPreviewFrame().getAttribute("srcdoc")).toBe("<p>B</p>");

    await resolvePreview(resolvers, "| A |", "<p>stale A</p>");
    expect(getPreviewFrame().getAttribute("srcdoc")).toBe("<p>B</p>");
  });

  it("reuses the session external-source resolver in the HTML preview", async () => {
    const readExternalSource = vi.fn(() => "name,amount\nAda,5");
    const session = createEditorSession({
      source: "@sheet Imported [csv]\n-> data.csv",
      readExternalSource
    });

    await renderView(<CelloHtmlPreview session={session} />);
    await flushTimer();

    expect(getPreviewFrame().getAttribute("srcdoc")).toContain("Ada");
    expect(readExternalSource).toHaveBeenCalledWith(
      "data.csv",
      expect.objectContaining({ resolvedPath: expect.stringContaining("data.csv") })
    );
  });

  it("reports preview errors without replacing the last successful HTML", async () => {
    const session = createEditorSession({ source: "| A |" });
    const onStateChange = vi.fn();
    await renderView(
      <CelloHtmlPreview
        session={session}
        onStateChange={onStateChange}
        renderSource={async () => {
          throw new Error("preview failed");
        }}
      />
    );
    await flushTimer();

    expect(document.querySelector("[role='alert']")?.textContent).toBe("preview failed");
    expect(getPreviewFrame().getAttribute("srcdoc")).toBe("");
    expect(onStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "error", error: "preview failed" })
    );
  });

  it("sandboxes rendered HTML by default", async () => {
    const session = createEditorSession({ source: "| A |" });
    await renderView(
      <CelloHtmlPreview session={session} renderSource={async () => "<p>A</p>"} />
    );
    await flushTimer();

    expect(getPreviewFrame().getAttribute("sandbox")).toBe("allow-scripts allow-same-origin");
  });

  it("exposes the loaded preview frame to its host", async () => {
    const session = createEditorSession({ source: "| A |" });
    const onFrameLoad = vi.fn();
    await renderView(
      <CelloHtmlPreview
        session={session}
        onFrameLoad={onFrameLoad}
        renderSource={async () => "<p>A</p>"}
      />
    );
    await flushTimer();
    const frame = getPreviewFrame();

    act(() => {
      frame.dispatchEvent(new Event("load"));
    });

    expect(onFrameLoad).toHaveBeenCalledWith(frame);
  });

  it("shares sheet selection from rendered preview tabs", () => {
    const document = new DOMParser().parseFromString(
      [
        "<button class='cello-tab active' data-sheet='One'></button>",
        "<button class='cello-tab' data-sheet='Two'></button>",
        "<section class='cello-sheet active' data-sheet='One'></section>",
        "<section class='cello-sheet' data-sheet='Two'></section>"
      ].join(""),
      "text/html"
    );
    const onActiveSheetChange = vi.fn();

    synchronizePreviewSheet(document, "One", onActiveSheetChange);
    document.querySelector<HTMLElement>("[data-sheet='Two']")?.click();

    expect(onActiveSheetChange).toHaveBeenCalledWith("Two");
  });

  it("uses the session visual history instead of a second local history", async () => {
    const session = createEditorSession({ source: "@sheet Report\n| A |" });
    const execute = vi.spyOn(session, "execute");
    await renderView(<CelloVisualEditor session={session} />);
    const cell = document.querySelector<HTMLElement>("[role='gridcell'][aria-label='A1']");
    expect(cell).toBeTruthy();

    await act(async () => {
      cell?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    });
    const editor = getTextarea("A1");
    changeTextarea(editor, "B");
    await act(async () => {
      editor.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }));
    });

    expect(session.getSnapshot()).toMatchObject({
      source: "@sheet Report\n|B|",
      histories: {
        source: { canUndo: false },
        visual: { canUndo: true }
      }
    });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ type: "update-cell" }));

    await act(async () => {
      session.undo("visual");
    });
    expect(session.getSnapshot().source).toBe("@sheet Report\n| A |");
  });

  it("keeps source, visual, and preview synchronized in the optional workbench", async () => {
    const session = createEditorSession({ source: "@sheet Report\n| A |" });
    await renderView(
      <CelloWorkbench
        session={session}
        htmlPreviewProps={{ renderSource: async (source) => `<p>${source}</p>` }}
      />
    );

    changeSourceEditor(getSourceEditor("Cello source"), "@sheet Report\n| B |");
    clickButton("Visual editor");
    expect(document.querySelector("[role='gridcell']")?.textContent).toContain("B");

    clickButton("Preview");
    await flushTimer();
    expect(getPreviewFrame().getAttribute("srcdoc")).toContain("| B |");
  });

  it("reports controlled workbench view changes without changing the rendered view", async () => {
    const session = createEditorSession({ source: "| A |" });
    const onActiveViewChange = vi.fn();
    await renderView(
      <CelloWorkbench
        activeView="source"
        onActiveViewChange={onActiveViewChange}
        session={session}
      />
    );

    clickButton("Preview");
    expect(onActiveViewChange).toHaveBeenCalledWith("preview");
    expect(getSourceEditor("Cello source")).toBeTruthy();
  });

  it("moves between workbench tabs with arrow keys", async () => {
    const session = createEditorSession({ source: "@sheet Report\n| A |" });
    await renderView(<CelloWorkbench session={session} />);
    const sourceTab = getButton("Source");

    await act(async () => {
      sourceTab.dispatchEvent(new KeyboardEvent("keydown", {
        bubbles: true,
        key: "ArrowRight"
      }));
    });

    expect(getButton("Visual editor").getAttribute("aria-selected")).toBe("true");
  });
});

async function renderView(node: ReactNode): Promise<void> {
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(node);
  });
  await act(async () => {
    await new Promise((resolve) => {
      window.setTimeout(resolve, 0);
    });
  });
}

function getTextarea(label: string): HTMLTextAreaElement {
  const textarea = document.querySelector<HTMLTextAreaElement>(`textarea[aria-label="${label}"]`);
  expect(textarea).toBeTruthy();
  if (!textarea) {
    throw new Error(`Textarea ${label} was not rendered.`);
  }
  return textarea;
}

function changeTextarea(textarea: HTMLTextAreaElement, value: string): void {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    setter?.call(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function getSourceEditor(label: string): HTMLElement {
  const editor = document.querySelector<HTMLElement>(`.cm-content[aria-label="${label}"]`);
  expect(editor).toBeTruthy();
  if (!editor) {
    throw new Error(`Source editor ${label} was not rendered.`);
  }
  return editor;
}

function getSourceEditorView(editor: HTMLElement): EditorView {
  const view = EditorView.findFromDOM(editor);
  expect(view).toBeTruthy();
  if (!view) {
    throw new Error("CodeMirror editor view was not found.");
  }
  return view;
}

function changeSourceEditor(editor: HTMLElement, value: string): void {
  const view = getSourceEditorView(editor);
  act(() => {
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
      userEvent: "input.type"
    });
  });
}

function getButton(label: string): HTMLButtonElement {
  const button = Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
    .find((candidate) => candidate.textContent === label);
  expect(button).toBeTruthy();
  if (!button) {
    throw new Error(`Button ${label} was not rendered.`);
  }
  return button;
}

function clickButton(label: string): void {
  act(() => {
    getButton(label).click();
  });
}

function getPreviewFrame(): HTMLIFrameElement {
  const frame = document.querySelector<HTMLIFrameElement>(".celloPreviewFrame");
  expect(frame).toBeTruthy();
  if (!frame) {
    throw new Error("Preview iframe was not rendered.");
  }
  return frame;
}

async function flushTimer(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => {
      window.setTimeout(resolve, 0);
    });
  });
}

async function resolvePreview(
  resolvers: Map<string, (html: string) => void>,
  source: string,
  html: string
): Promise<void> {
  const resolve = resolvers.get(source);
  if (!resolve) {
    throw new Error(`Preview render for ${source} did not start.`);
  }
  await act(async () => {
    resolve(html);
    await Promise.resolve();
  });
}
