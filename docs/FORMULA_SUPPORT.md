# Formula Support (Current State)

## What works now

- Formula cells are recognized when a cell starts with `=`.
- Formulas are evaluated via HyperFormula when dependency is available.
- A1-style references and regular HyperFormula-compatible formulas can work when they do not require Cello-specific name translation.
- Cross-sheet A1 references can work when syntax is HyperFormula-compatible.
- Named range translation is implemented for:
  - `SUM(Name)` style named column references on current sheet
  - `SUM(Name[n:m])` slices on current sheet
  - `SUM(Sheet!Name)` and `SUM(Sheet!Name[n:m])` across sheets
- `!!` alias is supported as "first sheet" prefix:
  - `SUM(!!Amount)` -> `SUM(<firstSheet>!Amount)`

## What does not work yet

- Row-name dot references (for example `Sheet!row_name.Column`) are not translated.
- Formula grammar translation is intentionally narrow; very complex nested token patterns may still require A1 references.
- External sheet-file addressing is not available.

## Why

Current evaluator builds a raw matrix from parsed cells and sends formula strings directly to HyperFormula, without a pre-processing translation pass.

## Remaining implementation to complete named refs

1. Extend index for row-level named references
- Add row name -> row index mapping and validate duplicates.

2. Support row-name reference syntax
- Translate patterns like `Sheet!row_name.Column` to concrete A1 references.

3. Keep original formulas and optionally store translated formulas separately
- Preserve author intent for serialization/debugging.
- Evaluate translated formula in HyperFormula.

4. Add strict validation mode for untranslatable references
- Non-strict: diagnostic + keep raw/degraded behavior
- Strict: throw error

## Suggested phased rollout

1. v1 complete (already): current-sheet and cross-sheet named column ranges + `!!`.
2. v2: row-name dot syntax and better duplicate-name diagnostics.
3. v3: broader grammar-aware translator for advanced expressions.
