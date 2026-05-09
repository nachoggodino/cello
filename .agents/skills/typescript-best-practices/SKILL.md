---
name: typescript-best-practices
description: Apply current TypeScript engineering best practices for repository standards, code reviews, and refactors. Use when defining or enforcing rules for typing strictness, testing strategy, code coverage, formatting, linting, function/class/file size, comments and documentation policy, and TypeScript-specific code smells.
---

# TypeScript Best Practices

## Workflow

1. Inspect repository config: `tsconfig*`, `eslint*`, formatter config, test runner config, coverage config, and CI checks.
2. Compare current setup against the baseline in [references/baseline.md](references/baseline.md).
3. Propose only high-impact changes first: strict typing gaps, unsafe `any` usage, flaky/missing tests, and missing coverage gates.
4. Apply code-level fixes with minimal churn and add tests for behavior changes.
5. Report outcomes with:
- Concrete config diffs.
- Quality gates added or tightened.
- Residual risks and deferred items.

## Baseline Standards To Enforce

Use [references/baseline.md](references/baseline.md) as the source of truth. Enforce these defaults unless project constraints require exceptions:

- Enable TypeScript strictness and safety flags (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`).
- Use typed linting with `typescript-eslint` recommended/strict type-checked presets.
- Keep formatter and linter responsibilities separate (formatter for whitespace/trivia; linter for correctness/safety).
- Require tests for behavior, not implementation details.
- Enforce coverage thresholds in CI, with branch coverage included.
- Control complexity and size via lint rules and refactoring triggers.
- Document public APIs and non-obvious invariants; avoid comment noise.

## Testing And Coverage Policy

Apply this minimum bar unless the repository already has stricter standards:

- Cover critical control flow with unit tests and add integration tests where module boundaries meet.
- Keep test names behavior-focused (`returns X when Y`) and deterministic (no time/network randomness without control).
- Set global coverage thresholds at or above `80%` for lines/functions/statements and `70%` for branches.
- Prefer per-file thresholds for critical directories.
- Fail CI on threshold regressions.

If the repo has legacy gaps, use ratcheting:
- Do not lower existing thresholds.
- Raise thresholds incrementally per touched module.

## Function, Class, And File Size Heuristics

Use these as refactoring triggers, not absolute dogma:

- Function length: target <= 40 lines (`max-lines-per-function` with comment/blank-line skips as needed).
- Cyclomatic complexity: target <= 10 (`complexity` rule).
- Classes per file: default 1 (`max-classes-per-file`).
- File length: usually keep under 300-400 lines (`max-lines`); split when cohesion drops.

## Comments And Documentation

Apply these rules:
- Write comments to explain intent, invariants, and tradeoffs; do not narrate obvious code.
- Use TSDoc/JSDoc for exported/public APIs (`@param`, `@returns`, `@deprecated`, links).
- Require justification comments for `@ts-expect-error`/`@ts-ignore` and track cleanup.
- Remove stale comments in the same change that updates behavior.

## TypeScript Smells To Eliminate First

- `any` without boundary justification.
- Non-null assertions (`!`) used as routine control flow.
- Promise-returning calls not awaited/handled.
- Broad type assertions (`as unknown as X`) hiding design issues.
- Growing union types without discriminants.
- Utility modules accumulating unrelated responsibilities.

## Output Contract

When applying this skill, return:
- A short gap analysis against baseline.
- Proposed rule/config changes with rationale.
- Code smell fixes performed (or queued) and test impact.
- Coverage impact and whether CI gates are now enforceable.
