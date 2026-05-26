# Formula Support (Current State)

## What works now

- Formula cells detected when value starts with `=`.
- Evaluation uses HyperFormula when dependency available.
- A1 references pass through unchanged.
- Named column translation supported before engine eval:
  - `SUM(Name)`
  - `SUM(Name[n:m])`
  - `Name[n]`
  - `SUM(Sheet!Name)`
  - `SUM(Sheet!Name[n:m])`
  - `Sheet!Name[n]`
  - `SUM(!!Amount)` -> `SUM(<first-sheet>!Amount)`
- `!!` alias supported for first workbook sheet.
- Formula result display modifiers:
  - `SUM(Amount)[$][2d]`

## What does not work yet

- Row-name dot refs are not supported:
  - `Sheet!row_name.Column`
- Translation intentionally regex-based/narrow; complex token patterns can require explicit A1 refs.
- Direct file-style formula addressing is not supported.

## Translation model

- Formulas are preprocessed in `src/evaluator/formula.ts`.
- Unresolvable tokens are kept unchanged.
- Named refs with missing data rows emit warning diagnostics and remain unchanged.
- Formula parse errors from engine degrade to original formula text in output (`computed`).
- HyperFormula `COUNT` counts numbers. Use `COUNTA` for non-empty text or mixed-value counts.

## Suggested next steps

1. Add strict translation option for unresolved refs.
2. Expand tests for mixed expressions and nested formula patterns.
