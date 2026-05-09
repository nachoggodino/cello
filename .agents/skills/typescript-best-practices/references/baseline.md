# TypeScript Baseline (2026)

## 1) Type-System Strictness

- Enable `strict: true` (TypeScript strict-mode family).
- Add:
- `noUncheckedIndexedAccess: true`
- `exactOptionalPropertyTypes: true`
- `noImplicitOverride: true`

Rationale: tighten null/undefined behavior, indexed access safety, and inheritance correctness.

## 2) Linting Strategy (Type-Aware)

- Use `typescript-eslint` typed presets:
- `recommendedTypeChecked` as minimum
- `strictTypeChecked` for stronger guarantees where feasible
- Favor high-signal safety rules:
- `@typescript-eslint/no-explicit-any`
- `@typescript-eslint/no-floating-promises`
- `@typescript-eslint/no-misused-promises`
- `@typescript-eslint/no-unsafe-assignment`
- `@typescript-eslint/no-unsafe-call`
- `@typescript-eslint/no-unsafe-member-access`
- `@typescript-eslint/no-unsafe-return`
- `@typescript-eslint/require-await`

## 3) Formatting

- Do not use ESLint as the primary formatter.
- Use Prettier (or equivalent) for whitespace/trivia.
- Keep lint focused on correctness, safety, and maintainability.

## 4) Function/Class/File Boundaries

Suggested lint guardrails:
- `max-lines-per-function`: 40 (skip blank lines/comments optional by team preference)
- `complexity`: 10
- `max-classes-per-file`: 1
- `max-lines`: 350 (or 400 for legacy modules while refactoring)

These are maintainability triggers, not absolute architectural laws.

## 5) Testing Practices

- Prioritize behavior-focused tests over implementation-detail tests.
- Keep tests deterministic (control timers, randomness, and network effects).
- Prefer integration tests for module boundaries and critical workflows.
- Use table-driven tests for edge-case-heavy pure functions.

## 6) Coverage Expectations

Use CI-enforced coverage thresholds.
Recommended starting baseline:
- lines: 80
- statements: 80
- functions: 80
- branches: 70

Ratcheting policy:
- Never lower thresholds.
- Raise thresholds on touched areas.
- Add per-file thresholds for critical packages/modules.

## 7) Comments and Documentation

- Document public/external APIs with TSDoc/JSDoc tags (`@param`, `@returns`, `@deprecated`, `@see`, `@link`).
- Use comments for intent, invariants, and tradeoffs; avoid obvious restatement.
- Require reasons for `@ts-expect-error` and remove once no longer needed.

## 8) Priority Smell List

Address in this order:
1. Runtime-risk type escapes (`any`, unsafe assertions, non-null assertion misuse)
2. Async correctness gaps (floating promises, swallowed rejections)
3. Overgrown files/functions with mixed responsibilities
4. Weak or missing tests around critical paths
5. Stale comments/docs contradicting behavior

## Sources

- TypeScript `strict`: https://www.typescriptlang.org/tsconfig/strict.html
- TypeScript `noUncheckedIndexedAccess`: https://www.typescriptlang.org/tsconfig/noUncheckedIndexedAccess.html
- TypeScript `exactOptionalPropertyTypes`: https://www.typescriptlang.org/tsconfig/exactOptionalPropertyTypes.html
- typescript-eslint shared configs: https://typescript-eslint.io/users/configs
- typescript-eslint formatting guidance: https://typescript-eslint.io/users/what-about-formatting/
- typescript-eslint rules overview: https://typescript-eslint.io/rules/
- ESLint `max-lines-per-function`: https://eslint.org/docs/latest/rules/max-lines-per-function
- ESLint `complexity`: https://eslint.org/docs/latest/rules/complexity
- ESLint `max-classes-per-file`: https://eslint.org/docs/latest/rules/max-classes-per-file
- ESLint `max-lines`: https://eslint.org/docs/latest/rules/max-lines
- Vitest coverage config: https://vitest.dev/config/coverage
- TSDoc overview: https://tsdoc.org/
