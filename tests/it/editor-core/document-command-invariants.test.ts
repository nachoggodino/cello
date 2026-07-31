import { describe, expect, it } from "vitest";
import {
  createEditorDocument,
  executeEditorCommand,
  getCellAt,
  getCellContentText,
  getDefaultCellAt,
  getRowAt,
  getVisibleColumnCount
} from "../../../packages/editor-core/src/internal.js";
import type { CreateEditorWorkbookOptions, EditorDocumentCommand, EditorSourceSpan, EditorWorkbook } from "../../../packages/editor-core/src/index.js";

type CommandType = EditorDocumentCommand["type"];

interface SuccessCase {
  name: string;
  source?: string;
  command: EditorDocumentCommand;
  options?: CreateEditorWorkbookOptions;
  idempotent?: boolean;
  verify: (workbook: EditorWorkbook) => void;
}

const LF = "\n";
const PRESERVED_BLOCK = ["// PRESERVE: unrelated sheet bytes", "@sheet Untouched", "| Keep | Wide |"].join(LF);
const REPRESENTATIVE_SOURCE = [
  "@tone notes [color:#334155][bg:#f8fafc]",
  "",
  "@sheet Main [mystery:keep]",
  "@header | Name [width:small] | Status | Amount |",
  "@defaults | | Pending | =1 |",
  "// malformed formula remains unrelated",
  "| Ada | | 5 |",
  "| Broken | Active | =SUM( |",
  "@unknown preserve-this",
  "",
  PRESERVED_BLOCK
].join(LF);
const STRUCTURAL_SOURCE = ["@sheet Main", "@header | Name | Amount |", "| Ada | 5 |", "", PRESERVED_BLOCK].join(LF);
const DEFAULT_SOURCE = ["@sheet Main", "@header | Name | Status |", "@defaults | | Pending |", "| Ada | Active |", "", PRESERVED_BLOCK].join(LF);

const commandTypeChecklist: Record<CommandType, true> = {
  "update-cell": true,
  "update-default": true,
  "update-header": true,
  "update-modifiers": true,
  "toggle-modifier": true,
  "set-color": true,
  "set-tone": true,
  "set-sheet-columns": true,
  "set-sheet-rows": true,
  "toggle-column-fit": true,
  "set-column-width": true,
  "toggle-row-wrap": true,
  "set-row-height": true,
  "merge-cell": true,
  "add-row": true,
  "add-column": true,
  "add-sheet": true,
  "remove-sheet": true,
  "rename-sheet": true,
  "clear-range": true,
  "fill-range": true,
  "paste-matrix": true,
  batch: true
};

