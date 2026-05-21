<div align="center">
  <img src="playground/public/cello-logo-simple.svg" alt="cello" width="180" />
  <h1>Cello Bylaws v1.0</h1>
  <p><strong>Plain-text spreadsheets for humans, agents, diffs, and HTML previews.</strong></p>
  <p>
    <img alt="Format: .cel" src="https://img.shields.io/badge/format-.cel-e7662f?style=flat-square" />
    <img alt="Syntax: BYLAWS first" src="https://img.shields.io/badge/syntax-BYLAWS--first-496f91?style=flat-square" />
    <img alt="Renderer: HTML" src="https://img.shields.io/badge/render-HTML-5a7d54?style=flat-square" />
    <img alt="Version: v1.0" src="https://img.shields.io/badge/version-v1.0-6f5f95?style=flat-square" />
  </p>
</div>

---

Cello is a plain-text spreadsheet format. It defines how spreadsheets are written as text, not which app edits them or who is allowed to use them.

This document is the canonical rulebook for `.cel` files. It states the core bylaws first, then the syntax and behavior rules that follow from them.

## 0. 📜 First bylaws

### A. Cello is free

Cello is open source. It will never be paid-only, metered, limited, or locked behind usage caps. Anyone can use it, implement it, render it, and extend tooling around it without permission or quota.

### B. Cello is a format

Cello is not an app, not an editor, and not a hosted product. It is a convention for writing spreadsheets as text so different tools can parse, render, validate, diff, and generate the same source.

### C. Cello is light

Cello exists to be lighter than the alternatives. A `.cel` file should be quick to open, quick to render, easy to diff, easy to generate, and cheap to move through both human and machine workflows.

## 1. 📄 Workbooks and sheets

A `.cel` file contains one or more sheets. A sheet starts with `@sheet`.

```cel
@sheet Summary
| Metric | Value |
```

Syntax:

```cel
@sheet Name [format]
```

Rules:

1. `Name` is case-sensitive.
2. `[format]` is optional. If omitted, the sheet uses native Cello syntax.
3. Everything after a sheet declaration belongs to that sheet until the next `@sheet`.
4. If a file has no `@sheet`, it is treated as a single anonymous native Cello sheet.

Examples:

```cel
@sheet Report
@sheet Sales [csv]
@sheet Export [tsv]
@sheet RawData [json]
```

## 2. 🧾 Input formats

Cello sheets can be written directly, or loaded from common data formats.

| Format | Example | Notes |
|---|---|---|
| Native Cello | `@sheet Report` | Full Cello syntax: formulas, modifiers, merges, headers |
| CSV | `@sheet Sales [csv]` | Comma-separated values |
| TSV | `@sheet Export [tsv]` or `@sheet Export [\t]` | Tab-separated values |
| Excel-style | `@sheet Sales [excel]` or `@sheet Sales [;]` | Semicolon-separated values |
| Custom delimiter | `@sheet Data [,]` | Any single-character delimiter |
| Markdown table | `@sheet Data [markdown]` | First row becomes headers; separator row is ignored |
| JSON | `@sheet Data [json]` | Flat arrays of objects |

Delimited sheets use their first row as column headers by default.

```cel
@sheet Sales [csv]
product,price,quantity
Apple,1.2,5
Pear,0.9,3
```

Use `:noheader` when the first row is data.

```cel
@sheet Raw [csv:noheader]
Apple,1.2,5
Pear,0.9,3
```

In `noheader` sheets, columns are still available by coordinate references such as `A1`, `B1`, and `C1`.

## 3. 🔗 External sources

A sheet can load its content from another file. The source line must appear immediately after the sheet declaration and before any row content.

```cel
@sheet Sales [csv]
-> ./exports/sales.csv

@sheet Summary
@header | Metric | Value |
| Revenue | =SUM(Sales!amount[*]) |
```

Rules:

1. The declared sheet format controls how the external file is parsed.
2. Relative paths are resolved from the parser base directory.
3. If loading fails, Cello records a diagnostic and continues parsing the rest of the workbook.

## 4. 🧱 Native rows and cells

Native Cello rows are written with pipe-separated cells.

```cel
| Product | Price | Quantity |
| Apple   | 1.20  | 5        |
| Pear    | 0.90  | 3        |
```

Rules:

1. A native data row contains cells separated by `|`.
2. Write native rows in the form `| cell | cell |` for predictable parsing and readable diffs.
3. Blank lines do not consume row numbers and are not rendered.
4. Multiple spaces inside cells may be used for alignment in source files.

```cel
| A | B |

| C | D |
```

In this example, `C` and `D` are on row 2. The blank line is ignored.

## 5. 🏷️ Column headers

A header row assigns names to columns. Named columns make formulas easier to read than coordinate references.

```cel
@header | Product | Price | Quantity | Total |
| Apple | 1.20 | 5 | =Price*Quantity |
| Pear  | 0.90 | 3 | =Price*Quantity |
```

