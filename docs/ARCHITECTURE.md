# Architecture

## Pipeline

1. `parse(text)` -> AST
2. `evaluate(ast)` -> AST with computed formula values when possible
3. `render(text|ast)` -> self-contained HTML
4. `serialize(ast)` -> `.cel` text

## Main modules

- `src/parser/parse.ts`
  - Parses workbook/sheets/rows/cells
  - Handles `@sheet`, `@header`, rows, row modifiers, merges, external sheet source (`-> path`), formats (`csv/tsv/excel/markdown/json`)
  - Emits parser diagnostics

- `src/evaluator/evaluate.ts`
  - Deep-clones AST
  - Skips HyperFormula loading when the workbook contains no formulas
  - Builds per-sheet matrix for HyperFormula
  - Translates supported named references to A1 ranges before engine evaluation
  - Evaluates formula cells and writes `computed`
  - Emits diagnostics on evaluation failures

- `src/renderer/render.ts`
  - Parses text input, including external sheet sources through `baseDir`
  - Evaluates by default, with `evaluate: false` available for raw formula previews
  - Generates HTML tabs + tables
  - Applies inline formatting and style modifiers (`bold`, `italic`, `bg`, color)

- `src/serializer/serialize.ts`
  - Converts AST back to `.cel` text for roundtrip workflows

- `src/cli/serve.ts`
  - Serves a rendered workbook over local HTTP
  - Caches rendered HTML and refreshes it when the source file changes
  - Injects a small live-reload script for browser previews

## Design notes

- BYLAWS-first behavior is normative for syntax decisions.
- Named-reference translation is intentionally narrow: named columns and `!!` alias supported.
- Parsing is permissive by design; unknown constructs tend to degrade to text/diagnostics.
