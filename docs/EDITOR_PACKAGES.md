# Editor Packages

Cello publishes optional editor integration entry points from the main npm package.

## `@nachoggodino/cello/editor-core`

Use `editor-core` when building a visual editor, structured editor, or language-server-like integration that needs to preserve source text while applying workbook edits.

It provides:

- Source-preserving editor document and workbook models
- Commands for workbook, sheet, row, column, cell, and modifier edits
- Selectors for deriving UI state from the editor model
- Serialization helpers for writing changes back to `.cel`
- Evaluation helpers for formula-aware editor previews

```ts
import {
  applyWorkbookPatch,
  createEditorDocument,
  updateCellRaw
} from "@nachoggodino/cello/editor-core";

const document = createEditorDocument(source);
const workbook = updateCellRaw(document.workbook, { sheetIndex: 0, rowIndex: 0, colIndex: 0 }, "Revenue");
const result = applyWorkbookPatch(document, workbook);

if (result.ok) {
  console.log(result.source);
}
```

## `@nachoggodino/cello/editor-react`

Use `editor-react` when embedding the visual editor in a React application.

```tsx
import { CelloVisualEditor } from "@nachoggodino/cello/editor-react";
import "@nachoggodino/cello/editor-react/styles.css";

export function Editor({ source, onChange }: { source: string; onChange: (source: string) => void }) {
  return <CelloVisualEditor source={source} onSourceChange={onChange} />;
}
```

The component is designed for app hosts that own source persistence. It emits updated `.cel` text through `onSourceChange`; callers decide when and where to save it.

### Visual editor interaction model

The visual editor treats each native Cello sheet as a finite table:

- The grid contains the source row count and the maximum source column count.
- Ragged source rows render blank intersections inside that rectangle.
- No viewport padding, append row, or append column is generated.
- Native sheets without an `@header` show one virtual header/default configuration row. These rows are materialized in source only after receiving content or column formatting.
- An untouched empty sheet remains only an `@sheet` declaration in source; adding the first data row creates a one-cell row while keeping the virtual configuration rows available.
- Rows and columns are added only through explicit toolbar commands.

Single click selects a cell and double-click enters pointer editing at the clicked caret position. Printable typing replaces the active cell, while F2 edits the existing value. Left and Right move the caret during pointer editing; replacement editing keeps spreadsheet-style arrow commit-and-move behavior. Enter commits and moves down, Tab commits horizontally, and Escape cancels. Navigation stops at the table boundary and focus returns to the grid after a commit.

Shift-click, Shift+Arrow, and pointer dragging extend a rectangular selection. Row and column identifiers select source-bounded rows and columns. Formatting scope is derived from the selection: ordinary rectangles use cell modifiers, row selections use row modifiers, and column or semantic header selections use column modifiers.

The editor address tag reports cells (`Report!B3`), ranges (`Report!B3:D8`), rows (`Report!3:8`), and columns (`Report!B:D`).

Range commands are atomic and source-preserving. If an operation cannot be expressed as source patches, the editor reports a command failure instead of serializing and rewriting unrelated source.

`minimumVisibleRows`, `minimumVisibleColumns`, and the `layout` component property were removed because they conflicted with the finite-table model.

## Relationship To Core

The editor packages build on the core parser, evaluator, renderer, serializer, and shared presentation/layout helpers. Core remains the stable API for non-UI workflows:

```ts
import { evaluate, format, parse, render, serialize, validate } from "@nachoggodino/cello";
```

## Styles

`@nachoggodino/cello/editor-react/styles.css` is a separate export so React hosts can choose where to load it. The npm package smoke test verifies that this stylesheet is included in the published tarball.
