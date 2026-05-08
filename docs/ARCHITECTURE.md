# Architecture

## Pipeline

1. `parse(text)` -> AST
2. `evaluate(ast)` -> AST with computed formula values when possible
3. `render(text|ast)` -> self-contained HTML
4. `serialize(ast)` -> `.cel` text

## Main modules

- `src/parse.ts`
  - Parses workbook/sheets/rows/cells
  - Handles `@sheet`, headers, row names, merges, formats (`csv/tsv/markdown/json`)
  - Emits parser diagnostics

- `src/evaluate.ts`
  - Deep-clones AST
  - Builds per-sheet matrix for HyperFormula
  - Evaluates formula cells and writes `computed`
  - Emits diagnostics on evaluation failures

- `src/render.ts`
  - Parses + evaluates (if input is text)
  - Generates HTML tabs + tables
  - Applies basic inline formatting and cell-level styles

- `src/serialize.ts`
  - Converts AST back to `.cel` text for roundtrip workflows

## Design notes

- BYLAWS-first behavior is normative for syntax decisions.
- Current evaluator lacks a Cello-reference translation layer (named refs).
- Parsing is permissive by design; unknown constructs tend to degrade to text/diagnostics.
