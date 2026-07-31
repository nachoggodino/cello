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
  it("renders only source-defined table cells and the optional source button", async () => {
    await renderEditor("@sheet Report\n@header | Name | Amount |\n| Ada | =SUM(Amount) |", vi.fn());

    expect(screenCellText("A1")).toBe("Name");
    expect(screenCellText("B2")).toBe("=SUM(Amount)");
    expect(document.querySelector("[role='gridcell'][aria-label='C1']")).toBeNull();
    expect(document.querySelector("[aria-label='Source']")).toBeNull();
  });

  it("calls the host with serialized source when editing a cell", async () => {
    const onSourceChange = vi.fn();
    await renderEditor("@sheet Report\n| Ada | 5 |", onSourceChange);

    const editor = editCell("B1");
    changeInput(editor, "7");
    pressKey(editor, "Enter");

    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Report\n| Ada | 7 |");
  });

  it("edits full selected cell source from the formula bar", async () => {
    const onSourceChange = vi.fn();
    await renderEditor("@sheet Report\n| Ada | 5 |", onSourceChange);

    clickElement(screenCell("A1"));
    changeInput(screenTextArea("Selected cell source"), "Ada Lovelace");
    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Report\n| Ada Lovelace | 5 |");

    changeInput(screenInput("Modifiers"), "[bold][color:#123456]");

    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Report\n| Ada Lovelace[bold][color:#123456] | 5 |");
  });

  it("routes trailing modifiers from the top editor into the modifier editor", async () => {
    const onSourceChange = vi.fn();
    await renderEditor("@sheet Report\n| Ada[italic] |", onSourceChange);

    changeInput(screenTextArea("Selected cell source"), "Ada Lovelace[bold]");

    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Report\n| Ada Lovelace[italic][bold] |");
    expect(screenTextArea("Selected cell source").value).toBe("Ada Lovelace");
    expect(screenInput("Modifiers").value).toBe("[italic][bold]");
  });

  it("applies toolbar commands through editor-core serialization", async () => {
    const onSourceChange = vi.fn();
    await renderEditor("@sheet Report\n| Ada | 5 |\n| Ops | 2 |", onSourceChange);

    clickElement(screenCell("B1"));
    clickButton("Bold");
    changeInput(screenColorInput(1), "#abcdef");
    clickButton("Merge with left");

    expect(onSourceChange).toHaveBeenCalledWith("@sheet Report\n| Ada | 5[bold] |\n| Ops | 2 |");
    expect(onSourceChange).toHaveBeenCalledWith("@sheet Report\n| Ada | 5[bold][bg:#abcdef] |\n| Ops | 2 |");
    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Report\n| Ada | < |\n| Ops | 2 |");
  });

  it("adds sheets, switches active sheet, and removes sheets only when safe", async () => {
    const onSourceChange = vi.fn();
    await renderEditor("@sheet Report\n| Ada |", onSourceChange);

    expect(screenButton("Delete sheet").disabled).toBe(true);

    clickButton("New sheet");
    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Report\n| Ada |\n\n@sheet Sheet2");

    clickButton("Delete sheet");
    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Report\n| Ada |");
  });

  it("adds rows and columns within explicit table bounds", async () => {
    const onSourceChange = vi.fn();
    await renderEditor("@sheet Report\n| Ada |", onSourceChange);

    clickButton("New row");
    clickButton("New column");
    clickButton("New column");
    clickButton("New column");
    const editor = editCell("D2");
    changeInput(editor, "Tail");
    pressKey(editor, "Enter");

    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Report\n| Ada |  |  |  |\n|  |  |  |  Tail |");
  });

  it("persists sheet, column, and row layout controls", async () => {
    const onSourceChange = vi.fn();
    await renderEditor("@sheet Report\n| Ada | Long note |", onSourceChange);

    chooseMenuOption("Columns", "Fit");
    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Report [columns:fit]\n| Ada | Long note |");

    chooseMenuOption("Rows", "Ellipsis");
    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Report [columns:fit][rows:ellipsis]\n| Ada | Long note |");

    chooseMenuOption("Rows", "Wrap");
    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Report [columns:fit]\n| Ada | Long note |");

    clickElement(screenCell("B1"));
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
    await renderEditor("@sheet Report\n| Ada | 5 |\n| Ops | 2 |", onSourceChange);

    clickElement(screenRowHeader(2));
    clickButton("Italic");
    changeInput(screenColorInput(0), "#111111");
    clickButton("Merge with top");

    expect(onSourceChange).toHaveBeenCalledWith("@sheet Report\n| Ada | 5 |\n[italic] | Ops | 2 |");
    expect(onSourceChange).toHaveBeenCalledWith("@sheet Report\n| Ada | 5 |\n[italic][color:#111111] | Ops | 2 |");
    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Report\n| Ada | 5 |\n[italic][color:#111111] | ^ | 2 |");
  });

  it("renders defaults, inherited styles, formula highlighting, and tone commands", async () => {
    const onSourceChange = vi.fn();
    await renderEditor("@sheet Report\n@header | Name[italic] | Total |\n@defaults | Pending | =Qty*Price |\n| Ada | =Total[1:1] |", onSourceChange);

    expect(screenInput("Defaults A").value).toBe("Pending");
    expect(screenInput("Modifiers").value).toBe("[italic]");
    expect(document.querySelector("[aria-label='Inherited']")?.textContent).toContain("column: [italic]");

    clickElement(screenCell("B2"));
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
    expect(screenCell("B2").className).toContain("celloVisualTone");

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
    await renderEditor("@sheet Report\n| Ada |", onSourceChange);

    clickElement(screenCell("A1"));
    clickButton("Large heading");
    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Report\n| ## Ada |");
    expect(screenButton("Large heading").className).toContain("active");

    clickButton("Large heading");
    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Report\n| Ada |");

    doubleClickButton("Strikethrough");
    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Report\n| ~~Ada~~ |");

    doubleClickButton("Strikethrough");
    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Report\n| Ada |");
  });

  it("renders partial inline formatting in display mode and preserves source while editing", async () => {
    await renderEditor("@sheet Report\n| Hello *world* |", vi.fn());

    const display = document.querySelector<HTMLElement>(".celloVisualCellDisplay span");
    expect(display?.textContent).toBe("world");
    expect(display?.style.fontWeight).toBe("700");

    expect(editCell("A1").value).toBe("Hello *world*");
    expect(document.querySelector(".celloVisualCellDisplay")).toBeNull();
  });

  it("keeps formatting toolbar commands away from selected defaults", async () => {
    const onSourceChange = vi.fn();
    await renderEditor("@sheet Report\n@header | Name |\n@defaults | Pending |\n| Ada |", onSourceChange);

    clickElement(screenCell("A2"));
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
    clickButton("Large heading");
    doubleClickButton("Strikethrough");

    expect(onSourceChange).not.toHaveBeenCalled();
  });

  it("shows computed fit width for formulas in the width menu", async () => {
    mockMeasuredTextWidths();
    await renderEditor("@sheet Report [columns:fit]\n@header | Formula |\n| =10000000000000 |", vi.fn());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      await Promise.resolve();
    });

    expect(screenButton("Width").textContent).toBe("fit: 158px");
  });

  it("renames sheets and calls optional source-view action", async () => {
    const onSourceChange = vi.fn();
    const onRequestSourceView = vi.fn();
    await renderEditor("@sheet Report\n| Ada |", onSourceChange, { onRequestSourceView });

    changeInput(screenInput("Rename active sheet"), "Planning");
    clickButton("Source");

    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Planning\n| Ada |");
    expect(onRequestSourceView).toHaveBeenCalledTimes(1);
  });

  it("uses custom labels and host class names", async () => {
    const onRequestSourceView = vi.fn();
    await renderEditor("@sheet Report\n@header | Name |\n| Ada |", vi.fn(), {
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
    expect(document.querySelector("[aria-label='Scope picker']")).toBeNull();
    expect(document.querySelector("[aria-label='Sheets list']")).toBeTruthy();
    expect(document.body.textContent).toContain("Heading");
    expect(document.body.textContent).toContain("No modifiers");
    clickButton("Open source");
    expect(onRequestSourceView).toHaveBeenCalledTimes(1);
  });

  it("uses host-provided external source resolver for evaluation display", async () => {
    await renderEditor("@sheet Imported [csv]\n-> data.csv\n\n@sheet Summary\n@header | Metric | Value |\n| Total | =SUM(Imported!Amount) |", vi.fn(), {
      readExternalSource: () => "Amount\n2\n3"
    });

    clickTab("Summary");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screenCellText("B2")).toBe("5");
  });

  it("shows computed formula values until the formula cell is focused", async () => {
    await renderEditor("@sheet Report\n@header | Amount |\n| 5 |\n| 7 |\n| =SUM(Amount) |", vi.fn());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screenCellText("A4")).toBe("12");
    expect(editCell("A4").value).toBe("=SUM(Amount)");
  });

  it("keeps formatted display text and layout in the visual grid", async () => {
    mockMeasuredTextWidths();
    await renderEditor("@sheet Report [columns:fit][rows:wrap]\n@header | Amount[€][2d] | Rate[%][1d] |\n| 12.5 | 0.42 |", vi.fn());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screenCellText("A2")).toBe("€12.50");
    expect(screenCellText("B2")).toBe("42.0%");
    expect(screenCellDisplay("A2").style.whiteSpace).toBe("normal");
    expect(screenCell("A2").getAttribute("style")).toContain("width: 78px");
    expect(screenCell("A2").getAttribute("style")).toContain("max-width:");

    expect(editCell("A2").value).toBe("12.5");
  });

  it("does not resize fitted formula columns from the formula source while editing", async () => {
    mockMeasuredTextWidths();
    await renderEditor("@sheet Report [columns:fit]\n@header | R |\n| =SUM(2+2) |", vi.fn());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screenCell("A2").getAttribute("style")).toContain("width: 28px");
    expect(editCell("A2").value).toBe("=SUM(2+2)");
    expect(screenCell("A2").getAttribute("style")).toContain("width: 28px");
  });

  it("measures column-level fit without counting the fit modifier text", async () => {
    mockMeasuredTextWidths();
    await renderEditor("@sheet Report\n@header | [fit] |\n| ok |", vi.fn());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screenCell("A2").getAttribute("style")).toContain("width: 38px");
    expect(screenButton("Width").textContent).toBe("fit: 38px");
  });

  it("syntax-highlights formulas in grid edit mode", async () => {
    await renderEditor("@sheet Report\n@header | Amount |\n| 5 |\n| =SUM(Amount) |", vi.fn());

    editCell("A3");

    expect(document.querySelector(".celloVisualCellFormulaHighlight .formula-equals")?.textContent).toBe("=");
    expect(document.querySelector(".celloVisualCellFormulaHighlight .formula-column")?.textContent).toBe("SUM");
  });

  it("preserves transient trailing spaces while editing visual cells", async () => {
    const onSourceChange = vi.fn();
    await renderEditor("@sheet Report\n| Hello |", onSourceChange);

    const cell = editCell("A1");
    changeInput(cell, "Hello ");

    expect(cell.value).toBe("Hello ");
    expect(onSourceChange).not.toHaveBeenCalled();
    pressKey(cell, "Enter");
    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Report\n| Hello  |");

    const nextEditor = editCell("A1");
    changeInput(nextEditor, "Hello world");
    pressKey(nextEditor, "Enter");

    expect(screenCellText("A1")).toBe("Hello world");
    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Report\n| Hello world |");
  });

  it("selects cells on click without entering edit mode", async () => {
    await renderEditor("@sheet Report\n| Ada | =SUM(1+1) |", vi.fn());

    clickElement(screenCell("B1"));

    expect(screenTextArea("B1").readOnly).toBe(true);
    expect(screenCellText("B1")).toBe("2");
    expect(document.querySelector("td[aria-selected='true'][aria-label='B1']")).toBeTruthy();
  });

  it("enters edit mode with F2 or printable typing", async () => {
    const onSourceChange = vi.fn();
    await renderEditor("@sheet Report\n| Ada | 5 |", onSourceChange);

    clickElement(screenCell("A1"));
    pressKey(screenCell("A1"), "F2");
    expect(screenInput("A1").value).toBe("Ada");

    pressKey(screenInput("A1"), "Escape");
    expect(screenTextArea("A1").readOnly).toBe(true);
    expect(screenCellText("A1")).toBe("Ada");

    pressKey(screenCell("A1"), "Z");
    expect(screenInput("A1").value).toBe("Z");
    pressKey(screenInput("A1"), "Enter");

    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Report\n| Z | 5 |");
  });

  it("keeps horizontal arrows inside pointer editing and commits typed replacement with arrows", async () => {
    const onSourceChange = vi.fn();
    await renderEditor("@sheet Report\n| Ada | 5 |", onSourceChange);

    const editor = editCell("A1");
    changeInput(editor, "Grace");
    pressKey(editor, "ArrowRight");
    expect(onSourceChange).not.toHaveBeenCalled();

    pressKey(editor, "Enter");
    pressKey(screenCell("A1"), "Z");
    const replacement = screenTextArea("A1");
    pressKey(replacement, "ArrowRight");
    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Report\n| Z | 5 |");
  });

  it("extends selected ranges with shift arrows and copies TSV", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    await renderEditor("@sheet Report\n| A | B |\n| C | D |", vi.fn());

    clickElement(screenCell("A1"));
    pressKey(screenCell("A1"), "ArrowRight", { shiftKey: true });
    pressKey(screenCell("B1"), "ArrowDown", { shiftKey: true });
    pressKey(screenCell("B2"), "c", { ctrlKey: true });

    expect(document.querySelectorAll("td[aria-selected='true']")).toHaveLength(4);
    expect(writeText).toHaveBeenCalledWith("A\tB\nC\tD");
  });

  it("extends ranges with shift-click and shows the normalized range label", async () => {
    await renderEditor("@sheet Report\n| A | B |\n| C | D |", vi.fn());

    clickElement(screenCell("B2"));
    clickElement(screenCell("A1"), { shiftKey: true });

    expect(document.querySelector(".celloVisualCellAddress")?.textContent).toBe("Report!A1:B2");
    expect(document.querySelectorAll("td[aria-selected='true']")).toHaveLength(4);
  });

  it("selects source-bounded rows and columns from their identifiers", async () => {
    await renderEditor("@sheet Report\n| A | B |\n| C | D |", vi.fn());

    clickElement(screenRowHeader(2));
    expect(document.querySelector(".celloVisualCellAddress")?.textContent).toBe("Report!2:2");
    expect(document.querySelectorAll("td[aria-selected='true']")).toHaveLength(2);
    expect(screenRowHeader(2).classList.contains("activeHeader")).toBe(true);

    clickElement(screenColumnHeader("B"));
    expect(document.querySelector(".celloVisualCellAddress")?.textContent).toBe("Report!B:B");
    expect(document.querySelectorAll("td[aria-selected='true']")).toHaveLength(2);
    expect(screenColumnHeader("B").classList.contains("activeHeader")).toBe(true);
    expect(Array.from(document.querySelectorAll(".celloVisualRowHeader")).every((header) => !header.classList.contains("selectedHeader"))).toBe(true);
  });

  it("uses structural column modifiers for column selections", async () => {
    const onSourceChange = vi.fn();
    await renderEditor("@sheet Report\n| A | B |\n| C | D |", onSourceChange);

    clickElement(screenColumnHeader("B"));
    clickButton("Bold");

    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Report\n@header |  | [bold] |\n| A | B |\n| C | D |");
  });

  it("treats semantic header cells and column identifiers as the same modifier target", async () => {
    const onSourceChange = vi.fn();
    await renderEditor("@sheet Report\n@header | Name | Amount |\n| Ada | 5 |", onSourceChange);

    clickElement(screenCell("B1"));
    clickButton("Bold");
    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Report\n@header | Name | Amount[bold] |\n| Ada | 5 |");

    clickElement(screenColumnHeader("B"));
    clickButton("Bold");
    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Report\n@header | Name | Amount |\n| Ada | 5 |");
  });

  it("expands selections to cover complete merged cells", async () => {
    await renderEditor("@sheet Report\n| A | < |\n| C | D |", vi.fn());

    clickElement(screenCell("A1"));

    expect(document.querySelector(".celloVisualCellAddress")?.textContent).toBe("Report!A1:B1");
    expect(screenCell("A1").getAttribute("colspan")).toBe("2");
  });

  it("navigates across merged cells as atomic visual units", async () => {
    await renderEditor("@sheet Report\n| A | < | C |\n| D | E | F |", vi.fn());

    clickElement(screenCell("A1"));
    pressKey(screenCell("A1"), "ArrowRight");
    expect(document.querySelector(".celloVisualCellAddress")?.textContent).toBe("Report!C1");

    pressKey(screenCell("C1"), "ArrowLeft");
    expect(document.querySelector(".celloVisualCellAddress")?.textContent).toBe("Report!A1:B1");
  });

  it("rejects paste that splits a merge and accepts an exact merge layout", async () => {
    const onSourceChange = vi.fn();
    const readText = vi.fn().mockResolvedValueOnce("X").mockResolvedValueOnce("X\t<");
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { readText } });
    await renderEditor("@sheet Report\n| A | < | C |", onSourceChange);

    clickElement(screenCell("A1"));
    pressKey(screenCell("A1"), "v", { ctrlKey: true });
    await act(async () => {
      await Promise.resolve();
    });
    expect(onSourceChange).not.toHaveBeenCalled();
    expect(document.querySelector(".celloVisualCommandError")?.textContent).toContain("merged cell");

    pressKey(screenCell("A1"), "v", { ctrlKey: true });
    await act(async () => {
      await Promise.resolve();
    });
    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Report\n| X | < | C |");
  });

  it("applies cell formatting to every cell in a selected range", async () => {
    const onSourceChange = vi.fn();
    await renderEditor("@sheet Report\n| A | B |\n| C | D |", onSourceChange);

    clickElement(screenCell("A1"));
    clickElement(screenCell("B2"), { shiftKey: true });
    clickButton("Bold");

    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Report\n| A[bold] | B[bold] |\n| C[bold] | D[bold] |");
  });

  it("keeps the caret stable across sequential in-cell draft updates", async () => {
    const onSourceChange = vi.fn();
    await renderEditor("@sheet Report\n| Ada |", onSourceChange);

    clickElement(screenCell("A1"));
    pressKey(screenCell("A1"), "F2");
    const editor = screenTextArea("A1");
    editor.setSelectionRange(editor.value.length, editor.value.length);
    changeInput(editor, "AdaX");
    expect(editor.selectionStart).toBe(4);
    expect(editor.selectionEnd).toBe(4);
    changeInput(editor, "AdaXY");
    expect(editor.selectionStart).toBe(5);
    expect(editor.selectionEnd).toBe(5);
    pressKey(editor, "Enter");

    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Report\n| AdaXY |");
  });

  it("leaves pointer-edit caret keys and pointer events under textarea control", async () => {
    const onSourceChange = vi.fn();
    await renderEditor("@sheet Report\n| Ada |", onSourceChange);

    const editor = editCell("A1");
    editor.setSelectionRange(1, 1);
    const pointerAccepted = editor.dispatchEvent(
      new MouseEvent("mousedown", {
        bubbles: true,
        cancelable: true,
        detail: 1
      })
    );
    const arrowAccepted = editor.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowLeft",
        bubbles: true,
        cancelable: true
      })
    );

    expect(pointerAccepted).toBe(true);
    expect(arrowAccepted).toBe(true);
    expect(editor.readOnly).toBe(false);
    expect(onSourceChange).not.toHaveBeenCalled();
  });

  it("restores grid focus after committing and continues keyboard navigation", async () => {
    const onSourceChange = vi.fn();
    await renderEditor("@sheet Report\n| A | B |\n| C | D |", onSourceChange);

    const editor = editCell("A1");
    changeInput(editor, "Edited");
    pressKey(editor, "Enter");

    const grid = document.querySelector<HTMLElement>("[role='grid']");
    expect(document.activeElement).toBe(grid);
    pressKey(grid!, "ArrowRight");
    expect(document.querySelector(".celloVisualCellAddress")?.textContent).toBe("Report!B2");
    pressKey(grid!, "Enter");
    expect(document.querySelector(".celloVisualCellAddress")?.textContent).toBe("Report!B2");
  });

  it("clears selected content without removing modifiers", async () => {
    const onSourceChange = vi.fn();
    await renderEditor("@sheet Report\n| Ada[bold] | 5 |", onSourceChange);

    clickElement(screenCell("A1"));
    pressKey(screenCell("A1"), "Delete");

    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Report\n| [bold] | 5 |");
  });

  it("shows non-persisted header and defaults scaffolding for empty sheets", async () => {
    const onSourceChange = vi.fn();
    await renderEditor("@sheet Report", onSourceChange);

    expect(screenInput("Header A")).toBeTruthy();
    expect(screenInput("Defaults A")).toBeTruthy();
    expect(screenButton("New column").disabled).toBe(true);
    expect(onSourceChange).not.toHaveBeenCalled();

    clickButton("New row");

    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Report\n|  |");
    expect(screenInput("Header A")).toBeTruthy();
    expect(screenInput("Defaults A")).toBeTruthy();
    expect(screenCell("A1")).toBeTruthy();
  });

  it("materializes scaffold rows only after they receive content", async () => {
    const onSourceChange = vi.fn();
    await renderEditor("@sheet Report", onSourceChange);

    const header = screenInput("Header A");
    focusInput(header);
    changeInput(header, "Name");
    act(() => header.blur());
    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Report\n@header | Name |");

    changeInput(screenInput("Defaults A"), "Pending");
    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Report\n@header | Name |\n@defaults | Pending |");
  });

  it("pastes TSV ranges and supports undo and redo", async () => {
    const onSourceChange = vi.fn();
    const readText = vi.fn().mockResolvedValue("X\tY");
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { readText } });
    await renderEditor("@sheet Report\n| A | B |", onSourceChange);

    clickElement(screenCell("A1"));
    pressKey(screenCell("A1"), "v", { ctrlKey: true });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(readText).toHaveBeenCalledTimes(1);
    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Report\n| X | Y |");

    pressKey(screenCell("A1"), "z", { ctrlKey: true });
    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Report\n| A | B |");

    pressKey(screenCell("A1"), "y", { ctrlKey: true });
    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Report\n| X | Y |");
  });

  it("pastes multi-row TSV ranges through the visual editor", async () => {
    const onSourceChange = vi.fn();
    const readText = vi.fn().mockResolvedValue("X\tY\nZ\t9");
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { readText } });
    await renderEditor("@sheet Report\n| A | B |", onSourceChange);

    clickElement(screenCell("A1"));
    pressKey(screenCell("A1"), "v", { ctrlKey: true });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      await Promise.resolve();
    });

    expect(onSourceChange).toHaveBeenLastCalledWith("@sheet Report\n| X | Y |\n| Z | 9 |");
  });

  it("uses a simplified editable grid for embedded CSV sheets", async () => {
    await renderEditor("@sheet RawData [csv]\nname,amount\nAda,5", vi.fn());

    expect(screenCell("A2").textContent).toContain("Ada");
    expect(Array.from(document.querySelectorAll("button")).some((button) => button.textContent?.includes("Bold"))).toBe(false);
  });
});

