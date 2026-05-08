# CLI Reference

The package exposes a `cello` CLI binary from `dist/cli.js`.

## Commands

- `cello parse <file.cel>`
  - Prints parsed AST as JSON.

- `cello evaluate <file.cel>`
  - Parses and evaluates formulas, prints resulting AST as JSON.

- `cello render <file.cel> [-o out.html]`
  - Renders workbook to self-contained HTML.
  - If `-o/--out` is provided, writes to file; otherwise prints to stdout.

- `cello serialize <file.cel> [-o out.cel]`
  - Parses and serializes AST back to `.cel`.
  - If `-o/--out` is provided, writes to file; otherwise prints to stdout.

## Exit codes

- `0`: success
- `1`: usage error or runtime failure

## Build/run notes

- Build first: `npm run build`
- Direct run example: `node dist/cli.js render examples/basic.cel -o out.html`
