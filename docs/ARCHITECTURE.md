# Architecture

## Pipeline

1. `parse(text)` -> AST
2. `evaluate(ast)` -> AST with computed formula values when possible
3. `render(text|ast)` -> self-contained HTML
4. `serialize(ast)` -> `.cel` text

## Main modules

- `packages/core/src/parser/parse.ts`
  - Parses workbook/sheets/rows/cells
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

- `packages/core/src/serializer/serialize.ts`
  - Converts AST back to `.cel` text for roundtrip workflows

- `packages/cli/src/serve.ts`
  - Serves a rendered workbook over local HTTP
  - Caches rendered HTML and refreshes it when the source file changes
  - Injects a small live-reload script for browser previews

- `packages/editor-core/src/`
  - Builds source-preserving editor documents from parsed workbooks
  - Applies workbook editing commands without requiring callers to manipulate AST internals
  - Provides selectors, serialization helpers, and evaluation helpers for editor hosts

- `packages/editor-react/src/`
  - Exposes `CelloVisualEditor` for React applications
  - Imports editor-core commands/selectors and core renderer/evaluator helpers
  - Ships its stylesheet through the `@nachoggodino/cello/editor-react/styles.css` export

- `packages/language-support/`
  - Stores reusable TextMate grammar and VS Code language configuration files
  - Is copied into the VS Code extension package during extension compilation

## Design notes

- BYLAWS-first behavior is normative for syntax decisions.
- Named-reference translation is intentionally narrow: named columns and `!!` alias supported.
- Parsing is permissive by design; unknown constructs tend to degrade to text/diagnostics.
- Published package entry points are validated by `tests/package-smoke.mjs` during `npm run build`.
