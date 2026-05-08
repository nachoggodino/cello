# Formula Support (Current State)

## What works now

- Formula cells are recognized when a cell starts with `=`.
- Formulas are evaluated via HyperFormula when dependency is available.
- A1-style references and regular HyperFormula-compatible formulas can work when they do not require Cello-specific name translation.
- Cross-sheet A1 references can work when syntax is HyperFormula-compatible.

## What does not work yet

- Named column references like `=SUM(Total)` are not translated to coordinate ranges.
- Named row/column references such as `Ventas!Total` are not translated.
- Sliced named ranges like `Amount[2:10]` are not translated.
- Mixed Cello-specific references are passed through raw, so HyperFormula may reject them.

## Why

Current evaluator builds a raw matrix from parsed cells and sends formula strings directly to HyperFormula, without a pre-processing translation pass.

## Required implementation to support named refs

1. Build a reference index from AST
- Per sheet, collect:
  - header name -> column index
  - row index mapping
  - optional row name -> row index

2. Add a formula translation pass before evaluation
- Convert named column refs:
  - `SUM(Total)` -> `SUM(B2:B10)` (example)
- Convert named slices:
  - `SUM(Amount[2:5])` -> `SUM(C2:C5)`
- Convert cross-sheet named refs:
  - `SUM(Sales!Total)` -> `SUM(Sales!B2:B10)` (quoted sheet name if needed)

3. Keep original formulas and store translated formulas separately
- Preserve author intent for serialization/debugging.
- Evaluate translated formula in HyperFormula.

4. Add strict validation mode for untranslatable references
- Non-strict: diagnostic + keep raw/degraded behavior
- Strict: throw error

## Suggested phased rollout

1. v1: support `SUM(Name)` and `SUM(Name[n:m])` on current sheet.
2. v2: support `Sheet!Name` and `SUM(Sheet!Name)`.
3. v3: support row-name dot syntax if retained in final grammar.
