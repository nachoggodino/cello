# Cello Authoring Reference

## Minimal Structure

```cel
@sheet SheetName [format]
@header | Column | Amount[€][2d] |
| Label | =SUM(OtherSheet!Amount[*]) |
```

A `.cel` workbook contains one or more sheets. A sheet starts with `@sheet Name [format]`. If no sheet is declared, the file is one anonymous native Cello sheet.

Sheet names are case-sensitive. Sheet content continues until the next `@sheet`.

## Sheet Formats

| Format | Use |
|---|---|
| Native, no modifier | Formulas, formatting, headers, merges, dashboards |
| `[csv]` or `[,]` | Comma-separated source data |
| `[tsv]` or `[\t]` | Tab-separated source data |
| `[excel]` or `[;]` | Semicolon-separated source data |
| `[markdown]` | Pasted Markdown tables |
| `[json]` | Flat arrays of objects |
| `[x:noheader]` | Delimited input where the first row is data |

External source:

```cel
@sheet Sales [csv]
-> ./exports/sales.csv
```

The `->` line must appear immediately after `@sheet` and before row content.

## Native Rows

Native rows are pipe-separated:

```cel
| Product | Price | Quantity |
| Apple | 1.20 | 5 |
```

Leading and trailing pipes are optional but recommended. Blank lines do not consume row numbers.

## Headers

```cel
@header | Product | Price[€][2d] | Quantity[0d] | Total[€][2d] |
| Apple | 1.20 | 5 | =Price*Quantity |
```

Headers apply from the next data row downward. A later `@header` replaces active column names from that point. Column letters are still available.

## Defaults

Use `@defaults` for empty cells that should receive a column formula:

```cel
@header   | Product | Price[€][2d] | Quantity[0d] | Total[€][2d] |
@defaults |         |              |              | =Price*Quantity |
| Apple | 1.20 | 5 | |
| Pear | 0.90 | 3 | |
```

Defaults do not render and do not consume row numbers. Explicit values and explicit formulas win.

## Types

| Type | Example |
|---|---|
| Number | `42`, `3.14` |
| Date | `2026-01-15` |
| Boolean | `TRUE`, `FALSE` |
| Text | `North`, `pending` |
| Forced text | `"00123"`, `"TRUE"` |

## Formulas

| Pattern | Meaning |
|---|---|
| `=B2*C2` | Coordinate reference |
| `=Price*Quantity` | Same-row named column reference |
| `=SUM(Total)` | Sum previous rows in current sheet |
| `=SUM(Total[*])` | Sum full named column |
| `=SUM(Total[2:5])` | Sum row slice |
| `=Sales!B4` | Cross-sheet coordinate |
| `=SUM(Sales!Total[*])` | Cross-sheet named full column |
| `=SUM(!!Amount)` | Named column on first sheet |

In scalar formulas, a bare column name means the current row. In aggregate formulas, a bare column name means previous rows above the formula row.

## Modifiers

| Modifier | Meaning |
|---|---|
| `[€]`, `[$]`, `[£]` | Currency display |
| `[%]` | Percent display |
| `[0d]`, `[1d]`, `[2d]` | Decimal places |
| `[bold]`, `[italic]` | Text emphasis |
| `[#rrggbb]`, `[colorname]` | Text color |
| `[bg:#rrggbb]`, `[bg:colorname]` | Background color |
| `[#bg:#rrggbb:#rrggbb]` | Background and text shorthand |
| `[tone:ok]`, `[tone:warn]`, `[tone:error]`, `[tone:info]`, `[tone:muted]`, `[tone:accent]` | Semantic tone |
| `[hidden]` | Hidden metadata for tooling |

Scopes:

```cel
@header | Amount[€][2d] |
[bold] | Total | =SUM(Amount) |
| Late[tone:error] | 1200 |
```

Precedence is `cell > row > column`.

## Merges And Inline Formatting

Merge tokens:

```cel
| ## Quarterly Report | < | < | 2026 |
| Region | City | Owner | Revenue |
| North | Madrid | Ana | 1200 |
| ^ | Bilbao | Luis | 900 |
```

`<` merges with the visible cell on the left. `^` merges with the visible cell above. Merge tokens must be alone in the cell.

Inline formatting:

| Syntax | Meaning |
|---|---|
| `*text*` | Bold |
| `_text_` | Italic |
| `~~text~~` | Strikethrough |
| `# text` | Heading-style cell |
| `## text` | Larger heading-style cell |

## Comments And Reserved Tokens

Comments start with `//` and are valid outside rows only.

Reserved tokens: `@sheet`, `[format]`, `->`, `|`, `@header`, `@defaults`, `=`, `!`, `!!`, `[n:m]`, `[*]`, `<`, `^`, `//`, and `"..."`.
