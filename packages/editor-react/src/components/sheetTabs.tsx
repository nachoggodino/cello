import type { EditorWorkbook } from "../../../editor-core/src/internal.js";
import { IconButton } from "./controls.js";
import type { CelloVisualEditorLabels } from "../types.js";

export function SheetTabs({
  activeSheetIndex,
  labels,
  workbook,
  onActivate,
  onAdd,
  onRemove,
  onRename
}: {
  activeSheetIndex: number;
  labels: CelloVisualEditorLabels;
  workbook: EditorWorkbook;
  onActivate: (sheetIndex: number) => void;
  onAdd: () => void;
  onRemove: () => void;
  onRename: (name: string) => void;
}) {
  const activeSheet = workbook.sheets[activeSheetIndex];

  return (
    <div className="celloVisualSheetTabs" role="tablist" aria-label={labels.workbookSheets}>
      {workbook.sheets.map((sheet, sheetIndex) => (
        <button
          key={`${sheet.name}-${sheetIndex}`}
          type="button"
          role="tab"
          aria-selected={activeSheetIndex === sheetIndex}
          className={activeSheetIndex === sheetIndex ? "active" : ""}
          onClick={() => {
            onActivate(sheetIndex);
          }}
        >
          {sheet.name}
        </button>
      ))}
      <IconButton label={labels.newSheet} icon="sheetPlus" className="celloVisualPrimaryAction" onClick={onAdd} />
      <input
        className="celloVisualSheetNameInput"
        aria-label={labels.renameSheet}
        value={activeSheet?.name ?? ""}
        onChange={(event) => {
          onRename(event.target.value);
        }}
      />
      <IconButton label={labels.deleteSheet} icon="trash" disabled={workbook.sheets.length <= 1} onClick={onRemove} />
    </div>
  );
}
