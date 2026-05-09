import { beforeEach, describe, expect, it, vi } from "vitest";
import { evaluate } from "../../../src/evaluator/evaluate.js";
import type { CellNode, WorkbookAst } from "../../../src/shared/types.js";

const buildFromSheetsMock = vi.fn();

vi.mock("hyperformula", () => ({
  HyperFormula: {
    buildFromSheets: buildFromSheetsMock
  }
}));

function createWorkbook(cells: CellNode[]): WorkbookAst {
  const maxCol = cells.reduce((max, cell) => Math.max(max, cell.col), 0);
  return {
    version: "1.0",
    diagnostics: [],
    sheets: [
      {
        name: "S",
        format: { kind: "cello" },
        columns: Array.from({ length: maxCol }, (_, index) => ({
          index: index + 1,
          letter: String.fromCharCode(65 + index),
          modifiers: [],
          hidden: false
        })),
        rows: [
          {
            index: 1,
            kind: "data",
            sourceLine: 1,
            modifiers: [],
            cells
          }
        ]
      }
    ]
  };
}

function valueCell(col: number, value: string | number | boolean): CellNode {
  return {
    row: 1,
    col,
    raw: String(value),
    kind: "value",
    inferredType: typeof value === "number" ? "number" : typeof value === "boolean" ? "boolean" : "text",
    value,
    modifiers: [],
    colspan: 1,
    rowspan: 1
  };
}

function formulaCell(col: number, formula: string): CellNode {
  return {
    row: 1,
    col,
    raw: formula,
    kind: "formula",
    inferredType: "text",
    value: formula,
    formula,
    modifiers: [],
    colspan: 1,
    rowspan: 1
  };
}

describe("evaluate (unit with mocked HyperFormula)", () => {
  beforeEach(() => {
    buildFromSheetsMock.mockReset();
  });

  it("maps sheet data to HyperFormula and writes computed values back", async () => {
    buildFromSheetsMock.mockReturnValue({
      getSheetId: vi.fn(() => 0),
      getCellValue: vi.fn(({ row, col }: { row: number; col: number }) => {
        if (row === 0 && col === 2) {
          return 99;
        }
        return null;
      })
    });

    const ast = createWorkbook([valueCell(1, 1), valueCell(2, 2), formulaCell(3, "=A1+B1")]);
    const out = await evaluate(ast);

    expect(buildFromSheetsMock).toHaveBeenCalledTimes(1);
    const callArg = buildFromSheetsMock.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(callArg)).toContain("S");
    expect(out.sheets[0].rows[0].cells[2].computed).toBe(99);
  });

  it("adds diagnostic on HyperFormula failure when strict is false", async () => {
    buildFromSheetsMock.mockImplementation(() => {
      throw new Error("boom");
    });

    const ast = createWorkbook([formulaCell(1, "=1+1")]);
    const out = await evaluate(ast);
    expect(out.diagnostics.some((d) => d.level === "error" && d.message.includes("boom"))).toBe(true);
  });

  it("throws on HyperFormula failure when strict is true", async () => {
    buildFromSheetsMock.mockImplementation(() => {
      throw new Error("hard-fail");
    });

    const ast = createWorkbook([formulaCell(1, "=1+1")]);
    await expect(evaluate(ast, { strict: true })).rejects.toThrow("hard-fail");
  });

  it("skips sheets that do not resolve to a HyperFormula sheet id", async () => {
    buildFromSheetsMock.mockReturnValue({
      getSheetId: vi.fn(() => undefined),
      getCellValue: vi.fn(() => 123)
    });

    const ast = createWorkbook([formulaCell(1, "=1+1")]);
    const out = await evaluate(ast);
    expect(out.sheets[0].rows[0].cells[0].computed).toBeUndefined();
  });

  it("normalizes non-primitive and undefined formula results", async () => {
    buildFromSheetsMock.mockReturnValue({
      getSheetId: vi.fn(() => 0),
      getCellValue: vi.fn(({ col }: { col: number }) => {
        if (col === 0) {
          return { value: 1 };
        }
        return undefined;
      })
    });

    const ast = createWorkbook([formulaCell(1, "=A1"), formulaCell(2, "=B1")]);
    const out = await evaluate(ast);
    expect(out.sheets[0].rows[0].cells[0].computed).toBe("[object Object]");
    expect(out.sheets[0].rows[0].cells[1].computed).toBeNull();
  });

  it("renders formula parse errors as raw formula text and other formula errors as error codes", async () => {
    buildFromSheetsMock.mockReturnValue({
      getSheetId: vi.fn(() => 0),
      getCellValue: vi.fn(({ col }: { col: number }) => {
        if (col === 0) {
          return { value: "#ERROR!", type: "ERROR", message: "Parsing error. bad formula" };
        }
        return { value: "#DIV/0!", type: "DIV_BY_ZERO", message: "" };
      })
    });

    const ast = createWorkbook([formulaCell(1, "=1+"), formulaCell(2, "=1/0")]);
    const out = await evaluate(ast);

    expect(out.sheets[0].rows[0].cells[0].computed).toBe("=1+");
    expect(out.sheets[0].rows[0].cells[1].computed).toBe("#DIV/0!");
  });
});
