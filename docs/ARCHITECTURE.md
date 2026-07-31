# Architecture

## Pipeline

1. `parse(text)` -> AST, or `parseDocument(text)` -> source + AST + source map
2. `evaluate(ast)` -> AST with computed formula values when possible
3. `render(text|ast)` -> self-contained HTML

## Main modules

- `packages/core/src/parser/parse.ts`
  - Parses workbook/sheets/rows/cells
  - Produces semantic nodes and accepted source locations in the same tolerant pass through `parseDocument`
  - Records whether native cells are explicit values, explicit empty cells, or omitted, and whether their values are default-derived
  - Handles `@sheet`, `@header`, `@defaults`, rows, row modifiers, merges, external sheet source (`-> path`), formats (`csv/tsv/excel/markdown/json`)
  - Emits parser diagnostics

- `packages/core/src/evaluator/evaluate.ts`
  - Deep-clones AST
  - Skips HyperFormula loading when the workbook contains no formulas
  - Builds per-sheet matrix for HyperFormula
  - Translates supported named references to A1 ranges before engine evaluation
  - Evaluates formula cells and writes `computed`
  - Emits diagnostics on evaluation failures

- `packages/core/src/renderer/render.ts`
  - Parses text input, including external sheet sources through `baseDir`
  - Evaluates by default, with `evaluate: false` available for raw formula previews
  - Generates HTML tabs + tables
  - Applies inline formatting and style modifiers (`bold`, `italic`, `bg`, color)

- `packages/core/src/formatter/`
  - Keeps the legacy `format(text)` Pretty API
  - Provides Compact, Pretty, and range-scoped formatting through `formatSource`
  - Uses parser-produced source locations and never materializes omitted cells

- `packages/cli/src/serve.ts`
  - Serves a rendered workbook over local HTTP
  - Caches rendered HTML and refreshes it when the source file changes
  - Injects a small live-reload script for browser previews

- `packages/editor-core/src/`
  - Builds source-preserving editor documents from core `parseDocument` results
  - Treats core source locations as authoritative instead of parsing document structure again
  - Uses cell provenance to avoid accidentally materializing inherited defaults during structural edits
  - Applies a selected source layout only to table blocks affected by visual commands
  - Keeps equality and layout orchestration outside the source patching module
  - Exposes serializable, discriminated document commands through `executeEditorCommand`
  - Validates commands before reduction; batch validation is atomic and follows the
    workbook produced by each preceding child command
  - Reduces commands internally, creates minimal source patches, reparses once, and
    verifies the semantic postcondition
  - Anchors structural insertions to recognized rows while retaining surrounding
    comments, blank lines, spacing, malformed source, and CRLF/LF line endings
  - Uses internal cell, row, declaration, and new-sheet syntax emitters only where a
    command must create syntax; no whole-workbook serializer is public
  - Provides a synchronous framework-independent session with immutable snapshots,
    monotonic source revisions, shared active-sheet/layout state, and bounded source
    and visual histories
  - Rejects commands against stale revisions; changes from one editing mode clear the
    other mode's undo and redo history
  - Provides selectors, serialization helpers, and evaluation helpers for editor hosts

- `packages/editor-react/src/`
  - Exposes `CelloSourceEditor`, `CelloHtmlPreview`, `CelloVisualEditor`, and the
    optional tabbed `CelloWorkbench` for React applications
  - Subscribes to editor sessions through `useSyncExternalStore`, keeping React state
    out of the framework-independent session
  - Uses React CodeMirror for the source surface with an internal Cello language
    extension aligned to the packaged TextMate grammar; CodeMirror history is disabled
    in favor of session source history
  - Discards asynchronous preview results whose source revision is no longer current
  - Shares active-sheet changes made in preview tabs or the visual editor
  - Dispatches editor-core document commands and imports selectors plus core renderer/evaluator helpers
  - Keeps finite-table cell, row, column, and merged-range selection logic in `selection.ts`
  - Ships its stylesheet through the `@nachoggodino/cello/editor-react/styles.css` export

- `apps/playground/src/`
  - Composes the public source, preview, and visual React views over one editor session
  - Keeps only playground-specific chrome such as examples, split resizing, diagnostics,
    copying, downloads, and the syntax reference

- `packages/language-support/`
  - Stores reusable TextMate grammar and VS Code language configuration files
  - Is copied into the VS Code extension package during extension compilation

## Design notes

- BYLAWS-first behavior is normative for syntax decisions.
- Named-reference translation is intentionally narrow: named columns and `!!` alias supported.
- Parsing is permissive by design; unknown constructs tend to degrade to text/diagnostics.
- Published package entry points are validated by `tests/package-smoke.mjs` during `npm run build`.
