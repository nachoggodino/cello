import type {
  CellAddress,
  ColorModifierKey,
  MergeDirection,
  SheetColumnsMode,
  SheetRowsMode,
  TextTone,
  ToggleModifierKey
} from "./model.js";
import type { CellRange } from "./ranges.js";

export type EditorCommandTarget =
  | { scope: "cell"; addresses: CellAddress[] }
  | { scope: "row"; addresses: CellAddress[] }
  | { scope: "column"; sheetIndex: number; colIndexes: number[] };

export type EditorDocumentCommand =
  | {
      type: "update-cell";
      address: CellAddress;
      source: string;
      mode: "source" | "content" | "raw";
    }
  | { type: "update-default"; sheetIndex: number; colIndex: number; source: string; ensureHeader?: boolean }
  | { type: "update-header"; sheetIndex: number; colIndex: number; source: string }
  | { type: "update-modifiers"; target: EditorCommandTarget; source: string }
  | { type: "toggle-modifier"; target: EditorCommandTarget; key: ToggleModifierKey }
  | { type: "set-color"; target: EditorCommandTarget; key: ColorModifierKey; value: string }
  | { type: "set-tone"; target: EditorCommandTarget; value: TextTone }
  | { type: "set-sheet-columns"; sheetIndex: number; mode?: SheetColumnsMode }
  | { type: "set-sheet-rows"; sheetIndex: number; mode?: SheetRowsMode }
  | { type: "toggle-column-fit"; sheetIndex: number; colIndex: number }
  | { type: "set-column-width"; sheetIndex: number; colIndex: number; value?: string }
  | { type: "toggle-row-wrap"; address: CellAddress }
  | { type: "set-row-height"; address: CellAddress; value?: string }
  | { type: "merge-cell"; address: CellAddress; direction: MergeDirection }
  | { type: "add-row"; sheetIndex: number; afterRowIndex?: number }
  | { type: "add-column"; sheetIndex: number; afterColIndex?: number }
  | { type: "add-sheet" }
  | { type: "remove-sheet"; sheetIndex: number }
  | { type: "rename-sheet"; sheetIndex: number; name: string }
  | { type: "clear-range"; range: CellRange; includeModifiers: boolean }
  | { type: "fill-range"; range: CellRange; source: string }
  | { type: "paste-matrix"; start: CellAddress; matrix: string[][] }
  | { type: "batch"; commands: EditorDocumentCommand[] };
