# Cello

Plain-text spreadsheets with formulas. Cello gives you a readable `.cel` format, a TypeScript API, and a CLI that can parse, evaluate, validate, format, render, and serve workbooks as self-contained HTML.

It is useful when you want spreadsheet-like calculations in files that are easy to diff, review, generate, and keep in source control.

The npm package is `@nachoggodino/cello`. It is licensed as GPLv3 because formula evaluation uses HyperFormula under its GPLv3 option.

## Features

- Multi-sheet `.cel` workbooks.
- Native Cello rows plus CSV, TSV, semicolon, Markdown table, JSON, and external-source sheets.
- Formula evaluation through HyperFormula, including cross-sheet references and named columns.
- HTML rendering with tabs, merged cells, inline formatting, and cell/row/column modifiers.
- Transient and named column filters plus stable sorting in the visual editor and interactive HTML.
- JSON AST output for tooling.
- Validation diagnostics that return proper process exit codes.
- Library API and `cello` CLI.
- Optional editor packages for source-preserving editor integrations and a React visual editor.

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
- `serve` starts a local live-preview server and only opens the browser when `--open` is provided.

## Library API

```ts
import { evaluate, format, formatSource, parse, render, validate } from "@nachoggodino/cello";

const source = `
@sheet KPI
| Revenue | =1.2*5 + 0.9*3 |
`;

const ast = parse(source);
const evaluated = await evaluate(ast);
const pretty = format(source);
const compact = formatSource(source, { layout: "compact" });
const result = await validate(source);
const html = await render(source);
const fragment = await render(source, { format: "fragment" });

console.log(result.valid, compact, pretty, evaluated, html, fragment);
```

Primary exports:

- `parse(text, options?)`
- `evaluate(ast, options?)`
- `format(text)`
- `formatSource(text, { layout: "compact" | "pretty", range? })`
- `validate(text, options?)`
- `render(input, options?)`

There is intentionally no AST-to-source serializer. Parsing is a semantic projection
and cannot retain every comment, malformed fragment, spacing choice, or provenance
detail. Use `formatSource` for source layout changes and editor document commands for
source-preserving semantic edits.

Editor package exports:

- `@nachoggodino/cello/editor-core` provides source-preserving document models, the
  serializable `EditorDocumentCommand` API, and `createEditorSession` for revisioned
  synchronization and independent source/visual histories.
- `@nachoggodino/cello/editor-react` exports session-backed `CelloSourceEditor`,
  `CelloHtmlPreview`, and `CelloVisualEditor` views plus an optional tabbed
  `CelloWorkbench` for React hosts.
  The source editor includes syntax highlighting, line numbers, search, bracket support,
  and session-owned undo/redo.
  Its optional `sourceLayout` prop applies Compact or Pretty layout to the contiguous table block affected by a visual command.
- `@nachoggodino/cello/editor-react/styles.css` provides the visual editor stylesheet.

For editor package usage, see [docs/EDITOR_PACKAGES.md](docs/EDITOR_PACKAGES.md).

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
- `@sheet Name [columns:fit][rows:wrap]` persists sheet-level layout defaults.
- `@header | Column | Names |` declares named columns.
- `@header | Column[width:large] |` persists column width; `[fit]` sizes a column from visible content.
- `@defaults | | | =Formula |` declares non-rendered column default formulas.
- `@view Madrid sales | @where *mad* | @sort desc |` declares a selectable, column-aligned table view.
- `| cell | cell |` declares rows.
- `[bold] | ... |`, `[wrap] | ... |`, and `[height:3] | ... |` apply row-level modifiers.
- `@tone`, `@width`, and `@height` declare namespaced aliases for reusable tone, width, and height modifiers.
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
npm run playground:build
```

Repository layout:

- `packages/core/src/parser/` parses workbooks into ASTs.
- `packages/core/src/evaluator/` computes formulas.
- `packages/core/src/formatter/` pretty-prints native Cello pipe tables.
- `packages/core/src/validator/` reports parse/evaluation diagnostics.
- `packages/core/src/renderer/` creates self-contained HTML.
- `packages/cli/src/` exposes the command-line interface.
- `packages/editor-core/src/` exposes source-preserving editor commands, sessions, and selectors.
- `packages/editor-react/src/` exposes React source, preview, and visual editor components, an optional workbench, and their stylesheet.
- `packages/language-support/` contains reusable TextMate grammar and language configuration assets.
- `packages/write-cel-code-skill/` contains the packaged Cello authoring skill.
- `apps/playground/` contains the web playground and current visual editor.
- `apps/vscode/` contains the VS Code extension.
- `tests/` covers unit, integration, and fixture behavior.

## Versioning

This project uses Semantic Versioning. See [CHANGELOG.md](CHANGELOG.md) for release history.

Release preparation notes live in [docs/RELEASE.md](docs/RELEASE.md).

## License

GPL-3.0-only.

Cello uses HyperFormula for formula evaluation and configures it with `licenseKey: "gpl-v3"`. HyperFormula is available under GPLv3 or a commercial license from Handsontable; this package uses the GPLv3 option.
