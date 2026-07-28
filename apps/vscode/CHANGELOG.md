# Changelog

## Unreleased

- Moved the extension source into `apps/vscode`.
- Updated the extension build to copy the reusable grammar and language configuration from `packages/language-support`.
- Added syntax coverage for Cello alias directives and layout modifiers.

## 0.0.1

- Initial Cello VS Code extension scaffold.
- Added `.cel` syntax highlighting and language configuration.
- Added live rendered preview commands backed by the published `@nachoggodino/cello` package.
- Added workspace-relative external source support for preview rendering.