const successCases: readonly SuccessCase[] = [
  {
    name: "updates a full cell source",
    command: { type: "update-cell", address: address(1, 0), source: "Grace[bold]", mode: "source" },
    idempotent: true,
    verify: (workbook) => {
      expect(cell(workbook, 1, 0).raw).toBe("Grace");
      expect(cell(workbook, 1, 0).modifiers.map((modifier) => modifier.key)).toContain("bold");
    }
  },
  {
    name: "updates a default-derived column",
    source: DEFAULT_SOURCE,
    command: { type: "update-default", sheetIndex: 0, colIndex: 1, source: "Queued" },
    idempotent: true,
    verify: (workbook) => expect(getDefaultCellAt(sheet(workbook, 0), 1).raw).toBe("Queued")
  },
  {
    name: "updates a column header",
    command: { type: "update-header", sheetIndex: 0, colIndex: 0, source: "Person" },
    idempotent: true,
    verify: (workbook) => expect(content(workbook, 0, 0)).toBe("Person")
  },
  {
    name: "updates cell modifiers",
    command: { type: "update-modifiers", target: { scope: "cell", addresses: [address(1, 0)] }, source: "[italic]" },
    idempotent: true,
    verify: (workbook) => expect(cell(workbook, 1, 0).modifiers.map((modifier) => modifier.key)).toEqual(["italic"])
  },
  {
    name: "toggles a row modifier",
    source: STRUCTURAL_SOURCE,
    command: { type: "toggle-modifier", target: { scope: "row", addresses: [address(1, 0)] }, key: "bold" },
    verify: (workbook) => expect(row(workbook, 1).modifiers.map((modifier) => modifier.key)).toContain("bold")
  },
  {
    name: "sets a column color",
    command: { type: "set-color", target: { scope: "column", sheetIndex: 0, colIndexes: [1] }, key: "bg", value: "#112233" },
    idempotent: true,
    verify: (workbook) => expect(cell(workbook, 0, 1).modifiers).toContainEqual(expect.objectContaining({ key: "bg", value: "#112233" }))
  },
  {
    name: "sets a cell tone",
    command: { type: "set-tone", target: { scope: "cell", addresses: [address(1, 0)] }, value: "ok" },
    verify: (workbook) => expect(cell(workbook, 1, 0).modifiers).toContainEqual(expect.objectContaining({ key: "tone", value: "ok" }))
  },
  {
    name: "sets sheet column layout",
    command: { type: "set-sheet-columns", sheetIndex: 0, mode: "fit" },
    idempotent: true,
    verify: (workbook) => expect(sheet(workbook, 0).layout?.columns).toBe("fit")
  },
  {
    name: "sets sheet row layout",
    command: { type: "set-sheet-rows", sheetIndex: 0, mode: "ellipsis" },
    idempotent: true,
    verify: (workbook) => expect(sheet(workbook, 0).layout?.rows).toBe("ellipsis")
  },
  {
    name: "toggles fitted columns",
    command: { type: "toggle-column-fit", sheetIndex: 0, colIndex: 1 },
    verify: (workbook) => expect(cell(workbook, 0, 1).modifiers.map((modifier) => modifier.key)).toContain("fit")
  },
  {
    name: "sets a column width",
    command: { type: "set-column-width", sheetIndex: 0, colIndex: 1, value: "large" },
    idempotent: true,
    verify: (workbook) => expect(cell(workbook, 0, 1).modifiers).toContainEqual(expect.objectContaining({ key: "width", value: "large" }))
  },
  {
    name: "toggles wrapped rows",
    source: STRUCTURAL_SOURCE,
    command: { type: "toggle-row-wrap", address: address(1, 0) },
    verify: (workbook) => expect(row(workbook, 1).modifiers.map((modifier) => modifier.key)).toContain("wrap")
  },
  {
    name: "sets row height",
    source: STRUCTURAL_SOURCE,
    command: { type: "set-row-height", address: address(1, 0), value: "tall" },
    idempotent: true,
    verify: (workbook) => expect(row(workbook, 1).modifiers).toContainEqual(expect.objectContaining({ key: "height", value: "tall" }))
  },
  {
    name: "merges a cell left",
    command: { type: "merge-cell", address: address(2, 1), direction: "left" },
    idempotent: true,
    verify: (workbook) => expect(cell(workbook, 2, 1).raw).toBe("<")
  },
  {
    name: "adds a row",
    source: STRUCTURAL_SOURCE,
    command: { type: "add-row", sheetIndex: 0, afterRowIndex: 1 },
    verify: (workbook) => expect(sheet(workbook, 0).rows).toHaveLength(3)
  },
  {
    name: "adds a column",
    source: STRUCTURAL_SOURCE,
    command: { type: "add-column", sheetIndex: 0, afterColIndex: 0 },
    verify: (workbook) => expect(getVisibleColumnCount(sheet(workbook, 0))).toBe(3)
  },
  {
    name: "adds a sheet",
    options: {},
    command: { type: "add-sheet" },
    verify: (workbook) => expect(workbook.sheets.map((candidate) => candidate.name)).toContain("Sheet3")
  },
  {
    name: "removes a sheet",
    command: { type: "remove-sheet", sheetIndex: 0 },
    verify: (workbook) => expect(workbook.sheets.map((candidate) => candidate.name)).toEqual(["Untouched"])
  },
  {
    name: "renames a sheet",
    command: { type: "rename-sheet", sheetIndex: 0, name: "Renamed" },
    idempotent: true,
    verify: (workbook) => expect(sheet(workbook, 0).name).toBe("Renamed")
  },
  {
    name: "clears a range",
    source: STRUCTURAL_SOURCE,
    command: { type: "clear-range", range: range(1, 1, 1, 1), includeModifiers: true },
    idempotent: true,
    verify: (workbook) => expect(content(workbook, 1, 1)).toBe("")
  },
  {
    name: "fills a range",
    command: { type: "fill-range", range: range(1, 1, 0, 1), source: "Filled" },
    idempotent: true,
    verify: (workbook) => expect([content(workbook, 1, 0), content(workbook, 1, 1)]).toEqual(["Filled", "Filled"])
  },
  {
    name: "pastes a matrix",
    command: { type: "paste-matrix", start: address(1, 0), matrix: [["Pasted", "Ready"]] },
    idempotent: true,
    verify: (workbook) => expect([content(workbook, 1, 0), content(workbook, 1, 1)]).toEqual(["Pasted", "Ready"])
  },
  {
    name: "applies a verified batch",
    command: {
      type: "batch",
      commands: [
        { type: "update-cell", address: address(1, 0), source: "Batched", mode: "content" },
        { type: "set-sheet-columns", sheetIndex: 0, mode: "fit" }
      ]
    },
    idempotent: true,
    verify: (workbook) => {
      expect(content(workbook, 1, 0)).toBe("Batched");
      expect(sheet(workbook, 0).layout?.columns).toBe("fit");
    }
  }
];

