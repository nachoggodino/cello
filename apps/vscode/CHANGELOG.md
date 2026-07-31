# Changelog

## Unreleased

- Moved the extension source into `apps/vscode`.
- Updated the extension build to copy the reusable grammar and language configuration from `packages/language-support`.
- Added syntax coverage for Cello alias directives and layout modifiers.
- Joined the root npm workspace and shared lockfile, using the workspace Cello package
  during development.
- Updated the VS Code engine, packaging, build, test, coverage, and TypeScript toolchain
  and removed the stale isolated dependency tree.
- Added live warning/error diagnostics for open Cello documents.
- Added real extension-host coverage for activation, language registration, formatting,
  diagnostics, preview lifecycle, external refresh, and traversal/symlink denial.
- Added the complete GPL license and bundled-component notice to the verified VSIX.

## 0.0.1

- Initial Cello VS Code extension scaffold.
- Added `.cel` syntax highlighting and language configuration.
- Added live rendered preview commands backed by the published `@nachoggodino/cello` package.
- Added workspace-relative external source support for preview rendering.
