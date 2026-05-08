# cello (scaffold)

TypeScript scaffold for the Cello reference library.

## Implemented now

- `parse(text)` -> AST
- `evaluate(ast)` -> AST with formula values (via HyperFormula when available)
- `render(input)` -> self-contained HTML with sheet tabs
- `serialize(ast)` -> `.cel` text
- `cello` CLI (`parse`, `evaluate`, `render`, `serialize`)

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

- `src/types.ts`: AST + public types
- `src/parse.ts`: single-pass parser baseline
- `src/evaluate.ts`: HyperFormula adapter
- `src/render.ts`: HTML renderer
- `src/serialize.ts`: AST serializer
- `src/cli.ts`: CLI entrypoint

## Current limitations

- Named-reference to A1 translation is not implemented yet (`=SUM(Total)` may not resolve in HyperFormula).
- Formula cell modifiers (e.g. `=A1+B1[bold]`) are not parsed yet.
- JSON sheets are parsed at sheet-finalization time (not true line-by-line streaming yet).