describe("editor document command invariants", () => {
  it("keeps the successful command corpus exhaustive", () => {
    expect(new Set(successCases.map((testCase) => testCase.command.type))).toEqual(new Set(Object.keys(commandTypeChecklist)));
  });

  for (const [index, testCase] of successCases.entries()) {
    it(testCase.name, () => {
      const lineEnding = index % 2 === 0 ? "\n" : "\r\n";
      const source = toLineEndings(testCase.source ?? REPRESENTATIVE_SOURCE, lineEnding);
      const document = createEditorDocument(source);
      const result = executeEditorCommand(document, testCase.command, testCase.options ?? { sourceLayout: index % 3 === 0 ? "pretty" : "compact" });

      expect(result.ok, result.ok ? undefined : result.message).toBe(true);
      if (!result.ok) {
        return;
      }

      testCase.verify(result.document.workbook);
      expect(result.document.source).toBe(result.source);
      expect(createEditorDocument(result.source).workbook).toEqual(result.document.workbook);
      expect(result.source).toContain(toLineEndings(PRESERVED_BLOCK, lineEnding));
      expectSourceMapSpans(
        result.source,
        result.document.sourceMap.sheets.flatMap((mappedSheet) => [
          mappedSheet.sheetSpan,
          ...mappedSheet.rows.flatMap((mappedRow) => [mappedRow.lineSpan, ...mappedRow.cells.flatMap((mappedCell) => [mappedCell.span, mappedCell.tokenSpan])])
        ])
      );
      expectLineEndings(result.source, lineEnding);

      if (testCase.idempotent) {
        const repeated = executeEditorCommand(result.document, testCase.command, testCase.options);
        expect(repeated.ok).toBe(true);
        expect(repeated.ok ? repeated.source : "").toBe(result.source);
      }
    });
  }

  it.each([
    {
      name: "invalid command",
      source: REPRESENTATIVE_SOURCE,
      command: { type: "remove-sheet", sheetIndex: 99 } satisfies EditorDocumentCommand,
      reason: "invalid-command"
    },
    {
      name: "ambiguous sheet identity",
      source: "@sheet Duplicate\n| A |\n@sheet Duplicate\n| B |",
      command: { type: "update-cell", address: address(0, 0), source: "X", mode: "content" } satisfies EditorDocumentCommand,
      reason: "unsupported-source-region"
    },
    {
      name: "unavailable external source",
      source: "@sheet Imported\n-> data.cel",
      command: { type: "update-cell", address: address(0, 0), source: "X", mode: "content" } satisfies EditorDocumentCommand,
      reason: "external-source-unavailable"
    },
    {
      name: "default-derived structural rewrite",
      source: "@sheet Main\n@header | Name | Status |\n@defaults | | Pending |\n| Ada | |",
      command: { type: "add-column", sheetIndex: 0 } satisfies EditorDocumentCommand,
      reason: "source-provenance-required"
    },
    {
      name: "default update with inherited cells",
      source: "@sheet Main\n@header | Name | Status |\n@defaults | | Pending |\n| Ada | |",
      command: { type: "update-default", sheetIndex: 0, colIndex: 1, source: "Queued" } satisfies EditorDocumentCommand,
      reason: "postcondition-failed"
    },
    {
      name: "non-roundtrippable payload",
      source: "| A |",
      command: { type: "update-cell", address: address(0, 0), source: "A|B", mode: "raw" } satisfies EditorDocumentCommand,
      reason: "postcondition-failed"
    },
    {
      name: "unsupported foreign modifier",
      source: "@sheet Raw [csv]\nname,amount\nAda,5",
      command: { type: "toggle-modifier", target: { scope: "cell", addresses: [address(1, 0)] }, key: "bold" } satisfies EditorDocumentCommand,
      reason: "unsupported-source-region"
    }
  ])("fails closed for $name", ({ source, command, reason }) => {
    const document = createEditorDocument(source);
    const result = executeEditorCommand(document, command);

    expect(result).toMatchObject({ ok: false, reason, document: { source } });
    expect(result.document).toBe(document);
    expect(result.document.workbook).toEqual(createEditorDocument(source).workbook);
  });
});

