# CLI Reference

The package exposes a `cello` CLI binary from `dist/cli/cli.js`.

## Commands

- `cello parse <file.cel>`
  - Prints parsed AST as JSON.

- `cello evaluate <file.cel>`
  - Parses and evaluates formulas, prints resulting AST as JSON.

- `cello validate <file.cel>`
  - Parses and evaluates workbook diagnostics.
  - Prints `{ "valid": boolean, "diagnostics": [...] }` as JSON.
  - Exits `0` when there are no diagnostics, otherwise exits `1`.

- `cello render <file.cel> [-o out.html] [--no-eval]`
  - Renders workbook to self-contained HTML.
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
  - Prints basic CLI help, or command-specific help for `parse`, `evaluate`, `validate`, `render`, `serialize`, or `serve`.

## Exit codes

- `0`: success
- `1`: usage error or runtime failure

## Build/run notes

- Build first: `npm run build`
- Direct run example: `node dist/cli/cli.js render examples/basic.cel -o out.html`
