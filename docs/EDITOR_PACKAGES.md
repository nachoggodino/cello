# Editor Packages

Cello publishes optional editor integration entry points from the main npm package.

## `@nachoggodino/cello/editor-core`

Use `editor-core` when building a visual editor, structured editor, or language-server-like integration that needs to preserve source text while applying workbook edits.

It provides:

- Source-preserving editor document and workbook models
- A revisioned framework-independent session shared by source, preview, and visual views
- Independent bounded source and visual histories with foreign-mode invalidation
- Serializable document commands for workbook, sheet, row, column, cell, and modifier edits
- Selectors for deriving UI state from the editor model
- Verified source-patch execution for writing command changes back to `.cel`
- Evaluation helpers for formula-aware editor previews

```ts
import {
  createEditorDocument,
  executeEditorCommand
} from "@nachoggodino/cello/editor-core";

const document = createEditorDocument(source);
const result = executeEditorCommand(document, {
  type: "update-cell",
  address: { sheetIndex: 0, rowIndex: 0, colIndex: 0 },
  source: "Revenue",
  mode: "raw"
});

if (result.ok) {
  console.log(result.source);
}
```

`EditorDocumentCommand` is a discriminated union and contains only plain data, so
hosts can create, serialize, validate, log, or replay the same commands used by the
React editor. `executeEditorCommand` returns the updated source and reparsed document
only after the requested semantic change has been verified. Invalid commands fail
without changing source. Batch commands validate atomically against their evolving
workbook, so one invalid child prevents every child from being applied.

For applications that mount more than one editor mode, create one session:

```ts
import { createEditorSession } from "@nachoggodino/cello/editor-core";

const session = createEditorSession({
  source,
  sourceLayout: "compact"
});

session.subscribe(() => {
  save(session.getSnapshot().source);
});

session.execute({
  type: "update-cell",
  address: { sheetIndex: 0, rowIndex: 0, colIndex: 0 },
  source: "Revenue",
  mode: "content"
}, {
  expectedRevision: session.getSnapshot().revision
});
```

The session revision changes only when source changes. Active-sheet and selected-layout
updates publish a new snapshot without inventing a source revision. Source edits clear
visual undo/redo; visual edits clear source undo/redo. View switching and active-sheet
changes do neither.

## `@nachoggodino/cello/editor-react`

Use `editor-react` when embedding any native Cello view in a React application.

```tsx
import type { EditorSession } from "@nachoggodino/cello/editor-core";
import {
  CelloHtmlPreview,
  CelloSourceEditor,
  CelloVisualEditor,
  CelloWorkbench
} from "@nachoggodino/cello/editor-react";
import "@nachoggodino/cello/editor-react/styles.css";

export function EditorModes({ session }: { session: EditorSession }) {
  return (
    <>
      <CelloSourceEditor session={session} />
      <CelloVisualEditor session={session} />
      <CelloHtmlPreview session={session} />
    </>
  );
}
```

Hosts that want a ready-made tabbed surface can use the optional workbench instead:

```tsx
<CelloWorkbench
  session={session}
  defaultActiveView="source"
  onActiveViewChange={(view) => saveViewPreference(view)}
/>
```

`activeView` makes the tabs controlled; otherwise `defaultActiveView` initializes
workbench-local tab state. A host can restrict or reorder tabs with `views` and pass
view-specific options through `sourceEditorProps`, `visualEditorProps`, and
`htmlPreviewProps`. Active view remains UI state and never enters the document session,
so switching tabs cannot alter source or undo history.

`CelloSourceEditor` provides Cello syntax highlighting, line numbers, search, bracket
matching and closing, indentation, active-line and selection-match highlighting, grouped
typing undo, and Compact and Pretty commands. Its CodeMirror history is disabled:
keyboard and toolbar undo/redo always use the session's source history, so a visual edit
still invalidates source undo exactly once at the shared model boundary.
`CelloHtmlPreview` is read-only, shares the active sheet, and never commits HTML from
a stale revision. `CelloVisualEditor` accepts the same session and uses its visual
history. Parse options such as `baseDir`, `strict`, and `readExternalSource` are
configured once on the session and reused by both visual evaluation and preview
rendering.

The repository playground intentionally composes the three public views directly over
one session because it uses a side-by-side source/preview layout on desktop. It does not
maintain a second editor model, renderer hook, or mode synchronization layer.

The existing controlled visual API remains supported for a single embedded editor:

```tsx
<CelloVisualEditor source={source} onSourceChange={onChange} />
```

### React editor internals

The React adapter keeps its public component API small while separating internal
responsibilities by change axis:

- `components/` contains toolbar, sheet-tab, grid-row, and reusable control views.
- `hooks/` owns asynchronous visual evaluation and the controlled-mode history fallback.
- `interactions/` translates grid keyboard and pointer behavior into editor actions.
- `selection.ts` and `derivedSelection.ts` contain React-independent selection logic.
- `fitColumns.ts` and `textPresentation.tsx` isolate DOM measurement and display formatting.
- `types.ts` and `labels.ts` define the public host contract and default copy.

Document command reduction, revisions, and cross-mode history rules remain in
`editor-core`; React modules subscribe and dispatch but do not duplicate parsing,
serialization, or source-patching rules.

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

Range and batch commands are atomic and source-preserving. Structural insertions retain
comments, blank lines, original row spacing, and source line endings. If an operation
cannot be expressed as source patches, the editor reports a command failure instead of
serializing and rewriting unrelated source.

`minimumVisibleRows`, `minimumVisibleColumns`, and the `layout` component property were removed because they conflicted with the finite-table model.

## Relationship To Core

The editor packages build on the core parser, evaluator, renderer, formatter, and shared presentation/layout helpers. Core remains the stable API for non-UI workflows:

```ts
import { evaluate, format, formatSource, parse, render, validate } from "@nachoggodino/cello";
```

Neither core nor editor-core exposes a whole-workbook serializer. Hosts retain source
as the authoritative document and use `formatSource` or editor commands to produce
source-preserving changes.

## Styles

`@nachoggodino/cello/editor-react/styles.css` is a separate export so React hosts can choose where to load it. The npm package smoke test verifies that this stylesheet is included in the published tarball.