function address(rowIndex: number, colIndex: number) {
  return { sheetIndex: 0, rowIndex, colIndex };
}

function range(startRow: number, endRow: number, startCol: number, endCol: number) {
  return { sheetIndex: 0, startRow, endRow, startCol, endCol };
}

function sheet(workbook: EditorWorkbook, sheetIndex: number) {
  const value = workbook.sheets[sheetIndex];
  if (!value) {
    throw new Error(`Expected sheet ${sheetIndex}.`);
  }
  return value;
}

function row(workbook: EditorWorkbook, rowIndex: number) {
  const value = getRowAt(sheet(workbook, 0), rowIndex);
  if (!value) {
    throw new Error(`Expected row ${rowIndex}.`);
  }
  return value;
}

function cell(workbook: EditorWorkbook, rowIndex: number, colIndex: number) {
  return getCellAt(sheet(workbook, 0), rowIndex, colIndex);
}

function content(workbook: EditorWorkbook, rowIndex: number, colIndex: number): string {
  return getCellContentText(cell(workbook, rowIndex, colIndex));
}

function toLineEndings(source: string, lineEnding: string): string {
  return source.replaceAll("\n", lineEnding);
}

function expectLineEndings(source: string, lineEnding: string): void {
  if (lineEnding === "\r\n") {
    expect(source.replaceAll("\r\n", "")).not.toContain("\n");
  } else {
    expect(source).not.toContain("\r");
  }
}

function expectSourceMapSpans(source: string, spans: readonly EditorSourceSpan[]): void {
  for (const span of spans) {
    expect(span.start).toBeGreaterThanOrEqual(0);
    expect(span.end).toBeGreaterThanOrEqual(span.start);
    expect(span.end).toBeLessThanOrEqual(source.length);
  }
}