async function renderEditor(
  source: string,
  onSourceChange: (source: string) => void,
  props: Partial<Extract<Parameters<typeof CelloVisualEditor>[0], { source: string }>> = {}
): Promise<void> {
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
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

function screenCell(label: string): HTMLTableCellElement {
  const cell = document.querySelector<HTMLTableCellElement>(`td[role="gridcell"][aria-label="${label}"]`);
  expect(cell).toBeTruthy();
  return cell!;
}

function screenRowHeader(rowNumber: number): HTMLTableCellElement {
  const header = document.querySelector<HTMLTableCellElement>(`th[role="rowheader"][aria-rowindex="${rowNumber}"]`);
  expect(header).toBeTruthy();
  return header!;
}

function screenColumnHeader(name: string): HTMLTableCellElement {
  const header = Array.from(document.querySelectorAll<HTMLTableCellElement>("th[role='columnheader']")).find((candidate) => candidate.textContent === name);
  expect(header).toBeTruthy();
  return header!;
}

function screenCellDisplay(label: string): HTMLElement {
  const display = screenCell(label).querySelector<HTMLElement>(".celloVisualCellDisplay");
  expect(display).toBeTruthy();
  return display!;
}

function screenCellText(label: string): string {
  return screenCellDisplay(label).textContent ?? "";
}

function editCell(label: string): HTMLTextAreaElement {
  act(() => {
    screenCell(label).dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
  });
  const editor = document.querySelector<HTMLTextAreaElement>(`textarea[aria-label="${label}"]`);
  expect(editor).toBeTruthy();
  return editor!;
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

function clickElement(element: HTMLElement | null, init: MouseEventInit = {}): void {
  expect(element).toBeTruthy();
  act(() => {
    element?.dispatchEvent(new MouseEvent("click", { bubbles: true, ...init }));
  });
}

function focusInput(input: HTMLInputElement | HTMLTextAreaElement): void {
  act(() => {
    input.focus();
  });
}

function pressKey(element: Element, key: string, init: KeyboardEventInit = {}): void {
  act(() => {
    element.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, ...init }));
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
  const option = Array.from(document.querySelectorAll<HTMLButtonElement>(".celloVisualValueOptions button")).find((candidate) => candidate.textContent === optionLabel);
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
