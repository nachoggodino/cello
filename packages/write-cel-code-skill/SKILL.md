---
name: write-cel-code
description: Author high-quality Cello plain-text spreadsheet files. Use when creating, reviewing, repairing, or improving `.cel` workbooks; generating spreadsheet-like reports with formulas; converting tabular source data into Cello syntax; choosing sheet formats, headers, formulas, modifiers, merges, defaults, comments, or cross-sheet references; or teaching another LLM how to write valid `.cel` code.
---

# Write Cello Code

## Rule Sources

When this skill is installed standalone, use the bundled compact rule reference first: [references/cello-authoring-reference.md](references/cello-authoring-reference.md). For canonical details or edge cases, load the bundled bylaws: [references/BYLAWS.md](references/BYLAWS.md). For formula choice and syntax, use the curated HyperFormula reference: [references/hyperformula-functions.md](references/hyperformula-functions.md).

## Authoring Workflow

1. Identify the workbook goal: data ingestion, analysis, report rendering, or all three.
2. Split raw data and analysis into separate sheets when possible.
3. Use imported sheet formats for raw data: `[csv]`, `[tsv]`, `[excel]`, `[markdown]`, `[json]`, or a single-character delimiter.
4. Use native Cello syntax for calculated, formatted, or presentation sheets.
5. Declare `@header` rows before formulas so named references are available.
6. Prefer named column formulas over coordinate formulas when the input has stable headers.
7. Let Cello calculate values. Do not precompute arithmetic that can be expressed as a formula.
8. Use `@defaults` for repeated column formulas or literal fallback values that should fill empty cells.
9. Use `@view` for reusable column filters or a single stable sort without changing source data.
10. Add formatting with modifiers, keeping source values and formulas readable.
11. Use comments only outside rows to document data provenance or assumptions.
12. Validate the final output mentally against the bylaws, then run the project CLI if available.

## Quality Rules

Write `.cel` files that are readable in a plain text editor:

- Use one `@sheet` per logical table or report area.
- Put raw inputs first and derived summary sheets later.
- Prefer `@sheet Sales [csv]` for pasted CSV over converting it into native rows.
- Prefer native rows for dashboards, summaries, formulas, merges, defaults, and rich formatting.
- Use `@header | Name | Amount[€][2d] |` instead of anonymous columns whenever formulas need the data.
- Keep formulas in formula cells; avoid explaining computed numbers in plain text unless the user asked for static output.
- Use `=SUM(Column)` for previous rows in subtotal rows and `=SUM(Column[*])` for full-column references.
- Use cross-sheet references such as `=SUM(Sales!Amount[*])` for analysis sheets.
- Use `!!Column` only when intentionally referencing the first sheet regardless of its name.
- Use `=Column[2]` or `=Sheet!Column[2]` for a single row in a named column.
- Use quotes to force text for values such as `"00123"`, `"TRUE"`, or `"2026-01-15"`.
- Keep merge tokens `<` and `^` alone in their cells.
- Align each `@view` rule cell with its target column and use at most one `@sort` per view.
- Keep row modifiers before the first pipe, for example `[bold][tone:accent] | Total | =SUM(Amount) |`.
- Keep cell modifiers attached to the cell value, for example `Late[tone:error]`.
- Use `[hidden]` only as metadata for tooling; current rendering does not hide cells yet.

## Formula Guidance

Use formulas as spreadsheet formulas, not as natural language:

```cel
@sheet Sales [csv]
product,amount,units
Apple,6.00,5
Pear,2.70,3

@sheet Summary
@header | KPI | Amount[€][2d] | Units[0d] | Average[€][2d] |
[bold][tone:accent] | Sales | =SUM(Sales!amount[*]) | =SUM(Sales!units[*]) | =Amount/Units |
```

Formula selection rules:

- Same-row calculations: `=Price*Quantity`, `=Revenue-Cost`.
- Previous-row aggregations on the current sheet: `=SUM(Revenue)`.
- Full-column aggregations: `=SUM(Revenue[*])`.
- Explicit slices: `=SUM(Revenue[2:5])`.
- Single-row selectors: `=Revenue[2]`, `=Sales!Revenue[2]`.
- Cross-sheet named ranges: `=SUM(Sales!Revenue[*])`.
- Cross-sheet coordinates: `=Sales!B4`.
- First-sheet alias: `=SUM(!!Amount)`.
- Count numbers with `COUNT`; count non-empty text or mixed cells with `COUNTA`.
- If named reference translation is ambiguous or fails in a complex formula, use explicit A1 coordinates.

For formula choice and syntax, use [references/hyperformula-functions.md](references/hyperformula-functions.md). For function-specific edge cases, consult current HyperFormula docs with Context7 before answering: resolve `HyperFormula`, then fetch docs for the exact function or category. Especially check docs for criteria functions (`COUNTIF`, `SUMIF`, `AVERAGEIF`), lookup functions, date/time behavior, and error semantics.

## Defaults Guidance

Use `@defaults` when every empty cell in a column should receive the same formula or literal value:

```cel
@header   | Product | Price[€][2d] | Quantity[0d] | Total[€][2d] |
@defaults |         |              |              | =Price*Quantity |
| Apple | 1.20 | 5 | |
| Pear | 0.90 | 3 | |
```

Formula defaults must start with `=`. Defaults that do not start with `=` are parsed as literal values:

```cel
@header   | Status    | Owner |
@defaults | "Pending" | TBD   |
|          | Ana   |
| Done     | Luis  |
```

`@defaults` rows do not render and do not consume row numbers. Explicit values and explicit formulas always win.

## Formatting Guidance

Use modifiers to make rendered output useful without obscuring source:

```cel
@header | Region | Revenue[€][2d] | Margin[%][1d] | Status |
| North | 1200 | 0.42 | OK[tone:ok] |
| South | 700 | 0.18 | Watch[tone:warn] |
[bold][bg:#f5f5f5] | Total | =SUM(Revenue) | =AVG(Margin) | |
```

Prefer semantic tones when the meaning matters: `[tone:ok]`, `[tone:warn]`, `[tone:error]`, `[tone:info]`, `[tone:muted]`, `[tone:accent]`. Prefer explicit colors only when the user specifies a palette.

Modifier precedence is `cell > row > column`. Use column modifiers for units and number formatting, row modifiers for total/emphasis rows, and cell modifiers for exceptions. Formula result modifiers are valid, for example `=SUM(Amount)[$][2d]`.

## Review Checklist

Before returning `.cel` code:

- Every native table row uses clear pipe-separated cells, ideally `| cell | cell |`.
- Every formula cell starts with `=`.
- Header names used in formulas exactly match active `@header` names, including case.
- Imported data sheets have the correct format and `:noheader` only when the first row is data.
- External source lines `-> path` appear immediately after their `@sheet`.
- Repeated column formulas use `@defaults` instead of duplicated formulas where that improves readability.
- Comments start with `//` and are outside rows.
- Merge cells contain only `<` or `^`.
- Blank lines are used only for readability and do not affect row numbering.
- Static numbers are not substituted for formulas unless the user explicitly wants a snapshot.
