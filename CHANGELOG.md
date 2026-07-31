# Changelog

All notable changes to this project will be documented in this file.

This project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

- Added a source-authoritative editor session shared by React source, HTML preview, and
  visual views, with source-preserving commands, scoped Compact/Pretty formatting,
  independent mode histories, and revision-safe derived output.
- Removed the public core and editor whole-workbook serializers and the `cello serialize`
  command. Source changes now use `formatSource` or verified editor document commands.

## 0.2.0 - 2026-07-28

- Reorganized the repository into `packages/` and `apps/`, with published package entry points now built from `packages/core`, `packages/cli`, `packages/editor-core`, and `packages/editor-react`.
- Added `@nachoggodino/cello/editor-core` for source-preserving workbook models, editor commands, selectors, serialization helpers, and evaluation helpers.
- Added `@nachoggodino/cello/editor-react` and `@nachoggodino/cello/editor-react/styles.css` for the React visual editor package.
- Added the visual editor experience to the playground, including selection-aware editing, formatting controls, tone/layout controls, formula editing, clipboard support, and unit coverage.
- Added persisted layout syntax and rendering for sheet, row, and column sizing controls, including `columns:fit`, `rows:wrap`, width/height presets, and `@tone`, `@width`, and `@height` aliases.
- Expanded renderer presentation support with shared color, display, layout, and presentation helpers used by both the core renderer and editor packages.
- Moved reusable language-support assets to `packages/language-support` and updated the VS Code extension build to copy grammar/configuration files from that package.
- Moved examples to `docs/examples`, added a layout-controls example, and updated docs, tests, Docker, and Vercel configuration for the new project layout.
- Added package smoke coverage to verify the published editor entry points and stylesheet are included in the npm tarball.

## 0.1.1 - 2026-05-26

- Added literal column defaults in `@defaults` rows. Defaults that start with `=` are formulas; other defaults are parsed as literal values.
- Added formula result modifiers, so cells such as `=SUM(Amount)[$][2d]` render formatted computed values.
- Added single-row named column references such as `=Units[2]`, `=Orders!Units[2]`, and `=!!Units[2]`.
- Clarified HyperFormula `COUNT` vs `COUNTA` semantics and added parser, evaluator, renderer, serializer, and e2e coverage for the new formula/default behavior.
- Expanded `write-cel-code` skill references with literal defaults, formula result formatting, single-row named references, and a curated HyperFormula function guide.
- Included the bundled Cello authoring skill in the npm package contents so it can be updated from the published package.

## 0.1.0 - 2026-05-15

- Initial public package metadata for `@nachoggodino/cello` as a GPLv3 package.
- Added parser, HyperFormula-backed evaluator, validator, renderer, serializer, and live preview CLI commands.
- Added `.cel` examples and test coverage for API, CLI, parser, evaluator, renderer, serializer, and validator behavior.
