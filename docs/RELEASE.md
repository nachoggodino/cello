# Release Checklist

Cello uses Semantic Versioning for the npm package `@nachoggodino/cello`. Run release checks from a clean checkout with the active Node LTS and npm. The repository is an npm workspace with one root `package-lock.json`; do not create workspace-local lockfiles.

## Version Scope

- Patch: bug fixes and documentation-only updates that do not add public syntax, package exports, or CLI/API behavior.
- Minor: new public syntax, CLI/API options, package exports, editor packages, or rendering behavior that remains backward compatible.
- Major: incompatible syntax, CLI/API, package export, or rendering changes.

The VS Code extension in `apps/vscode` has its own version stream. Bump it only when publishing a new extension build. During development it consumes the root workspace package; release artifact verification must confirm that the packaged extension contains the intended Cello version.

## Files To Update

- `CHANGELOG.md`
- `package.json`
- `package-lock.json`
- `packages/core/src/version.ts`
- Any docs affected by syntax, CLI, API, package contents, or repository layout changes

For VS Code extension releases, also update `apps/vscode/CHANGELOG.md` and `apps/vscode/package.json`.

## Local Verification

Run these stable root gates before merging a release branch:

```bash
npm ci
npm run format:check
npm run docs:check
npm run lint
npm run typecheck
npm test
npm run coverage
npm run build
npm run playground:build
npm run test:browser
npm run test:browser:release
npm run test:vscode
npm run test:vscode:host
npm run test:distribution
npm run smoke:package
npm run audit:prod
npm run perf:check
```

`build` compiles the publishable packages and already invokes `smoke:package`; the explicit smoke command remains independently runnable. `test:vscode` runs extension unit tests and compiles its production bundle from the root workspace.

`test:browser` is the required Chromium smoke suite. `test:browser:release` runs the same critical flows in Chromium, Firefox, and WebKit. `test:vscode:host` downloads the pinned VS Code test build and needs Linux GUI libraries plus `xvfb-run` in headless environments. `test:distribution` creates the real npm and VSIX artifacts, installs them into isolated consumers/profiles, and verifies package contents, declarations, source maps, CLI execution, browser bundling, and deployment headers.

`perf:check` rebuilds production surfaces and enforces the normalized runtime and
attributed size budgets documented in [PERFORMANCE.md](./PERFORMANCE.md).

If a WSL session points Node/Vitest or a downloaded Linux VS Code CLI at a Windows temporary directory, set `TMPDIR=/tmp` for the affected command.

Check the `npm pack --dry-run` file list for:

- `dist/core/src/index.js`
- `dist/cli/src/cli.js`
- `dist/editor-core/src/index.js`
- `dist/editor-react/src/index.js`
- `dist/editor-react/src/styles.css`
- `docs/examples/`
- `docs/ARCHITECTURE.md`
- `docs/CLI.md`
- `docs/COMPLIANCE.md`
- `docs/README.md`
- `docs/EDITOR_PACKAGES.md`
- `docs/ERROR_MODEL.md`
- `docs/SPEC.md`
- `docs/SYNTAX_HIGHLIGHTING.md`
- `packages/language-support/`
- `packages/write-cel-code-skill/`

- `LICENSE`
- `NOTICE`

The package version, `packages/core/src/version.ts`, root lockfile version, and the
VS Code extension's Cello development dependency must agree. The extension's own
version is independent and changes only when an extension build is published. Do
not turn an unreleased hardening branch into `1.0.0` merely to pass this checklist;
choose and record the release version when cutting the release candidate.

## TypeScript 7 Compatibility

The root toolchain intentionally installs two compiler packages during the TypeScript
7.0 transition:

- `@typescript/native` aliases TypeScript 7 and provides the `tsc` executable used by
  builds and typechecks.
- `typescript` aliases `@typescript/typescript6` and provides the TypeScript 6
  programmatic API currently required by `typescript-eslint`.

This is Microsoft's supported side-by-side configuration, not a version override.
TypeScript 7.0 does not expose the compiler API consumed by typed lint tooling.

Track upstream support in
[typescript-eslint#10940](https://github.com/typescript-eslint/typescript-eslint/issues/10940).

Revisit this arrangement when `typescript-eslint` supports TypeScript 7.1 or a later
stable API. At that point, remove the `@typescript/native` alias, restore `typescript`
as the current stable compiler, regenerate the lockfile, and require `tsc --version`,
`npm run typecheck`, `npm run lint`, and `npm ls` to pass without peer errors.

## CI Checks

- **Quality gates** runs uncached `npm ci`, documentation/license drift checks, formatting, zero-warning lint, all TypeScript projects, root/extension tests, package build, playground build, and extension compile on pull requests and `main`.
- **Performance and size budgets** gates normalized latency and attributed npm, browser, playground, renderer, and VSIX size regressions on `main`, schedules, and manual runs.
- **Coverage and production audit** enforces global and critical-module coverage floors and blocks high-severity production dependency advisories on `main`, schedules, and manual runs.
- **Chromium smoke** installs Chromium and runs the critical playground/editor flows on pull requests and `main`.
- **Cross-browser release matrix** runs Chromium, Firefox, and WebKit on `main`, schedules, and manual runs.
- **VS Code extension host** runs the real-host activation, formatting, diagnostics, preview, external-refresh, and path-denial smoke suite under Xvfb.
- **Distribution artifacts** verifies clean npm/browser/CLI consumers and package, deployment-header, VSIX-content, and isolated VSIX-install contracts outside pull requests.

No dependency cache is configured until uncached installation has proven stable. These job names are intended to be used directly for branch protection.

The complete development and production audits currently report no known
vulnerabilities. Any future finding is evaluated under the severity policy above.

## Publish Order

1. Merge the release-ready branch.
2. Publish `@nachoggodino/cello`.
3. Build and verify the VS Code extension against that release.
4. Package and publish the VS Code extension.

## Release Candidate Evidence

Before publishing, attach the CI run that proves all gates above and record the
candidate versions and commit SHA in the release notes. Also perform this short manual
smoke pass against the produced artifacts:

- Install the npm tarball in an empty Node project; parse, validate, render, and run the CLI help/error paths.
- Open the deployed playground on desktop and mobile; edit in source and visual modes, switch sheets, undo/redo, copy/paste, and confirm preview refresh.
- Install the VSIX into an empty VS Code profile; open a `.cel` file and confirm highlighting, formatting, diagnostics, preview refresh, and safe external-source failure.
- Inspect the npm tarball and VSIX lists for `LICENSE` and `NOTICE`, and for absence of plans, lockfiles, TypeScript sources, VSIX source maps, and development directories.
- Confirm the deployed playground serves the security headers in `vercel.json` and publishes no source maps.
