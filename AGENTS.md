# AGENTS

## Purpose
This repository implements `cello`, a TypeScript library and CLI for parsing, evaluating, rendering, and serializing a plain-text spreadsheet format (`.cel`).

## Quick orientation
- `packages/core/src/parser/` handles workbook/sheet/row/cell syntax.
- `packages/core/src/evaluator/` computes formula cells using `hyperformula`.
- `packages/core/src/renderer/` generates self-contained HTML output.
- `packages/core/src/serializer/` converts ASTs back to `.cel` text.
- `packages/cli/src/` exposes the CLI commands.
- `apps/playground/src/` contains the web playground and current visual editor.
- `apps/vscode/src/` contains the VS Code extension.

## Build & validation
Use the project scripts defined in `package.json`:
- `npm install`
- `npm run build`
- `npm run typecheck`
- `npm test`
- `npm run coverage`

## Development conventions
- Keep implementation changes in the relevant `packages/*/src` or `apps/*/src` boundary.
- Add tests in `tests/` alongside the relevant module.
- Prefer small, additive changes and preserve `BYLAWS.md` as the syntax source of truth.
- When behavior changes, update relevant docs in `docs/` and/or `SPEC.md`.

## Important repo docs
- `README.md` — overall project purpose and quickstart.
- `CONTRIBUTING.md` — repo workflow, test expectations, and change acceptance.
- `docs/ARCHITECTURE.md` — pipeline and module responsibilities.
- `BYLAWS.md` — canonical syntax/behavior rules.
- `docs/SPEC.md` — public specification alignment.

## What agents should avoid
- Do not edit generated artifacts in `dist/` directly.
- Do not add unrelated refactors in feature changes.
- Avoid changing CLI behavior without tests and docs updates.

## Notes for AI assistance
- Use the existing package/app module boundaries when adding features.
- Prefer linking to docs instead of repeating long rules.
- Check `CONTRIBUTING.md` before proposing workflow or test changes.
