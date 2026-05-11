# Cello BYLAWS (v1.0)

Practical syntax rules for `.cel`, ordered by importance.

## 1) Core file structure

1. A `.cel` file can contain one or more sheets.
2. Every sheet starts with `@sheet`.
3. If no `@sheet` is present, the whole file is treated as one anonymous native Cello sheet.

Example:

```cel
@sheet Summary
| KPI | Value |
```

## 2) Sheet declaration and format

1. Syntax: `@sheet Name [format]`
2. `Name` is case-sensitive.
3. `[format]` is optional; default is native Cello.
4. Optional external source line syntax (must be right after `@sheet`): `-> /ruta/al/archivo`
5. External source content is parsed using the declared sheet format.

Examples:

```cel
@sheet Data [csv]
@sheet Export [\t]
@sheet Report
@sheet Data [csv]
-> ./exports/data.csv
```

## 3) What counts as a row

1. A data row starts by `|`.
2. Trailing `|` is optional (recommended to keep for readability).
3. A blank line does not consume row number and is not rendered.

Example:

```cel
| A | B |

| C | D |   // this is row 2 despite the blank line
```

## 4) Column header rows (`-column-`)

1. A line like `-Col1-Col2-...-` defines column names.
2. It applies from the next data row until another header row.
3. It enables named references in formulas.

Example:

```cel
-Product-Price-Quantity-
| Apple | 1.2 | 5 |
| Pear  | 0.9 | 3 |
```

## 5) Row name references

1. Text before the first `|` is a row name.
2. Row names are never rendered.
3. They are usable in formulas and can carry modifiers.

Example:

```cel
row_total[bold] | TOTAL | =SUM(Amount) |
```

## 6) Formulas

1. Any cell starting with `=` is a formula.
2. Named and coordinate references are both valid.
3. Cross-sheet references use `!`.
4. `!!` can be used as alias for the first sheet in the workbook.
5. On the same sheet, a bare named column is row-aware: scalar formulas use the current row cell, aggregate formulas use rows above the formula row, and `[*]` forces the full data range.

Examples:

```cel
| =Price*Quantity |
| =SUM(Total) |
| =Sales!B4 |
| =SUM(Sales!Total) |
| =SUM(!!Amount) |
| =Revenue/Units |
| =SUM(Revenue) |
| =SUM(Revenue[*]) |
```

## 7) Named column ranges

1. Full column: `SUM(Price)`
2. Row slice: `SUM(Price[2:5])`
3. Explicit full data span: `SUM(Price[*])`

Example:

```cel
| =SUM(Amount[2:10]) |
```

## 8) Merges

1. `<` merges horizontally with the cell on the left.
2. `^` merges vertically with the cell above.
3. Merge tokens must appear alone in the cell.

Example:

```cel
| ## Report | < | < | 2026 Sales |
| Region A  | Madrid | John | 10 |
| ^         | Alcala | Julie | 12 |
```

## 9) Inferred data types

1. Number: `42`, `3.14`
2. Date: `YYYY-MM-DD`
3. Boolean: `TRUE`/`FALSE`
4. Text: anything else
5. Force text with double quotes.

Example:

```cel
| "123" |   // text, not number
| "TRUE" |  // text, not boolean
```

## 10) Modifiers `[]`

1. Modifiers are attached directly to values: `value[mod][mod]`.
2. Scope:
   - Column header: whole column
   - Row name: whole row
   - Cell value: that single cell
3. Precedence: cell > row > column.

Example:

```cel
-Price[€][2d]-Stock[0d][bg:#fff9c4]-
row_total[bold] | TOTAL | =SUM(Price) |
| critical[bg:red][#fff] | 12 |
```

## 11) Inline formatting in cells

1. `*text*` bold
2. `_text_` italic
3. `~~text~~` strikethrough
4. `# text` and `## text` enlarge full-cell text.

Example:

```cel
| *Urgent* |
| ## TOTAL |
```

## 12) Comments

1. Comments are only valid outside rows.
2. Syntax: `// comment`
3. Comments inside cell content are not supported.

Example:

```cel
// data exported from CRM
@sheet Data [csv]
```

## 13) Reserved tokens (unambiguous)

- `@sheet`
- `|`
- `=`
- `<`
- `^`
- `-name-`
- `//`
- `"..."`
- `!`
- `->`
- `[n:m]`
- `[...]`

## 14) Resilience rule (critical)

Cello should never fail as a whole because of local errors:

1. Evaluated formula error -> show cell error code.
2. Non-parseable formula -> render raw formula text.
3. Unknown cell syntax -> treat as plain text.
4. Broken block/sheet structure -> degrade that block and continue parsing.
