import { evaluate, parse } from "../../core/src/internal.js";
import type { EvaluateOptions, ParseOptions } from "../../core/src/internal.js";
import type { CellAddress, ComputedCellValues } from "./model.js";
import { rejectExternalSource } from "./options.js";

export interface EvaluateEditorWorkbookOptions {
  evaluate?: EvaluateOptions;
  parse?: Omit<ParseOptions, "readExternalSource"> & {
    readExternalSource?: ParseOptions["readExternalSource"];
  };
}

export function getCellAddressKey(address: CellAddress): string {
  return `${address.sheetIndex}:${address.rowIndex}:${address.colIndex}`;
}

export async function evaluateEditorWorkbookSource(source: string, options: EvaluateEditorWorkbookOptions = {}): Promise<ComputedCellValues> {
  const ast = parse(source, {
    ...options.parse,
    readExternalSource: options.parse?.readExternalSource ?? rejectExternalSource
  });
  const evaluated = await evaluate(ast, options.evaluate);
  const values: ComputedCellValues = {};

  for (const [sheetIndex, sheet] of evaluated.sheets.entries()) {
    for (const row of sheet.rows) {
      for (const cell of row.cells) {
        if (cell.kind === "formula") {
          values[getCellAddressKey({ sheetIndex, rowIndex: row.index - 1, colIndex: cell.col - 1 })] = cell.computed ?? null;
        }
      }
    }
  }

  return values;
}
