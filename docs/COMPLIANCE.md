# Compliance Matrix (BYLAWS as Source of Truth)

This document maps `BYLAWS.md` rules to the current `SPEC.md`, implementation status, and tests.

Status legend:
- `implemented`: behavior matches BYLAWS in code
- `partial`: some behavior exists, but not complete/robust
- `missing`: required behavior not implemented

## Matrix

1. Core file structure (`@sheet`, anonymous sheet fallback)
- BYLAWS: implemented
- SPEC: aligned
- Code: implemented in parser sheet detection and `ensureSheet`
- Tests: covered (`tests/parse.test.ts`)

2. Sheet declaration and format
- BYLAWS: implemented
- SPEC: aligned
- Code: implemented (`parseSheetFormat`, `@sheet Name [format]`)
- Tests: covered (`tests/parse.test.ts`)

3. Row behavior (data rows start with `|`, blank lines ignored)
- BYLAWS: implemented
- SPEC: aligned (patched)
- Code: implemented (blank lines ignored, no blank row nodes created)
- Tests: covered (`tests/parse.unit.test.ts`)

4. Column header rows (`-name-`)
- BYLAWS: implemented
- SPEC: aligned
- Code: implemented (`isHeaderRow`, `parseHeaderRow`)
- Tests: covered

5. Row names before first `|`
- BYLAWS: implemented
- SPEC: aligned
- Code: implemented (`splitNativeRow`)
- Tests: covered

6. Formulas start with `=`
- BYLAWS: implemented
- SPEC: partially aligned (claims exceed implementation in named refs)
- Code: partial (formula cells parsed and sent to HyperFormula)
- Tests: partial

7. Named column ranges (`SUM(Price)`, `SUM(Price[2:5])`)
- BYLAWS: required
- SPEC: documents as supported
- Code: missing translation layer to A1/ranges
- Tests: missing dedicated support tests

8. Merges (`<`, `^`, merge token must be standalone)
- BYLAWS: partial
- SPEC: mostly aligned
- Code: partial (`<` and `^` resolution exists, but orphan tokens degrade silently)
- Tests: covered for common cases

9. Inferred types
- BYLAWS: implemented
- SPEC: aligned
- Code: implemented in `inferType`
- Tests: partial

10. Modifiers scope and precedence (cell > row > column)
- BYLAWS: partial
- SPEC: documents full precedence
- Code: partial (parser stores row/column/cell modifiers, renderer mainly applies cell modifiers)
- Tests: partial

11. Inline formatting
- BYLAWS: implemented (core markers)
- SPEC: aligned
- Code: implemented in renderer (`*`, `_`, `~~`, headings)
- Tests: partial (render-focused)

12. Comments only outside rows
- BYLAWS: implemented
- SPEC: aligned
- Code: implemented for line-level comments
- Tests: covered

13. Reserved tokens
- BYLAWS: aligned as grammar guidance
- SPEC: aligned
- Code: partial enforcement (accepts unknown syntax with diagnostics)
- Tests: partial

14. Resilience rule (graceful degradation)
- BYLAWS: partial
- SPEC: aligned intent, overstates strict guarantees in places
- Code: partial (diagnostics + evaluate error handling)
- Tests: partial
