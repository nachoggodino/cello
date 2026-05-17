# Compliance Matrix (BYLAWS vs Current Code)

This file maps `BYLAWS.md` expectations to current implementation in `src/` and tests in `tests/`.

Status legend:
- `implemented`: behavior present and tested
- `partial`: behavior exists but scope/guarantees limited
- `missing`: documented behavior not in code yet

## Matrix

1. Core file structure (`@sheet`, anonymous fallback)
- Status: `implemented`
- Code: `src/parser/parse.ts` (`ensureSheet`, sheet declaration parsing)
- Tests: `tests/unit/parser/parse.unit.test.ts`, `tests/e2e/fixtures/anonymous-sheet.*`

2. Sheet formats (`csv/tsv/excel`, custom delimiter, markdown, json)
- Status: `implemented`
- Code: `src/shared/utils.ts` (`parseSheetFormat`), `src/parser/parse.ts` format handlers
- Tests: `tests/unit/parser/parse.unit.test.ts`, `tests/e2e/fixtures/format-matrix.*`

3. External sheet source (`-> path`)
- Status: `implemented`
- Code: `src/parser/parse.ts` (`tryHandleExternalSource`)
- Tests: `tests/unit/parser/parse.unit.test.ts`, `tests/e2e/fixtures/external-source.*`

4. Rows, blank-line handling, row-level modifiers
- Status: `implemented`
- Code: `src/parser/parse.ts` (`splitNativeRow`, blank line handling)
- Tests: `tests/unit/parser/parse.unit.test.ts`, `tests/e2e/fixtures/comments-blanklines.*`

5. Header rows and column metadata/modifiers
- Status: `implemented`
- Code: `src/parser/parse.ts` (`parseHeadersFromLine`, `applyHeadersToColumns`)
- Tests: `tests/unit/parser/parse.unit.test.ts`, `tests/e2e/fixtures/header-rebinding.*`

5a. Column default formulas (`@defaults | ... |`)
- Status: `implemented`
- Code: `src/parser/parse.ts` (`tryHandleDefaultsDirective`, `getColumnDefaultFormula`)
- Tests: `tests/unit/parser/parse.unit.test.ts`, `tests/it/evaluator/evaluate.test.ts`, `tests/it/renderer/render.test.ts`

6. Formula parsing + evaluation engine integration
- Status: `implemented`
- Code: `src/evaluator/evaluate.ts`
- Tests: `tests/unit/evaluator/evaluate.unit.test.ts`, `tests/it/evaluator/evaluate.test.ts`

7. Named column refs (`SUM(Price)`, `SUM(Sheet!Price)`, slices, `!!`)
- Status: `implemented`
- Code: `src/evaluator/formula.ts`
- Tests: `tests/unit/evaluator/formula.unit.test.ts`

8. Row-name dot refs (`Sheet!row_name.Column`)
- Status: `out of scope`
- Code: row-name prefixes are not part of the AST or formula translation layer
- Tests: parser regression covers unsupported row prefixes

9. Merges (`<`, `^`)
- Status: `partial`
- Code: `src/parser/parse.ts` merge token handling
- Tests: `tests/unit/parser/parse.unit.test.ts`, `tests/it/renderer/render.test.ts`
- Note: orphan merge tokens degrade silently (no diagnostic)

10. Modifiers precedence (column + row + cell)
- Status: `implemented`
- Code: `src/renderer/render.ts` (`collectModifiers` order: column -> row -> cell)
- Tests: `tests/e2e/fixtures/types-precedence.*`, `tests/e2e/fixtures/row-name-modifiers.*`

11. Modifier coverage in renderer
- Status: `partial`
- Code: `src/renderer/render.ts` (`bold`, `italic`, `bg`, color, tone presets, numeric display)
- Missing: `[hidden]` rendering behavior

12. Inline formatting (`*`, `_`, `~~`, `#`, `##`)
- Status: `implemented`
- Code: `src/renderer/render.ts` (`formatInline`)
- Tests: `tests/it/renderer/render.test.ts`, `tests/e2e/fixtures/native-bylaws.*`

13. Diagnostics and strict mode
- Status: `implemented`
- Code: `src/parser/parse.ts`, `src/evaluator/evaluate.ts`, `src/renderer/render.ts`
- Tests: parser/evaluator unit + integration tests
- Note: parser strict mode throws on `error` diagnostics only; warnings do not throw