Rules:

1. Header rows use `@header` followed by a pipe-separated row: `@header | Product | Price | Quantity |`.
2. Headers apply from the next data row downward.
3. A later header row replaces the active column names from that point on.
4. Header rows render as table headers.
5. Header modifiers apply to every cell in that column.

```cel
@header | Product | Price[€][2d] | Quantity[0d] | Total[€][2d] |
| Apple | 1.20 | 5 | =Price*Quantity |
```

Column letters are always available as well. The first column is `A`, then `B`, `C`, and so on.

## 6. 🎚️ Row-level formatting

Rows can carry formatting modifiers before the first pipe. These modifiers apply to every cell in that row.

```cel
[bold][bg:#f5f5f5] | Total | =SUM(Amount) |
```

This is formatting only. Only modifiers should appear before the first pipe in public `.cel` files; row references are not part of the public Cello format.

Modifier precedence is:

```text
cell > row > column
```

That means a cell modifier overrides a row modifier, and a row modifier overrides a column modifier.

## 7. 🔤 Data types

Cello infers basic data types automatically.

| Type | Rule | Example |
|---|---|---|
| Number | Numeric value | `42`, `3.14` |
| Date | ISO date | `2026-01-15` |
| Boolean | Uppercase literal | `TRUE`, `FALSE` |
| Text | Anything else | `North`, `pending`, `A-001` |

Use double quotes to force text when a value looks like another type.

```cel
| "00123" | "TRUE" | "2026-01-15" |
```

The quotes are type markers. They prevent automatic number, boolean, or date inference.

## 8. 🧮 Formulas

Any cell starting with `=` is a formula.

```cel
| =Price*Quantity |
| =SUM(Total) |
| =B2*C2 |
```

Formulas support both coordinate references and named column references.

| Syntax | Meaning |
|---|---|
| `=B2*C2` | Coordinate reference |
| `=Price*Quantity` | Named column reference on the current row |
| `=SUM(Total)` | Sum values above the formula row in the `Total` column |
| `=SUM(Total[*])` | Sum the full `Total` column |
| `=SUM(Total[2:5])` | Sum rows 2 through 5 in the `Total` column |
| `=Sales!B4` | Coordinate reference on another sheet |
| `=SUM(Sales!Total[*])` | Named column reference on another sheet |
| `=SUM(!!Amount)` | Reference the first sheet in the workbook |

Same-sheet named references are context-aware:

1. In scalar formulas, a bare column name refers to the current row.
2. In aggregate formulas, a bare column name refers to rows above the formula row.
3. Use `[*]` to force the full data range.

```cel
@header | Product | Revenue | Cost | Profit |
| A | 1200 | 800 | =Revenue-Cost |
| B | 1800 | 900 | =Revenue-Cost |
| Total | =SUM(Revenue) | =SUM(Cost) | =SUM(Profit) |
```

The total row does not include itself when using `SUM(Revenue)`.

## 9. 📐 Named ranges

Named ranges are based on column headers.

```cel
@header | Month | Revenue |
| Jan | 1200 |
| Feb | 1800 |
| Mar | 1500 |
| Total | =SUM(Revenue) |
```

Range forms:

| Syntax | Meaning |
|---|---|
| `Revenue` | Current row in scalar context, previous rows in aggregate context |
| `Revenue[*]` | Full data span of the column |
| `Revenue[2:5]` | Rows 2 through 5 |
| `Sales!Revenue` | Named column on another sheet |
| `Sales!Revenue[*]` | Full named column on another sheet |

Use named ranges when formulas should remain readable after columns move.

## 10. ↔️ Merges

Cello supports horizontal and vertical merges.

```cel
| ## Quarterly Report | < | < | 2026 |
| Region | City | Owner | Revenue |
| North  | Madrid | Ana | 1200 |
| ^      | Bilbao | Luis | 900 |
```

Rules:

1. `<` merges with the visible cell on the left.
2. `^` merges with the visible cell above.
3. Merge tokens must appear alone in the cell.
4. Merge tokens do not carry values or modifiers of their own.

## 11. 🎨 Modifiers

Modifiers are attached directly to headers, row prefixes, or cell values.

```cel
@header | Metric | Revenue[€][2d] | Margin[%][1d] |
[bold] | Total | =SUM(Revenue) | =AVG(Margin) |
| Critical[bg:red][#fff] | 1200 | 0.42 |
```

Scopes:

| Location | Example | Scope |
|---|---|---|
| Column header | `@header | Revenue[€][2d] |` | Every cell in that column |
| Row modifiers | `[bold] | Total | ... |` | Every cell in that row |
| Cell value | `Late[bg:red][#fff]` | That cell only |

Supported modifiers:

