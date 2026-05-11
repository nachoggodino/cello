# cello (scaffold)

TypeScript scaffold for the Cello reference library.

## Implemented now

- `parse(text)` -> AST
- `evaluate(ast)` -> AST with formula values (via HyperFormula when available)
- `render(input)` -> self-contained HTML with sheet tabs
- `serialize(ast)` -> `.cel` text
- `cello` CLI (`parse`, `evaluate`, `render`, `serialize`)
- Named column references translated for evaluation:
  - `=SUM(Price)`
  - `=Price/Units`
  - `=SUM(Price[2:10])`
  - `=SUM(Price[*])`
  - `=SUM(Data!Amount)`
- `!!` alias for first-sheet references in formulas:
  - `=SUM(!!Amount)`

Current named-reference semantics:
- Same-sheet scalar refs like `=Price/Units` use the current row cells.
- Same-sheet aggregate refs like `=SUM(Price)` use prior data rows only, avoiding footer self-cycles.
- `[*]` forces the full data span: `=SUM(Price[*])`.

## Quick start

```bash
npm install
npm run build
node dist/cli.js render examples/basic.cel -o out.html
```

## Tests

```bash
npm test
npm run coverage
```

Current suite mix:
- Unit-focused tests for `utils`, parser edge behavior, evaluator mocked behavior, serializer behavior, and API/CLI contracts.
- Integration-style tests for parse/evaluate/render/serialize roundtrip behavior.

## Project layout

- `src/shared/`: shared types and utilities
- `src/parser/`: parsing pipeline
- `src/evaluator/`: formula translation + HyperFormula evaluation
- `src/renderer/`: HTML rendering
- `src/serializer/`: `.cel` serialization
- `src/cli/`: CLI entrypoint

## Current limitations

- Formula cell modifiers (e.g. `=A1+B1[bold]`) are not parsed yet.
- JSON sheets are parsed at sheet-finalization time (not true line-by-line streaming yet).
- Row-name dot references (e.g. `Sheet!row_name.Column`) are not translated yet.
