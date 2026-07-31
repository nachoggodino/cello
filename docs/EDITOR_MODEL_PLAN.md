# Editor model implementation plan

## Goal

Provide source, visual, and HTML preview views over one source-authoritative Cello
document. Visual commands must preserve unrelated source, tolerant parsing must keep
recoverable workbook content available, and all derived results must correspond to a
known source revision.

## Decisions

- Source is authoritative. The workbook is a recoverable semantic projection.
- Parsing is tolerant; diagnostics do not freeze preview or visual mode.
- Source locations and semantic nodes come from one parsing pass.
- Visual commands produce source edits, reparse, and verify their postconditions.
- Ambiguous commands fail without changing source. Unrelated malformed source remains.
- Native Cello sheets are visually editable first. Other sheet formats remain read-only.
- Unknown bracket suffixes in cells are text unless they form a recognized trailing
  modifier suffix.
- Comments, unknown syntax, and malformed fragments are preserved conservatively.
- Source layout is `compact` or `pretty`. New sessions default to `compact`.
- Compact retains both outer row pipes and removes structural padding only.
- Pretty formatting is best-effort over the affected contiguous table block. A
  formatting failure never blocks an otherwise safe semantic command.
- Full Compact and Pretty commands format recognized native regions only.
- Source and visual histories are independent. A content change from one mode clears
  the other mode undo and redo history; switching views and saving do not.
- Active sheet is shared ephemeral session state. Active mode and view-local selection
  remain host/view state.
- Public whole-workbook serializers will be removed in Phase 9. Small syntax emitters
  remain internal for commands that create new source.

## Target model

```ts
interface EditorDocument {
  source: string;
  workbook: EditorWorkbook;
  sourceMap: CelloSourceMap;
  diagnostics: Diagnostic[];
}
```

The raw `source` retains every byte, including comments, blank lines, unknown syntax,
malformed fragments, spacing, and line endings. `CelloSourceMap` maps recognized
sheet, row, and cell syntax back to exact spans and records provenance such as explicit
empty cells versus omitted or default-derived values. It deliberately does not build a
second trivia AST: commands patch recognized spans and leave all unrelated raw source
untouched. Revisions live in the framework-independent session rather than in this
immutable document snapshot.

```ts
interface EditorSessionSnapshot {
  revision: number;
  source: string;
  document: EditorDocument;
  sourceLayout: "compact" | "pretty";
  activeSheetName: string;
  histories: {
    source: EditorSessionHistoryState;
    visual: EditorSessionHistoryState;
  };
}
```

## Command invariant

```text
validate command and revision
  -> resolve syntax target
  -> create minimal source edits
  -> apply selected layout to the affected scope
  -> reparse once
  -> verify the intended semantic postcondition
  -> publish the new revision
```

A command never reports success if the reparsed workbook does not contain its intended
change.

## Migration phases

1. **Complete:** Add fidelity regressions and fail-closed postcondition checks.
2. **Complete:** Replace the independent editor source-map parser with source locations from core.
3. **Complete:** Preserve explicit, empty, omitted, and default-derived source provenance.
4. **Complete:** Implement scoped Compact and Pretty formatters over the source-aware document.
5. **Complete and hardened:** Move editor commands from workbook mutation to document
   commands. Commands are validated before reduction, batches validate atomically
   against their evolving workbook, and structural insertion preserves surrounding
   trivia and source line endings.
6. **Complete:** Introduce a framework-independent session with revisions, shared active
   sheet and layout state, stale-revision rejection, and independently invalidated
   source/visual histories.
7. **Complete:** Adapt the visual editor to session-owned history and add source and
   revision-safe HTML preview React views. The controlled visual API remains available.
8. **Complete:** Add a thin optional tabbed workbench and rebuild the playground on
   one session through the public source, preview, and visual React views. Remove the
   superseded playground renderer, source editor, and synchronization paths.
9. **Complete:** Remove public whole-workbook serializers and the serialize CLI command.
   Retain only internal syntax emitters used by source-preserving document commands,
   and update docs plus package contracts around source-authoritative editing.

## Acceptance invariants

- Parsing and taking no action preserves the source byte-for-byte.
- A cell command changes only its target plus formatting explicitly authorized by the
  selected source layout.
- Pretty and Compact are idempotent and preserve workbook semantics.
- Comments, unknown syntax, and unrelated malformed fragments survive commands.
- Default-derived cells do not become explicit as a side effect of structural edits.
- Commands against ambiguous mappings fail without source changes.
- Evaluation and preview discard results from stale revisions.
- Foreign-mode changes clear the other mode history; view switching does not.