| Modifier | Meaning |
|---|---|
| `[€]` | Display number with euro prefix |
| `[$]` | Display number with dollar prefix |
| `[£]` | Display number with pound prefix |
| `[%]` | Display number as a percentage |
| `[0d]`, `[1d]`, `[2d]` | Decimal places |
| `[bold]` | Bold text |
| `[italic]` | Italic text |
| `[#rrggbb]` | Text color |
| `[bg:#rrggbb]` | Background color |
| `[colorname]` | CSS named text color |
| `[bg:colorname]` | CSS named background color |
| `[#bg:#rrggbb:#rrggbb]` | Background and text color shorthand |
| `[tone:ok]`, `[tone:warn]`, `[tone:error]`, `[tone:info]`, `[tone:muted]`, `[tone:accent]` | Semantic tone preset |
| `[hidden]` | Parsed as hidden metadata for tooling |

Named CSS colors such as `red`, `blue`, `green`, `orange`, and `gold` are accepted.
Tone presets map to renderer-defined CSS classes so embedding clients can override their colors with custom CSS.

## 12. 🧩 Column default formulas

A column can define a default formula for empty cells in that column with a non-rendered `@defaults` row.

```cel
@header   | Product | Price[€][2d] | Quantity[0d] | Total[€][2d] |
@defaults |         |              |              | =Price*Quantity |
| Apple | 1.20 | 5 | |
| Pear  | 0.90 | 3 | |
| Override | 10 | 2 | 99 |
```

Rules:

1. Defaults are declared with `@defaults | ... |` below the active header.
2. `@defaults` rows are configuration rows. They do not render and do not consume row numbers.
3. Defaults only apply to empty cells.
4. Explicit cell values and formulas always win.
5. `default` is a column-level behavior; do not use it as header, row, or cell formatting.
6. The leading `=` is optional.

Header, row, and cell-level default modifiers are ignored:

```cel
@header | Total[default:=Price*Quantity] |
| [default:=Price*Quantity] |
```

## 13. ✍️ Inline formatting

Cell text supports a small Markdown-like formatting set.

| Syntax | Result |
|---|---|
| `*text*` | Bold |
| `_text_` | Italic |
| `~~text~~` | Strikethrough |
| `# text` | Heading-style cell |
| `## text` | Larger heading-style cell |

Examples:

```cel
| *Priority* |
| _Estimated_ |
| ~~Deprecated~~ |
| ## Total |
```

`#` and `##` apply to the whole cell.

## 14. 💬 Comments

Comments use `//` and are valid outside rows.

```cel
// Data exported from CRM
@sheet Sales [csv]
product,amount
Enterprise,1200
SMB,800
```

Rules:

1. A comment line starts with `//`.
2. Comments are not rendered.
3. Comments inside cell content are not supported.

## 15. 🔒 Reserved tokens

These tokens have special meaning in Cello.

| Token | Meaning |
|---|---|
| `@sheet` | Sheet declaration |
| `[format]` | Sheet format or modifier block |
| `->` | External source line |
| `|` | Cell separator in native rows |
| `@header` | Header row marker |
| `=` | Formula prefix |
| `!` | Cross-sheet reference separator |
| `!!` | First-sheet alias |
| `[n:m]` | Named column row slice |
| `[*]` | Full named column span |
| `<` | Horizontal merge token |
| `^` | Vertical merge token |
| `//` | Comment line |
| `"..."` | Force text type |

## 16. 🛟 Error handling and resilience

Cello is resilient by default. Local issues should not prevent the rest of the workbook from rendering.

Rules:

1. Formula evaluation errors render as cell-level error values.
2. Non-parseable formulas fall back to their raw formula text.
3. Unknown cell syntax is treated as plain text when possible.
4. Invalid or unsupported sheet content records diagnostics and parsing continues.
5. Broken external sources record diagnostics and the remaining workbook still renders.

This behavior is intentional. A `.cel` file should be useful even when part of it is incomplete, generated, or temporarily invalid.

## 📚 Quick reference

| Task | Syntax |
|---|---|
| Start a native sheet | `@sheet Summary` |
| Start a CSV sheet | `@sheet Sales [csv]` |
| Load an external CSV | `@sheet Sales [csv]` then `-> ./sales.csv` |
| Define headers | `@header | Product | Price | Quantity |` |
| Write a row | `| Apple | 1.20 | 5 |` |
| Format a row | `[bold] | Total | =SUM(Amount) |` |
| Format a column | `@header | Amount[€][2d] |` |
| Format a cell | `Late[bg:red][#fff]` |
| Write a formula | `=Price*Quantity` |
| Sum previous rows | `=SUM(Amount)` |
| Sum a full column | `=SUM(Amount[*])` |
| Reference another sheet | `=SUM(Sales!Amount[*])` |
| Merge right | `<` |
| Merge down | `^` |
| Force text | `"00123"` |
| Add a comment | `// source: CRM export` |
