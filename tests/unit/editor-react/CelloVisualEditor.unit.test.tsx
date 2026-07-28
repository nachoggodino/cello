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
  vi.restoreAllMocks();
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
    changeInput(screenTextArea("Selected cell source"), "Ada Lovelace");
    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Report\n| Ada Lovelace | 5 |");

    changeInput(screenInput("Modifiers"), "[bold][color:#123456]");

    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Report\n| Ada Lovelace[bold][color:#123456] | 5 |");
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

  it("persists sheet, column, and row layout controls", async () => {
    const onSourceChange = vi.fn();
    renderEditor("@sheet Report\n| Ada | Long note |", onSourceChange);

    chooseMenuOption("Columns", "Fit");
    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Report [columns:fit]\n| Ada | Long note |");

    chooseMenuOption("Rows", "Ellipsis");
    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Report [columns:fit][rows:ellipsis]\n| Ada | Long note |");

    chooseMenuOption("Rows", "Wrap");
    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Report [columns:fit]\n| Ada | Long note |");

    focusInput(screenInput("B1"));
    clickButton("Fit");
    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Report [columns:fit]\n@header |  | [fit] |\n| Ada | Long note |");
    expect(screenButton("Width").textContent).toBe("fit: 18px");

    setMenuCustomValue("Width", "24");
    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Report [columns:fit]\n@header |  | [width:24] |\n| Ada | Long note |");

    clickButton("Wrap");
    chooseMenuOption("Height", "auto");
    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Report [columns:fit]\n@header |  | [width:24] |\n[wrap][height:auto] | Ada | Long note |");

    chooseMenuOption("Columns", "Normal");
    chooseMenuOption("Rows", "Ellipsis");
    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Report [rows:ellipsis]\n@header |  | [width:24] |\n[wrap][height:auto] | Ada | Long note |");
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
    expect(screenInput("Modifiers").value).toBe("[italic]");
    expect(document.querySelector("[aria-label='Inherited']")?.textContent).toContain("column: [italic]");

    focusInput(screenInput("B2"));
    expect(screenInput("Modifiers").value).toBe("");
    expect(screenTextArea("Selected cell source").value).toBe("=Total[1:1]");
    expect(document.querySelector(".formula-equals")?.textContent).toBe("=");
    expect(document.querySelector(".formula-column")?.textContent).toBe("Total");
    expect(document.querySelector(".formula-range")?.textContent).toBe("[1:1]");

    clickButton("Tone");
    clickElement(document.querySelector<HTMLButtonElement>(".celloVisualValueOptions .celloVisualTone-ok"));
    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Report\n@header | Name[italic] | Total |\n@defaults | Pending | =Qty*Price |\n| Ada | =Total[1:1][tone:ok] |");
    expect(screenButton("Tone").textContent).toBe("Tone: ok");
    expect(screenButton("Tone").className).toContain("celloVisualTone-ok");

    clickButton("Tone");
    expect(document.querySelector(".celloVisualValueOptions .celloVisualTone-ok")?.getAttribute("aria-checked")).toBe("true");
    clickOutside();
    expect(document.querySelector(".celloVisualValueOptions")).toBeNull();

    clickButton("Tone");
    clickElement(document.querySelector<HTMLButtonElement>(".celloVisualValueOptions .celloVisualTone-ok"));
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

  it("renders partial inline formatting in display mode and preserves source while editing", async () => {
    renderEditor("@sheet Report\n| Hello *world* |", vi.fn());

    const display = document.querySelector<HTMLElement>(".celloVisualCellDisplay span");
    expect(display?.textContent).toBe("world");
    expect(display?.style.fontWeight).toBe("700");

    focusInput(screenInput("A1"));
    expect(screenInput("A1").value).toBe("Hello *world*");
    expect(document.querySelector(".celloVisualCellDisplay")).toBeNull();
  });

  it("keeps formatting toolbar commands away from selected defaults", async () => {
    const onSourceChange = vi.fn();
    renderEditor("@sheet Report\n@header | Name |\n@defaults | Pending |\n| Ada |", onSourceChange);

    focusInput(screenInput("A2"));
    clickButton("Strikethrough");
    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Report\n@header | Name |\n@defaults | Pending |\n| Ada[strike] |");

    focusInput(screenInput("Defaults A"));
    expect(screenButton("Bold").disabled).toBe(true);
    expect(screenButton("Fit").disabled).toBe(true);
    expect(screenButton("Width").disabled).toBe(true);
    expect(screenButton("Wrap").disabled).toBe(true);
    expect(screenButton("Height").disabled).toBe(true);
    expect(screenButton("Tone").disabled).toBe(true);
    expect(screenButton("New row").disabled).toBe(false);
    expect(screenButton("New column").disabled).toBe(false);
    onSourceChange.mockClear();
    clickButton("Bold");
    clickButton("H1");
    doubleClickButton("Strikethrough");

    expect(onSourceChange).not.toHaveBeenCalled();
  });

  it("shows computed fit width for formulas in the width menu", async () => {
    mockMeasuredTextWidths();
    renderEditor("@sheet Report [columns:fit]\n@header | Formula |\n| =10000000000000 |", vi.fn());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screenButton("Width").textContent).toBe("fit: 158px");
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
        noInheritedModifiers: "No modifiers",
        propertyScope: "Scope picker",
        source: "Open source",
        toolbar: "Toolbar",
        workbook: "Workbook",
        workbookSheets: "Sheets list"
      },
      onRequestSourceView
    });

    expect(document.querySelector(".celloVisualEditorShell.hostEditor")).toBeTruthy();
    expect(document.querySelector("[aria-label='Toolbar']")).toBeTruthy();
    expect(document.querySelector("[aria-label='Workbook']")).toBeTruthy();
    expect(document.querySelector("[aria-label='Scope picker']")).toBeTruthy();
    expect(document.querySelector("[aria-label='Sheets list']")).toBeTruthy();
    expect(document.body.textContent).toContain("Heading");
    expect(document.body.textContent).toContain("No modifiers");
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

  it("shows computed formula values until the formula cell is focused", async () => {
    renderEditor("@sheet Report\n@header | Amount |\n| 5 |\n| 7 |\n| =SUM(Amount) |", vi.fn());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screenInput("A4").value).toBe("12");
    focusInput(screenInput("A4"));
    expect(screenInput("A4").value).toBe("=SUM(Amount)");
  });

  it("keeps formatted display text and layout in the visual grid", async () => {
    mockMeasuredTextWidths();
    renderEditor("@sheet Report [columns:fit][rows:wrap]\n@header | Amount[€][2d] | Rate[%][1d] |\n| 12.5 | 0.42 |", vi.fn());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screenInput("A2").value).toBe("€12.50");
    expect(screenInput("B2").value).toBe("42.0%");
    expect(screenInput("A2").style.whiteSpace).toBe("normal");
    expect(screenInput("A2").closest("td")?.getAttribute("style")).toContain("width: 78px");
    expect(screenInput("A2").closest("td")?.getAttribute("style")).toContain("max-width:");

    focusInput(screenInput("A2"));
    expect(screenInput("A2").value).toBe("12.5");
  });

  it("does not resize fitted formula columns from the formula source while editing", async () => {
    mockMeasuredTextWidths();
    renderEditor("@sheet Report [columns:fit]\n@header | R |\n| =SUM(2+2) |", vi.fn());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screenInput("A2").closest("td")?.getAttribute("style")).toContain("width: 28px");
    focusInput(screenInput("A2"));
    expect(screenInput("A2").value).toBe("=SUM(2+2)");
    expect(screenInput("A2").closest("td")?.getAttribute("style")).toContain("width: 28px");
  });

  it("measures column-level fit without counting the fit modifier text", async () => {
    mockMeasuredTextWidths();
    renderEditor("@sheet Report\n@header | [fit] |\n| ok |", vi.fn());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screenInput("A2").closest("td")?.getAttribute("style")).toContain("width: 38px");
    expect(screenButton("Width").textContent).toBe("fit: 38px");
  });

  it("syntax-highlights formulas in grid edit mode", async () => {
    renderEditor("@sheet Report\n@header | Amount |\n| 5 |\n| =SUM(Amount) |", vi.fn());

    focusInput(screenInput("A3"));

    expect(document.querySelector(".celloVisualCellFormulaHighlight .formula-equals")?.textContent).toBe("=");
    expect(document.querySelector(".celloVisualCellFormulaHighlight .formula-column")?.textContent).toBe("SUM");
  });

  it("preserves transient trailing spaces while editing visual cells", async () => {
    const onSourceChange = vi.fn();
    renderEditor("@sheet Report\n| Hello |", onSourceChange);

    const cell = screenInput("A1");
    focusInput(cell);
    changeInput(cell, "Hello ");

    expect(screenInput("A1").value).toBe("Hello ");
    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Report\n| Hello  |");

    changeInput(screenInput("A1"), "Hello world");

    expect(screenInput("A1").value).toBe("Hello world");
    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Report\n| Hello world |");
  });

  it("explains read-only CSV sheets and clears command warnings after 15 seconds", async () => {
    vi.useFakeTimers();
    try {
      renderEditor("@sheet RawData [csv]\nname,amount\nAda,5", vi.fn());

      focusInput(screenInput("A2"));
      clickButton("Bold");

      expect(document.querySelector(".celloVisualCommandError")?.textContent).toContain("RawData");
      expect(document.querySelector(".celloVisualCommandError")?.textContent).toContain("CSV");
      expect(document.querySelector(".celloVisualCommandError")?.textContent).toContain("native Cello syntax");

      act(() => {
        vi.advanceTimersByTime(15000);
      });

      expect(document.querySelector(".celloVisualCommandError")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
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

function mockMeasuredTextWidths(charWidth = 10): void {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const textWidth = this.classList.contains("celloVisualFitMeasureItem") ? (this.textContent ?? "").length * charWidth : 0;
    return {
      x: 0,
      y: 0,
      width: textWidth,
      height: 20,
      top: 0,
      right: textWidth,
      bottom: 20,
      left: 0,
      toJSON: () => ({})
    } as DOMRect;
  });
}

function screenInput(label: string): HTMLInputElement | HTMLTextAreaElement {
  const input = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(`input[aria-label="${label}"], textarea[aria-label="${label}"]`);
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

function focusInput(input: HTMLInputElement | HTMLTextAreaElement): void {
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

function chooseMenuOption(menuLabel: string, optionLabel: string): void {
  clickButton(menuLabel);
  const option = Array.from(document.querySelectorAll<HTMLButtonElement>(".celloVisualValueOptions button"))
    .find((candidate) => candidate.textContent === optionLabel);
  clickElement(option ?? null);
}

function setMenuCustomValue(menuLabel: string, value: string): void {
  clickButton(menuLabel);
  const input = screenInput(menuLabel);
  changeInput(input, value);
  act(() => {
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
}
