import { beforeEach, describe, expect, it, vi } from "vitest";
import { evaluate } from "../../../src/evaluator/evaluate.js";
import { formulaCell, sheet, valueCell, workbook } from "../../helpers/ast.js";

const buildFromSheetsMock = vi.fn();

vi.mock("hyperformula", () => ({
  HyperFormula: {
    buildFromSheets: buildFromSheetsMock
  }
}));

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

    const ast = workbook([
      sheet({
        name: "S",
        columns: 3,
        rows: [{ index: 1, kind: "data", sourceLine: 1, modifiers: [], cells: [valueCell(1, 1, 1), valueCell(1, 2, 2), formulaCell(1, 3, "=A1+B1")] }]
      })
    ]);
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

    const ast = workbook([{ ...sheet({ name: "S", columns: 1, rows: [{ index: 1, kind: "data", sourceLine: 1, modifiers: [], cells: [formulaCell(1, 1, "=1+1")] }] }) }]);
    const out = await evaluate(ast);
    expect(out.diagnostics.some((d) => d.level === "error" && d.message.includes("boom"))).toBe(true);
  });

  it("throws on HyperFormula failure when strict is true", async () => {
    buildFromSheetsMock.mockImplementation(() => {
      throw new Error("hard-fail");
    });

    const ast = workbook([sheet({ name: "S", columns: 1, rows: [{ index: 1, kind: "data", sourceLine: 1, modifiers: [], cells: [formulaCell(1, 1, "=1+1")] }] })]);
    await expect(evaluate(ast, { strict: true })).rejects.toThrow("hard-fail");
  });

  it("skips sheets that do not resolve to a HyperFormula sheet id", async () => {
    buildFromSheetsMock.mockReturnValue({
      getSheetId: vi.fn(() => undefined),
      getCellValue: vi.fn(() => 123)
    });

    const ast = workbook([sheet({ name: "S", columns: 1, rows: [{ index: 1, kind: "data", sourceLine: 1, modifiers: [], cells: [formulaCell(1, 1, "=1+1")] }] })]);
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

    const ast = workbook([
      sheet({
        name: "S",
        columns: 2,
        rows: [{ index: 1, kind: "data", sourceLine: 1, modifiers: [], cells: [formulaCell(1, 1, "=A1"), formulaCell(1, 2, "=B1")] }]
      })
    ]);
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

    const ast = workbook([
      sheet({
        name: "S",
        columns: 2,
        rows: [{ index: 1, kind: "data", sourceLine: 1, modifiers: [], cells: [formulaCell(1, 1, "=1+"), formulaCell(1, 2, "=1/0")] }]
      })
    ]);
    const out = await evaluate(ast);

    expect(out.sheets[0].rows[0].cells[0].computed).toBe("=1+");
    expect(out.sheets[0].rows[0].cells[1].computed).toBe("#DIV/0!");
  });
});
