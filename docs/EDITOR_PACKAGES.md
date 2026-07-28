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

## Relationship To Core

The editor packages build on the core parser, evaluator, renderer, serializer, and shared presentation/layout helpers. Core remains the stable API for non-UI workflows:

```ts
import { evaluate, format, parse, render, serialize, validate } from "@nachoggodino/cello";
```

## Styles

`@nachoggodino/cello/editor-react/styles.css` is a separate export so React hosts can choose where to load it. The npm package smoke test verifies that this stylesheet is included in the published tarball.
