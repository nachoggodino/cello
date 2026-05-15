# Error Model

## Parse stage

- Non-row lines in native Cello sheets are skipped with `warning` diagnostics.
- Invalid JSON sheets degrade to a single text data row plus warning.
- Parser strict mode (`parse(..., { strict: true })`) throws only on parser `error` diagnostics (warnings do not throw).

## Evaluate stage

- If HyperFormula is missing, evaluation is skipped and a warning diagnostic is added.
- If HyperFormula throws on workbook evaluation, evaluator adds an `error` diagnostic.
- `evaluate(..., { strict: true })` rethrows evaluation errors.

## Render stage

- `render(text, { strict })` delegates to parser/evaluator strictness.
- `render(text, { evaluate: false })` skips evaluation and renders formula text.
- Non-strict render still returns HTML even when diagnostics exist.
- Strict render throws only when parse/evaluate throw; non-fatal diagnostics alone do not throw.

## Practical contract

- `diagnostics` are the canonical error/warning channel in non-strict mode.
- Strict mode is for CI/validation workflows where failure must be explicit.
