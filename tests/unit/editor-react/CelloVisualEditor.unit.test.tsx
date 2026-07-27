// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CelloVisualEditor } from "@cello/editor-react";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
    root = undefined;
  }
  document.body.replaceChildren();
});

describe("CelloVisualEditor", () => {
  it("renders workbook cells with configurable layout and optional source button", async () => {
    renderEditor("@sheet Report\n@header | Name | Amount |\n| Ada | =SUM(Amount) |", vi.fn(), {
      layout: { minimumVisibleColumns: 3, minimumVisibleRows: 4 }
    });

    expect(screenInput("A1").value).toBe("Name");
    expect(screenInput("B2").value).toBe("=SUM(Amount)");
    expect(screenInput("C4").value).toBe("");
    expect(document.querySelector("[aria-label='Source']")).toBeNull();
  });

  it("calls the host with serialized source when editing a cell", async () => {
    const onSourceChange = vi.fn();
    renderEditor("@sheet Report\n| Ada | 5 |", onSourceChange);

    changeInput(screenInput("B1"), "7");

    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Report\n| Ada | 7 |");
  });

  it("edits full selected cell source from the formula bar", async () => {
    const onSourceChange = vi.fn();
    renderEditor("@sheet Report\n| Ada | 5 |", onSourceChange);

    focusInput(screenInput("A1"));
    changeInput(screenTextArea("Selected cell source"), "Ada[bold][color:#123456]");

    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Report\n| Ada[bold][color:#123456] | 5 |");
  });

  it("applies toolbar commands through editor-core serialization", async () => {
    const onSourceChange = vi.fn();
    renderEditor("@sheet Report\n| Ada | 5 |\n| Ops | 2 |", onSourceChange);

    focusInput(screenInput("B1"));
    clickButton("Bold");
    changeInput(screenColorInput(1), "#abcdef");
    clickButton("Merge with left");

    expect(onSourceChange).toHaveBeenCalledWith("@sheet Report\n| Ada | 5[bold] |\n| Ops | 2 |");
    expect(onSourceChange).toHaveBeenCalledWith("@sheet Report\n| Ada | 5[bold][bg:#abcdef] |\n| Ops | 2 |");
    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Report\n| Ada | < |\n| Ops | 2 |");
  });

  it("adds sheets, switches active sheet, and removes sheets only when safe", async () => {
    const onSourceChange = vi.fn();
    renderEditor("@sheet Report\n| Ada |", onSourceChange);

    expect(screenButton("Delete sheet").disabled).toBe(true);

    clickButton("New sheet");
    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Report\n| Ada |\n\n@sheet Sheet2");

    clickButton("Delete sheet");
    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Report\n| Ada |");
  });

  it("adds rows with host layout options", async () => {
    const onSourceChange = vi.fn();
    renderEditor("@sheet Report\n| Ada |", onSourceChange, { layout: { minimumVisibleColumns: 4 } });

    clickButton("New row");
    clickButton("New column");
    changeInput(screenInput("D2"), "Tail");

    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Report\n| Ada |\n|  |  |  | Tail |");
  });

  it("applies row-scoped formatting and merge-up commands", async () => {
    const onSourceChange = vi.fn();
    renderEditor("@sheet Report\n| Ada | 5 |\n| Ops | 2 |", onSourceChange);

    focusInput(screenInput("A2"));
    clickTab("row");
    clickButton("Italic");
    changeInput(screenColorInput(0), "#111111");
    clickButton("Merge with top");

    expect(onSourceChange).toHaveBeenCalledWith("@sheet Report\n| Ada | 5 |\n[italic] | Ops | 2 |");
    expect(onSourceChange).toHaveBeenCalledWith("@sheet Report\n| Ada | 5 |\n[italic][color:#111111] | Ops | 2 |");
    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Report\n| Ada | 5 |\n[italic][color:#111111] | ^ | 2 |");
  });

  it("renders defaults, inherited styles, formula highlighting, and tone commands", async () => {
    const onSourceChange = vi.fn();
    renderEditor("@sheet Report\n@header | Name[italic] | Total |\n@defaults | Pending | =Qty*Price |\n| Ada | =Total[1:1] |", onSourceChange);

    expect(screenInput("Defaults A").value).toBe("Pending");
    expect(document.querySelector("[aria-label='Inherited']")?.textContent).toContain("column: [italic]");

    focusInput(screenInput("B2"));
    expect(document.querySelector(".formula-equals")?.textContent).toBe("=");
    expect(document.querySelector(".formula-column")?.textContent).toBe("Total");
    expect(document.querySelector(".formula-range")?.textContent).toBe("[1:1]");

    clickButton("Tone");
    clickElement(document.querySelector<HTMLButtonElement>(".celloVisualToneOptions .celloVisualTone-ok"));
    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Report\n@header | Name[italic] | Total |\n@defaults | Pending | =Qty*Price |\n| Ada | =Total[1:1][tone:ok] |");
    expect(screenButton("Tone").textContent).toBe("Tone: ok");
    expect(screenButton("Tone").className).toContain("celloVisualTone-ok");

    clickButton("Tone");
    expect(document.querySelector(".celloVisualToneOptions .celloVisualTone-ok")?.getAttribute("aria-checked")).toBe("true");
    clickOutside();
    expect(document.querySelector(".celloVisualToneOptions")).toBeNull();

    clickButton("Tone");
    clickElement(document.querySelector<HTMLButtonElement>(".celloVisualToneOptions .celloVisualTone-ok"));
    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Report\n@header | Name[italic] | Total |\n@defaults | Pending | =Qty*Price |\n| Ada | =Total[1:1] |");

    changeInput(screenInput("Defaults A"), "Queued");
    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Report\n@header | Name[italic] | Total |\n@defaults | Queued | =Qty*Price |\n| Ada | =Total[1:1] |");
  });

  it("toggles inline heading and strike text styles from the toolbar", async () => {
    const onSourceChange = vi.fn();
    renderEditor("@sheet Report\n| Ada |", onSourceChange);

    focusInput(screenInput("A1"));
    clickButton("H1");
    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Report\n| ## Ada |");
    expect(screenButton("H1").className).toContain("active");

    clickButton("H1");
    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Report\n| Ada |");

    doubleClickButton("Strikethrough");
    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Report\n| ~~Ada~~ |");

    doubleClickButton("Strikethrough");
    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Report\n| Ada |");
  });

  it("keeps formatting toolbar commands away from selected defaults", async () => {
    const onSourceChange = vi.fn();
    renderEditor("@sheet Report\n@header | Name |\n@defaults | Pending |\n| Ada |", onSourceChange);

    focusInput(screenInput("A2"));
    clickButton("Strikethrough");
    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Report\n@header | Name |\n@defaults | Pending |\n| Ada[strike] |");

    focusInput(screenInput("Defaults A"));
    onSourceChange.mockClear();
    clickButton("Bold");
    clickButton("H1");
    doubleClickButton("Strikethrough");
    clickButton("Tone");
    clickElement(document.querySelector<HTMLButtonElement>(".celloVisualToneOptions .celloVisualTone-warn"));

    expect(onSourceChange).not.toHaveBeenCalled();
  });

  it("renames sheets and calls optional source-view action", async () => {
    const onSourceChange = vi.fn();
    const onRequestSourceView = vi.fn();
    renderEditor("@sheet Report\n| Ada |", onSourceChange, { onRequestSourceView });

    changeInput(screenInput("Rename active sheet"), "Planning");
    clickButton("Source");

    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Planning\n| Ada |");
    expect(onRequestSourceView).toHaveBeenCalledTimes(1);
  });

  it("uses custom labels and host class names", async () => {
    const onRequestSourceView = vi.fn();
    renderEditor("@sheet Report\n@header | Name |\n| Ada |", vi.fn(), {
      className: "hostEditor",
      labels: {
        headerRow: "Heading",
        source: "Open source",
        toolbar: "Toolbar",
        workbook: "Workbook"
      },
      onRequestSourceView
    });

    expect(document.querySelector(".celloVisualEditorShell.hostEditor")).toBeTruthy();
    expect(document.querySelector("[aria-label='Toolbar']")).toBeTruthy();
    expect(document.querySelector("[aria-label='Workbook']")).toBeTruthy();
    expect(document.body.textContent).toContain("Heading");
    clickButton("Open source");
    expect(onRequestSourceView).toHaveBeenCalledTimes(1);
  });

  it("uses host-provided external source resolver for evaluation display", async () => {
    renderEditor("@sheet Imported [csv]\n-> data.csv\n\n@sheet Summary\n@header | Metric | Value |\n| Total | =SUM(Imported!Amount) |", vi.fn(), {
      readExternalSource: () => "Amount\n2\n3"
    });

    clickTab("Summary");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screenInput("B2").value).toBe("5");
  });
});

function renderEditor(
  source: string,
  onSourceChange: (source: string) => void,
  props: Partial<Parameters<typeof CelloVisualEditor>[0]> = {}
) {
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root?.render(<CelloVisualEditor source={source} onSourceChange={onSourceChange} {...props} />);
  });
}

