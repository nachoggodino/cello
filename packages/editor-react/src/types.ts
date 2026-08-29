import type {
  CreateEditorWorkbookOptions,
  EditorCommandFailure,
  EditorDocument,
  EditorSession
} from "@nachoggodino/cello/editor-core";

export interface CelloVisualEditorLabels {
  bold: string;
  cellScope: string;
  columnScope: string;
  defaultsRow: string;
  deleteSheet: string;
  fillColor: string;
  h1: string;
  h2: string;
  h3: string;
  headerRow: string;
  inherited: string;
  italic: string;
  mergeLeft: string;
  mergeUp: string;
  newColumn: string;
  newRow: string;
  newSheet: string;
  noInheritedModifiers: string;
  modifiers: string;
  propertyScope: string;
  renameSheet: string;
  selectedColumn: string;
  selectedRow: string;
  rowScope: string;
  rowsMode: string;
  selectedCellSource: string;
  source: string;
  strike: string;
  tableGroup: string;
  textColor: string;
  textGroup: string;
  tone: string;
  toolbar: string;
  workbook: string;
  workbookSheets: string;
  columnsMode: string;
  defaultOption: string;
  columnsNormal: string;
  columnsFit: string;
  rowsEllipsis: string;
  rowsWrap: string;
  fit: string;
  width: string;
  wrap: string;
  height: string;
  filterAndSort: string;
  allRows: string;
  clearView: string;
  savedView: string;
  filterColumn: string;
  noSort: string;
  sortAscending: string;
  sortDescending: string;
  verticalMergeViewWarning: string;
}

interface CelloVisualEditorBaseProps {
  baseDir?: CreateEditorWorkbookOptions["baseDir"];
  className?: string;
  labels?: Partial<CelloVisualEditorLabels>;
  onRequestSourceView?: () => void;
  onCommandFailure?: (failure: EditorCommandFailure) => void;
  onDiagnosticsChange?: (diagnostics: EditorDocument["diagnostics"]) => void;
  readExternalSource?: CreateEditorWorkbookOptions["readExternalSource"];
  sourceLayout?: CreateEditorWorkbookOptions["sourceLayout"];
  strict?: CreateEditorWorkbookOptions["strict"];
}

export interface ControlledCelloVisualEditorProps extends CelloVisualEditorBaseProps {
  source: string;
  onSourceChange: (source: string) => void;
  activeSheetName?: string;
  onActiveSheetChange?: (sheetName: string) => void;
  session?: never;
}

export interface SessionCelloVisualEditorProps extends CelloVisualEditorBaseProps {
  session: EditorSession;
  onActiveSheetChange?: (sheetName: string) => void;
  source?: never;
  onSourceChange?: never;
  activeSheetName?: never;
}

export type CelloVisualEditorProps =
  | ControlledCelloVisualEditorProps
  | SessionCelloVisualEditorProps;
