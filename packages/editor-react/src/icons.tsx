export type EditorIconName = "column" | "format" | "mergeLeft" | "mergeUp" | "paint" | "row" | "sheet" | "trash";

const paths: Record<EditorIconName, string> = {
  column: "M5 4h14M7 8h4v12H7zM13 8h4v12h-4z",
  format: "M8 7h8M8 12h6M8 17h10M5 7h.01M5 12h.01M5 17h.01",
  mergeLeft: "M4 8h16M4 16h16M10 4v16M14 12H6m0 0 3-3m-3 3 3",
  mergeUp: "M8 4v16M16 4v16M4 10h16M12 14V6m0 0-3 3m3-3 3 3",
  paint: "M5 13l6-6 6 6-6 6zM14 4l6 6M4 20h16",
  row: "M4 5v14M8 7h12v4H8zM8 13h12v4H8z",
  sheet: "M6 3h9l5 5v13H6zM14 3v6h6M9 14h8M9 18h8",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3"
};

export function EditorIcon({ name }: { name: EditorIconName }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={paths[name]} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}
