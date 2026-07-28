# Release Checklist

Cello uses Semantic Versioning for the npm package `@nachoggodino/cello`.

## Version Scope

- Patch: bug fixes and documentation-only updates that do not add public syntax, package exports, or CLI/API behavior.
- Minor: new public syntax, CLI/API options, package exports, editor packages, or rendering behavior that remains backward compatible.
- Major: incompatible syntax, CLI/API, package export, or rendering changes.

The VS Code extension in `apps/vscode` has its own version stream. Bump it only when publishing a new extension build. If the extension must consume a new unpublished npm package version, publish the npm package first, then update the extension dependency and lockfile.

## Files To Update

- `CHANGELOG.md`
- `package.json`
- `package-lock.json`
- `packages/core/src/version.ts`
- Any docs affected by syntax, CLI, API, package contents, or repository layout changes

For VS Code extension releases, also update:

- `apps/vscode/CHANGELOG.md`
- `apps/vscode/package.json`
- `apps/vscode/package-lock.json`

## Local Verification

Run these before merging a release branch:

```bash
npm run typecheck
npm test
npm run build
npm run lint
npm run coverage
npm run playground:build
npm --prefix apps/vscode run typecheck
npm --prefix apps/vscode run compile
env TMPDIR=/tmp npm --prefix apps/vscode test
env TMPDIR=/tmp npm_config_cache=/tmp/npm-cache-cello npm pack --dry-run
```

`TMPDIR=/tmp` avoids WSL sessions that point Node/Vitest at a missing Windows temp directory.

Check the `npm pack --dry-run` file list for:

- `dist/core/src/index.js`
- `dist/cli/src/cli.js`
- `dist/editor-core/src/index.js`
- `dist/editor-react/src/index.js`
- `dist/editor-react/src/styles.css`
- `docs/`
- `packages/language-support/`
- `packages/write-cel-code-skill/`

## Publish Order

1. Merge the release-ready branch.
2. Publish `@nachoggodino/cello`.
3. If needed, update `apps/vscode` to depend on the published package version.
4. Run the VS Code extension checks.
5. Package and publish the VS Code extension.
