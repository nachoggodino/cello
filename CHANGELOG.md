# Changelog

All notable changes to this project will be documented in this file.

This project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 0.1.1 - 2026-05-26

- Added literal column defaults in `@defaults` rows. Defaults that start with `=` are formulas; other defaults are parsed as literal values.
- Added formula result modifiers, so cells such as `=SUM(Amount)[$][2d]` render formatted computed values.
- Added single-row named column references such as `=Units[2]`, `=Orders!Units[2]`, and `=!!Units[2]`.
- Clarified HyperFormula `COUNT` vs `COUNTA` semantics and added parser, evaluator, renderer, serializer, and e2e coverage for the new formula/default behavior.
- Expanded `write-cel-code` skill references with literal defaults, formula result formatting, single-row named references, and a curated HyperFormula function guide.
- Included `skills/` in the npm package contents so the bundled Cello authoring skill can be updated from the published package.

## 0.1.0 - 2026-05-15

- Initial public package metadata for `@nachoggodino/cello` as a GPLv3 package.
- Added parser, HyperFormula-backed evaluator, validator, renderer, serializer, and live preview CLI commands.
- Added `.cel` examples and test coverage for API, CLI, parser, evaluator, renderer, serializer, and validator behavior.
