# Cello

Plain-text spreadsheets with formulas. Cello gives you a readable `.cel` format, a TypeScript API, and a CLI that can parse, evaluate, validate, format, serialize, render, and serve workbooks as self-contained HTML.

It is useful when you want spreadsheet-like calculations in files that are easy to diff, review, generate, and keep in source control.

The npm package is `@nachoggodino/cello`. It is licensed as GPLv3 because formula evaluation uses HyperFormula under its GPLv3 option.

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
npm install @nachoggodino/cello
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
@header | Metric | Value |
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

For a larger example with named references, slices, and cross-sheet formulas, see [docs/examples/advanced_kpi.cel](docs/examples/advanced_kpi.cel).

## CLI

```bash
cello help
cello --version
cello parse <file.cel>
cello evaluate <file.cel>
cello format <file.cel> [--check] [-o out.cel]
cello validate <file.cel>
cello render <file.cel> [-o out.html] [--no-eval] [--format document|fragment]
cello serialize <file.cel> [-o out.cel]
cello serve <file.cel> [--port 4321] [--host 127.0.0.1] [--open] [--no-eval]
```

Exit codes:

- `0` means the command completed successfully.
- `1` means invalid arguments, validation diagnostics, or runtime failure.

Command details:

- `parse` prints the workbook AST as JSON.
- `evaluate` prints the AST with computed formula values.
- `format` pretty-prints native Cello pipe tables, writes in place by default, supports `-o/--out`, and uses `--check` to report formatting drift with exit code `1`.
- `validate` prints `{ "valid": boolean, "diagnostics": [...] }`; it exits `1` when diagnostics exist.
- `render` writes self-contained HTML with `-o/--out`, or prints HTML to stdout. `--format document` is the default full HTML document; `--format fragment` emits an embeddable chunk without `html`/`head`/`body` wrappers.
- `serialize` converts the parsed AST back to `.cel` text.
- `serve` starts a local live-preview server and only opens the browser when `--open` is provided.

## Library API

```ts
import { evaluate, format, parse, render, serialize, validate } from "@nachoggodino/cello";

const source = `
@sheet KPI
| Revenue | =1.2*5 + 0.9*3 |
`;

const ast = parse(source);
const evaluated = await evaluate(ast);
const pretty = format(source);
const result = await validate(source);
const html = await render(source);
const fragment = await render(source, { format: "fragment" });
const text = serialize(evaluated);

console.log(result.valid, pretty, html, text);
```

Primary exports:

- `parse(text, options?)`
- `evaluate(ast, options?)`
- `format(text)`
- `validate(text, options?)`
- `render(input, options?)`
- `serialize(ast)`

## Format Overview

Native Cello sheets use pipe-delimited rows:

```cel
@sheet Report

@header | Region | Revenue[€][2d] | Units[0d] |
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
- `@header | Column | Names |` declares named columns.
- `@defaults | | | =Formula |` declares non-rendered column default formulas.
- `| cell | cell |` declares rows.
- `[bold] | ... |` applies row-level modifiers.
- `=A1+B1`, `=SUM(Revenue)`, and `=Sales!Amount` create formulas.
- `!!Amount` references a named column on the first sheet.
- `<` merges with the cell on the left; `^` merges with the cell above.
- `[€]`, `[2d]`, `[bold]`, `[bg:#fff9c4]`, and similar modifiers affect rendering.

The canonical syntax rules live in [BYLAWS.md](BYLAWS.md). The public specification lives in [docs/SPEC.md](docs/SPEC.md).

Editor integrations can reuse the TextMate grammar and VS Code language configuration documented in [docs/SYNTAX_HIGHLIGHTING.md](docs/SYNTAX_HIGHLIGHTING.md).

## Package Contents

The npm package publishes only the built library/CLI output and user-facing metadata:

- `dist/`
- `docs/`
- `packages/language-support/`
- `packages/write-cel-code-skill/`
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

- `packages/core/src/parser/` parses workbooks into ASTs.
- `packages/core/src/evaluator/` computes formulas.
- `packages/core/src/formatter/` pretty-prints native Cello pipe tables.
- `packages/core/src/validator/` reports parse/evaluation diagnostics.
- `packages/core/src/renderer/` creates self-contained HTML.
- `packages/core/src/serializer/` converts ASTs back to `.cel`.
- `packages/cli/src/` exposes the command-line interface.
- `apps/playground/` contains the web playground and current visual editor.
- `apps/vscode/` contains the VS Code extension.
- `tests/` covers unit, integration, and fixture behavior.

## Versioning

This project uses Semantic Versioning. See [CHANGELOG.md](CHANGELOG.md) for release history.

## License

GPL-3.0-only.

Cello uses HyperFormula for formula evaluation and configures it with `licenseKey: "gpl-v3"`. HyperFormula is available under GPLv3 or a commercial license from Handsontable; this package uses the GPLv3 option.