function screenInput(label: string): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);
  expect(input).toBeTruthy();
  return input!;
}

function screenTextArea(label: string): HTMLTextAreaElement {
  const textarea = document.querySelector<HTMLTextAreaElement>(`textarea[aria-label="${label}"]`);
  expect(textarea).toBeTruthy();
  return textarea!;
}

function screenButton(label: string): HTMLButtonElement {
  const button = document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  expect(button).toBeTruthy();
  return button!;
}

function clickTab(label: string): void {
  const button = Array.from(document.querySelectorAll("button")).find((candidate) => candidate.textContent === label);
  expect(button).toBeTruthy();
  act(() => {
    button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function screenColorInput(index: number): HTMLInputElement {
  const input = document.querySelectorAll<HTMLInputElement>("input[type='color']").item(index);
  expect(input).toBeTruthy();
  return input!;
}

function clickButton(label: string): void {
  act(() => {
    screenButton(label).dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function doubleClickButton(label: string): void {
  act(() => {
    screenButton(label).dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
  });
}

function clickOutside(): void {
  act(() => {
    document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  });
}

function clickElement(element: HTMLElement | null): void {
  expect(element).toBeTruthy();
  act(() => {
    element?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function focusInput(input: HTMLInputElement): void {
  act(() => {
    input.focus();
  });
}

function changeInput(input: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  act(() => {
    setNativeValue(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function setNativeValue(input: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  setter?.call(input, value);
}
