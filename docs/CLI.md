# CLI Reference

The package exposes a `cello` CLI binary from `dist/cli/cli.js`.

## Commands

- `cello parse <file.cel>`
  - Prints parsed AST as JSON.

- `cello --version`
  - Prints the package version.

- `cello evaluate <file.cel>`
  - Parses and evaluates formulas, prints resulting AST as JSON.

- `cello format <file.cel> [--check] [-o out.cel]`
  - Pretty-prints native Cello pipe tables with padded cells.
  - Rewrites the input file in place by default.
  - `-o` / `--out` writes formatted output to another path instead.
  - `--check` exits `0` when the file is already formatted and `1` when formatting would change it.

- `cello validate <file.cel>`
  - Parses and evaluates workbook diagnostics.
  - Prints `{ "valid": boolean, "diagnostics": [...] }` as JSON.
  - Exits `0` when there are no diagnostics, otherwise exits `1`.

- `cello render <file.cel> [-o out.html] [--no-eval] [--format document|fragment]`
  - Renders workbook to self-contained HTML.
  - `--format document` is the default full HTML document.
  - `--format fragment` emits an embeddable chunk without `html`, `head`, or `body` wrappers.
  - Use `--no-eval` to render formula text without evaluating formulas.
  - If `-o/--out` is provided, writes to file and prints `Wrote <absolute-path>`.
  - Otherwise prints HTML to stdout.

- `cello serialize <file.cel> [-o out.cel]`
  - Parses and serializes AST back to `.cel`.
  - If `-o/--out` is provided, writes to file and prints `Wrote <absolute-path>`.
  - Otherwise prints to stdout.

- `cello serve <file.cel> [--port 4321] [--host 127.0.0.1] [--open] [--no-eval]`
  - Serves a live HTML preview for a workbook.
  - Prints a local URL containing the served file name.
  - Auto-reloads the browser view when the source file changes.
  - Keeps the process warm so repeated renders reuse loaded dependencies.
  - Does not open a browser unless `--open` is provided.

- `cello help [command]`
  - Prints basic CLI help, or command-specific help for `parse`, `evaluate`, `format`, `validate`, `render`, `serialize`, or `serve`.

## Exit codes

- `0`: success
- `1`: invalid arguments, validation diagnostics, or runtime failure

## Build/run notes

- Build first: `npm run build`
- Direct run example: `node dist/cli/src/cli.js render docs/examples/basic.cel -o out.html`
