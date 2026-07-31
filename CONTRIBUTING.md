# Contributing

## Ground rules

- `BYLAWS.md` is the source of truth for syntax/behavior.
- `docs/SPEC.md` must stay aligned with BYLAWS and implementation status.
- Prefer additive, test-backed changes.

## Setup

1. `npm install`
2. `npm run typecheck`
3. `npm test`

## Change workflow

1. Implement the change in the relevant package or app:
   - Core library behavior: `packages/core/src/`
   - CLI behavior: `packages/cli/src/`
   - Playground/editor UI: `apps/playground/src/`
   - VS Code extension: `apps/vscode/src/`
2. Add or update tests in `tests/`:
   - Unit tests for edge/isolated behavior.
   - Integration tests for parse/evaluate/render and editor-command flows.
3. Update docs when behavior changes:
   - `docs/SPEC.md` (if public behavior changes)
   - `docs/COMPLIANCE.md`
   - Any relevant `docs/*.md`
4. Update release metadata when published behavior changes:
   - `CHANGELOG.md`
   - `package.json`
   - `package-lock.json`
   - `packages/core/src/version.ts`

## Acceptance checklist

- Tests pass locally.
- New behavior is covered by tests.
- BYLAWS compliance checked for affected rules.
- Changelog and package version are updated when release-facing behavior changes.
- No unrelated refactors mixed in.
