# cello

Plain-text spreadsheets with formulas. Cello gives you a readable `.cel` format, a TypeScript API, and a CLI that can parse, evaluate, validate, serialize, render, and serve workbooks as self-contained HTML.

It is useful when you want spreadsheet-like calculations in files that are easy to diff, review, generate, and keep in source control.

## Features

- Multi-sheet `.cel` workbooks.
- Native Cello rows plus CSV, TSV, semicolon, Markdown table, JSON, and external-source sheets.
- Formula evaluation through HyperFormula, including cross-sheet references and named columns.
- HTML rendering with tabs, merged cells, inline formatting, and cell/row/column modifiers.
- JSON AST output for tooling.
- Validation diagnostics that return proper process exit codes.
- Library API and `cello` CLI.

## Install

```bash
npm install cello
```

Requirements:

- Node.js 22 or newer.

For local development in this repository:

```bash
npm install
npm run build
npm test
```

## Quick Start

Create `sales.cel`:

```cel
@sheet Sales [csv]
product,price,quantity
Apple,1.2,5
Pear,0.9,3

@sheet KPI
-Metric-Value-
| Revenue | =Sales!B2*Sales!C2 + Sales!B3*Sales!C3 |
```

Render it:

```bash
cello render sales.cel -o sales.html
```

Or open a live preview:

```bash
cello serve sales.cel --open
```

Rendered preview:

| Metric | Value |
| --- | ---: |
| Revenue | 8.7 |

For a larger example with named references, slices, and cross-sheet formulas, see [examples/advanced_kpi.cel](examples/advanced_kpi.cel).

## CLI

```bash
cello help
cello --version
cello parse <file.cel>
cello evaluate <file.cel>
cello validate <file.cel>
cello render <file.cel> [-o out.html] [--no-eval]
cello serialize <file.cel> [-o out.cel]
cello serve <file.cel> [--port 4321] [--host 127.0.0.1] [--open] [--no-eval]
```

Exit codes:

- `0` means the command completed successfully.
- `1` means invalid arguments, validation diagnostics, or runtime failure.

Command details:

- `parse` prints the workbook AST as JSON.
- `evaluate` prints the AST with computed formula values.
- `validate` prints `{ "valid": boolean, "diagnostics": [...] }`; it exits `1` when diagnostics exist.
- `render` writes self-contained HTML with `-o/--out`, or prints HTML to stdout.
- `serialize` converts the parsed AST back to `.cel` text.
- `serve` starts a local live-preview server and only opens the browser when `--open` is provided.

## Library API

```ts
import { evaluate, parse, render, serialize, validate } from "cello";

const source = `
@sheet KPI
| Revenue | =1.2*5 + 0.9*3 |
`;

const ast = parse(source);
const evaluated = await evaluate(ast);
const result = await validate(source);
const html = await render(source);
const text = serialize(evaluated);

console.log(result.valid, html, text);
```

Primary exports:

- `parse(text, options?)`
- `evaluate(ast, options?)`
- `validate(text, options?)`
- `render(input, options?)`
- `serialize(ast)`

## Format Overview

Native Cello sheets use pipe-delimited rows:

```cel
@sheet Report

-Region-Revenue[€][2d]-Units[0d]-
| Madrid | 4280 | 15 |
| Barcelona | 2080 | 7 |
| Valencia | 760 | 2 |
| ## Total | =SUM(Revenue) | =SUM(Units) |
```

Rendered preview:

| Region | Revenue | Units |
| --- | ---: | ---: |
| Madrid | €4,280.00 | 15 |
| Barcelona | €2,080.00 | 7 |
| Valencia | €760.00 | 2 |
| Total | €7,120.00 | 24 |

Useful syntax:

- `@sheet Name [format]` starts a sheet.
- `-Column-Names-` declares named columns.
- `| cell | cell |` declares rows.
- `row_name | ... |` creates a non-rendered row reference name.
- `=A1+B1`, `=SUM(Revenue)`, and `=Sales!Amount` create formulas.
- `!!Amount` references a named column on the first sheet.
- `<` merges with the cell on the left; `^` merges with the cell above.
- `[€]`, `[2d]`, `[bold]`, `[bg:#fff9c4]`, and similar modifiers affect rendering.

The canonical syntax rules live in [BYLAWS.md](BYLAWS.md). The public specification lives in [docs/SPEC.md](docs/SPEC.md).

## Package Contents

The npm package publishes only the built library/CLI output and user-facing metadata:

- `dist/`
- `docs/`
- `examples/`
- `BYLAWS.md`
- `README.md`
- `CHANGELOG.md`
- `LICENSE`

## Development

```bash
npm run build
npm run typecheck
npm test
npm run coverage
```

Repository layout:

- `src/parser/` parses workbooks into ASTs.
- `src/evaluator/` computes formulas.
- `src/validator/` reports parse/evaluation diagnostics.
- `src/renderer/` creates self-contained HTML.
- `src/serializer/` converts ASTs back to `.cel`.
- `src/cli/` exposes the command-line interface.
- `tests/` covers unit, integration, and fixture behavior.

## Versioning

This project uses Semantic Versioning. See [CHANGELOG.md](CHANGELOG.md) for release history.

## License

MIT
