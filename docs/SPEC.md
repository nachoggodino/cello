# Cello (.cel) — Specification v1.0

> Markdown, but for spreadsheets. Plain-text tabular data with formulas, designed for humans and AI.

Cello is a plain-text format for tabular data with formulas. It is human-readable, git-friendly, LLM-friendly, and renders to HTML with multiple sheets, named columns, evaluated formulas, and rich formatting. It is not a replacement for Excel — it is to Excel what Markdown is to Word.

The reference implementation is the GPLv3 npm package `@nachoggodino/cello`. Formula evaluation uses HyperFormula under its GPLv3 option.

> Implementation note: this document is the target spec. For exact current behavior status, see `docs/COMPLIANCE.md`.

---

## Table of Contents

1. [Philosophy](#1-philosophy)
2. [File Structure & Sheets](#2-file-structure--sheets)
3. [Sheet Input Formats](#3-sheet-input-formats)
4. [Rows](#4-rows)
5. [Columns](#5-columns)
6. [Column Header Rows](#6-column-header-rows)
7. [Row-Level Formatting](#7-row-level-formatting)
   - [Persisted Layout Controls](#71-persisted-layout-controls)
8. [Data Types](#8-data-types)
9. [Formulas](#9-formulas)
10. [Merges](#10-merges)
11. [Inline Text Formatting](#11-inline-text-formatting)
12. [Cell Modifiers](#12-cell-modifiers)
13. [Comments](#13-comments)
14. [Error Handling](#14-error-handling)
15. [Reserved Tokens](#15-reserved-tokens)
16. [Full Example](#16-full-example)
17. [Implementation Guide](#17-implementation-guide)
18. [Use Cases](#18-use-cases)
19. [LLM Integration](#19-llm-integration)
20. [Out of Scope v1.0](#20-out-of-scope-v10)

---

## 1. Philosophy

**The core insight:** LLMs are bad at arithmetic but good at knowing which formulas to use. Cello lets a LLM describe calculations without performing them — the format evaluates them correctly every time.

**Design principles:**

- **Fail gracefully** — never a total render failure. Unknown syntax degrades to plain text.
- **Single-pass parseable** — every construct is resolvable line by line with state. No lookahead needed.
- **LLM-friendly by design** — syntax is minimal, consistent, and easy to generate from a system prompt.
- **Human-readable** — a `.cel` file opened in any text editor is immediately understandable.
- **Git-friendly** — plain text, line-oriented diffs, no binary noise.
- **Format-agnostic data ingestion** — data sheets accept multiple input formats; analysis sheets use Cello syntax.

---

## 2. File Structure & Sheets

A `.cel` file contains one or more **sheets**. Each sheet is declared with `@sheet`:

```cel
@sheet SheetName [format]
```

- `SheetName` is case-sensitive.
- `[format]` is optional — if omitted, the sheet uses native Cello syntax.
- An optional external source line can be provided immediately after the sheet declaration:
  - `-> /ruta/al/archivo.ext`
  - The declared sheet format still controls parsing.
- Everything between two `@sheet` declarations belongs to the first.
- A file with no `@sheet` is treated as a single anonymous sheet in native Cello format.

### Saved table views

Named views are non-rendered, sheet-scoped declarations. Their pipe cells map positionally to columns:

```cel
@view Madrid sales | @where *mad* | @sort asc | |
@view Large orders [default] | | @where >100 @sort desc | |
```

Each cell accepts `@where expression`, `@sort asc`, `@sort desc`, or both. Filters combine with AND and a view has at most one sort column. Supported filters are deterministic case-insensitive contains, `*` wildcards, numeric `>`, `>=`, `<`, `<=`, exact `=value`, `is:blank`, and `is:notblank`. Numeric comparisons apply only to actual numeric cells; blanks, booleans, and text are not coerced. Sorting is stable with blanks last. Header rows stay fixed and repeated headers create independent sections. `[default]` selects the initial interactive view. View declarations do not consume row numbers.

### Rendering

Sheets render as **horizontal tabs** at the top of the HTML output. The first sheet is active by default. If tabs overflow a single line, they scroll horizontally.

---

## 3. Sheet Input Formats

The `[format]` modifier on `@sheet` defines how the sheet content is parsed. All formats produce the same internal AST — the rest of the pipeline is identical.

### 3.1 Native Cello (default)

No format modifier needed. Full Cello syntax with formulas, modifiers, merges, etc.

```
@sheet Resumen

@header | Métrica | Valor[€][2d] |
| Total ventas | =SUM(Datos!importe) |
```

### 3.2 Delimited formats

Any single character can be used as a delimiter:

```
@sheet Ventas [,]       ← comma-separated (CSV)
@sheet Ventas [,noheader]  ← CSV without header row
@sheet Exports [\t]     ← tab-separated (TSV)
@sheet EuroData [;]     ← semicolon-separated (Excel European)
@sheet Custom [|]       ← pipe-separated
```

Named aliases are available as shorthand:

| Alias     | Equivalent | Notes |
|-----------|------------|-------|
| `[csv]`   | `[,]`      | RFC 4180 compliant |
| `[tsv]`   | `[\t]`     | |
| `[excel]` | `[;]`      | European Excel default |

The `noheader` flag is available for all delimited formats:

```
@sheet Datos [csv:noheader]    ← columns assigned letters A, B, C...
@sheet Datos [\t:noheader]
```

All delimited formats use a single generic parser with a delimiter parameter. There is no performance difference between them.

### 3.5 External sheet source

You can load a sheet from an external file while keeping the same format declaration:

```
@sheet Ventas [csv]
-> ./exports/ventas.csv
```

Rules:
- `-> path` must appear before any row content in that sheet.
- Relative paths are resolved from the parser `baseDir` (or process cwd when omitted).
- If loading fails, parsing continues with a warning diagnostic.

### 3.3 Markdown tables

```
@sheet Datos [markdown]

| nombre | edad | ciudad |
|--------|------|--------|
| Ana    | 25   | Madrid |
```

The separator row (`|---|---|`) is ignored. First row is treated as headers. This allows copy-pasting existing Markdown tables directly into a `.cel` file.

### 3.4 JSON

```
@sheet Datos [json]

[
  {"nombre": "Ana", "edad": 25, "ciudad": "Madrid"},
  {"nombre": "Luis", "edad": 32, "ciudad": "Barcelona"}
]
```

- Only flat arrays of objects are supported in v1.0.
- First object's keys become column headers.
- For complex nested JSON, flatten externally first and paste the result.
- JSONPath selection is planned for v1.1: `[json:$.items]`

---

## 4. Rows

- Every row is a line containing `|` delimiters.
- Rows are **auto-numbered** starting at 1, top to bottom, per sheet.
- A **blank line** (no `|`) does not consume a row number and is not rendered.
- Leading and trailing `|` are optional but recommended for readability.
- Multiple consecutive spaces inside a cell **collapse to one** on render — use spaces freely to align columns in plain text.

```
| Manzanas  | 1.20  | 50  |   ← renders as "Manzanas", "1.20", "50"
| Peras     | 0.90  | 30  |

| TOTAL     | ...   | ... |   ← row 3 (blank line is ignored)
```

---

## 5. Columns

- Columns are **auto-assigned a letter** (A, B, C... Z, AA, AB...) left to right.
- Column letters are scoped per sheet and reset at each `@sheet`.
- Both letter references and named references are always valid simultaneously.

---

## 6. Column Header Rows

A line that starts with `@header` defines **column names** for all rows below until the next header row:

```
@header | Producto | Precio | Cantidad | Total |
```

- Column names apply from the next data row downward.
- A second header row redefines names from that point on.
- Named references in formulas resolve against the active column header.
- Header rows render as `<th>` elements by default.
- Modifiers `[]` on a column header **apply to all cells in that column**.

```
@header | Producto | Precio[€][2d] | Stock[0d][bg:#fff9c4] | Activo |
```

`[hidden]` is currently parsed into column metadata (`column.hidden`) and can be used by tooling; current renderer does not hide header/cells yet.

```
@header | Producto | Precio[hidden] | Total |
```

---

## 7. Row-Level Formatting

Modifier blocks placed **before the first `|`** apply to every cell in that row. Arbitrary text before the first pipe is not part of the public Cello format.

```
| Manzanas | 1.20 | 50 | =Precio*Cantidad |
| Peras    | 0.90 | 30 | =Precio*Cantidad |
```

- Row modifiers are parsed and preserved in AST/serialization.
- Row-name formula references (for example `Sheet!row_name.Column`) are not supported.
- Rows are referenceable by number.
- Only modifier blocks should appear before the first pipe.

```
[bold][bg:#f5f5f5] | TOTAL | < | < | =SUM(Total) |
```

---

## 7.1 Persisted Layout Controls

Default layout is normal fixed-width columns and auto-height wrapped rows. Native sheet declarations can set sheet defaults:

```
@sheet Compact [columns:normal][rows:ellipsis]
@sheet FitBoard [columns:fit][rows:wrap]
```

Column widths are header modifiers. Values accept presets (`xshort`, `short`, `normal`, `large`, `xlarge`, `xxlarge`), bare numbers as `ch`, explicit `ch`, explicit `px`, aliases, or `[fit]`.

```
@header | Status[width:xshort] | Title[width:normal] | Description[fit] |
```

Row display controls are row-prefix modifiers. Rows default to `[wrap][height:auto]`; explicit `[height:...]` limits the visible area.

```
[wrap] | ok | Long content |
[wrap][height:3] | yes | Clamped long content |
[ellipsis][height:1] | no | Compact clipped row |
```

Aliases are project-level and namespace-scoped:

```
@tone notes [color:#334155][bg:#f8fafc]
@width description [width:large]
@height note [height:3]
```

They are used as `[tone:notes]`, `[width:description]`, and `[height:note]`; bare alias use is invalid. Precedence is column/row modifier, then sheet default, then renderer/editor default. Height presets are `1`, `2`, `5`, and `auto`.

---

## 8. Data Types

Types are inferred automatically:

| Type    | Rule                          | Example       |
|---------|-------------------------------|---------------|
| Number  | Parseable as numeric          | `42`, `3.14`  |
| Date    | Matches `YYYY-MM-DD`          | `2024-01-15`  |
| Boolean | Literal `TRUE` or `FALSE`     | `TRUE`        |
| Text    | Anything else                 | `hello`, `—`  |

Force text type with double quotes:

```
| "123" |     ← text, not number
| "TRUE" |    ← text, not boolean
```

---

## 9. Formulas

Any cell value starting with `=` is a formula. Evaluation is delegated to HyperFormula, with Cello-side translation for supported named column references.

```
| =Precio*Cantidad       |
| =SUM(Total)            |
| =B2*C2                 |
| =IF(Margen>0.2,"✓","✗") |
```

Both **named references** and **coordinate references** are valid and can be mixed freely.

### 9.1 Column range references

```
=Precio               ← current row's Precio cell, current sheet
=SUM(Precio)          ← Precio rows before current formula row, current sheet
=SUM(Precio[*])       ← full Precio data column, current sheet
=SUM(Precio[2:5])     ← rows 2–5 of Precio column
=Precio[2]            ← row 2 of Precio column
=AVG(Margen)          ← Margen rows before current formula row
```

Same-sheet named column references are context-sensitive:

- In scalar context, `Precio` resolves to the current row cell in that column.
- In aggregate/range context on the same sheet, `Precio` resolves from the first data row up to the row before the formula row. This prevents footer totals like `=SUM(Precio)` from including themselves.
- `Precio[*]` forces the full data span of the column, including rows below the formula row.

### 9.2 Cross-sheet references

Use `!` as the separator:

```
=SUM(Ventas!Total)
=SUM(Ventas!Total[*])
=Ventas!Total[2]
=Ventas!B4
=COUNTIF(Datos!edad,25)
```

`!!` is an alias for the first sheet name in the workbook:

```
=SUM(!!amount)
```

### 9.3 Formula evaluation order

Dependencies are resolved automatically via topological sort (HyperFormula). Circular references are detected and reported as `#CIRCULAR!`.

---

## 10. Merges

### 10.1 Horizontal merge

A cell containing only `<` merges with the previous cell (extends rightward):

```
| ## Informe Q1 | <  | <  | valor |   ← spans 3 columns
```

### 10.2 Vertical merge

A cell containing only `^` merges with the cell directly above (extends downward):

```
| Grupo A | val1 |
| ^       | val2 |   ← "Grupo A" spans 2 rows
| ^       | val3 |   ← spans 3 rows
| Grupo B | val4 |
```

### 10.3 Parser resolution

Merge tokens are resolved during the single-pass parse using the previously built AST rows. No lookahead required — `<` looks left in the current row, `^` looks up in the previous row at the same column index.

---

## 11. Inline Text Formatting

Markdown-style inline formatting is supported inside cell content:

| Syntax        | Result              |
|---------------|---------------------|
| `*texto*`     | **bold**            |
| `_texto_`     | *italic*            |
| `~~texto~~`   | ~~strikethrough~~   |
| `# texto`     | Heading style (`cello-h2`) |
| `## texto`    | Heading style (`cello-h1`) |
| `### texto`   | Heading style (`cello-h3`) |

`#`, `##`, and `###` apply to the entire cell and cannot be combined with other inline formatting in the same cell.

---

## 12. Cell Modifiers `[]`

Modifiers control formatting and rendering. They appear after a value with no space:

```
celda[bold][bg:red]
```

**Modifier scope and inheritance:**

| Where applied | Scope |
|---------------|-------|
| Column header `@header | Col[mod] |` | All cells in that column |
| Row name `ref[mod]` | All cells in that row |
| Individual cell `value[mod]` | That cell only |

Individual cell modifiers **override** column and row modifiers on conflict. Row modifiers override column modifiers.

### 12.1 Column defaults

| Modifier | Meaning |
|----------|---------|
| `@defaults | ... |` | Fill empty cells in each matching column with a default value or formula |

`default` is a column-only behavior declared in a non-rendered `@defaults` row below the active header. Header, row, and cell-level default modifiers are ignored. Defaults that start with `=` are formulas. Defaults that do not start with `=` are parsed as literal values. Explicit row values and formulas always win over the column default.

```
@header   | Status    | Qty | Price | Total[€][2d] |
@defaults | "Pending" |     |       | =Qty*Price   |
|         | 2   | 3   |      ← Status becomes Pending; Total renders as €6.00
| Done    | 4   | 5   | 99   ← explicit values are preserved
```

`@defaults` rows update column metadata only. They do not render and do not consume row numbers.

### 12.2 Numeric format

| Modifier | Meaning |
|----------|---------|
| `[€]`    | Prefix with € symbol |
| `[$]`    | Prefix with $ symbol |
| `[£]`    | Prefix with £ symbol |
| `[%]`    | Percentage format |
| `[Nd]`   | N decimal places (e.g. `[2d]`, `[0d]`) |

These modifiers are parsed, preserved in AST, and applied by the renderer to numeric cells, including evaluated formula cells such as `=SUM(Amount)[$][2d]`. When used on a column header, they apply to every numeric cell in that column. Row and cell modifiers follow the normal precedence rules, so a row or cell can override column decimal/currency choices. Percent display multiplies numeric values by 100 before appending `%`.

### 12.3 Color

| Syntax         | Meaning |
|----------------|---------|
| `[#rrggbb]`    | Text color (hex) |
| `[bg:#rrggbb]` | Background color (hex) |
| `[colorname]`  | Text color (CSS named color) |
| `[bg:colorname]` | Background color (CSS named color) |
| `[#bg:#fg]`    | Both colors shorthand: background:text |

Named colors are standard CSS color names (`red`, `blue`, `green`, `orange`, `gold`, etc.).

### 12.4 Style

| Modifier   | Meaning |
|------------|---------|
| `[bold]`   | Bold text |
| `[italic]` | Italic text |
| `[hidden]` | Parsed metadata flag (render-time hiding not implemented yet) |

### 12.5 Tone presets

| Modifier | Meaning |
|----------|---------|
| `[tone:ok]` | Positive/success emphasis |
| `[tone:warn]` | Warning/caution emphasis |
| `[tone:error]` | Error/failure emphasis |
| `[tone:info]` | Informational emphasis |
| `[tone:muted]` | Secondary/de-emphasized emphasis |
| `[tone:accent]` | Primary highlight emphasis |

Tone presets are rendered as CSS classes (`cello-tone-*`) rather than inline colors so host applications can override them with custom CSS. The built-in renderer defines default foreground/background pairs through CSS variables on `.cello-workbook`.

### 12.6 Combined example

```
@header | Producto | Precio[€][2d] | Margen[%][1d][bg:#e8f5e9] |

[bold][bg:#f0f0f0] | ## TOTAL | < | =SUM(Precio) | =SUM(Margen) |

| valor crítico[bg:red][#fff] | < | dato |
| estado[tone:accent] | normal[tone:ok] | atención[tone:warn] |
```

---

## 13. Comments

Supported **outside rows only**, using `//`. Not supported inside cell values.

```
// Annual sales report — generated by agent on 2024-01-15

@sheet Datos [csv]
// Raw data from CRM export
nombre,edad,importe
Ana,25,120
```

---

## 14. Error Handling

Primary non-strict contract: parsing/evaluation tries to continue and diagnostics accumulate on `workbook.diagnostics`.

| Stage | Behavior |
|-------|----------|
| Parse | Non-row native lines -> warning diagnostics and skipped |
| Parse (json sheet) | Invalid JSON -> warning + single fallback text row |
| Evaluate | Missing HyperFormula -> warning, formulas left unresolved |
| Evaluate | Engine/runtime failure -> error diagnostic; throw only in strict evaluate mode |
| Formula parse error in engine | `computed` falls back to original formula text |

**Strict mode:** `strict: true` propagates parse/evaluate throws; warnings alone do not throw.

```javascript
render(celContent, { strict: true })  // throws when parse/evaluate throw
render(celContent)                    // returns HTML, diagnostics on AST/eval path
```

---

## 15. Reserved Tokens

| Token      | Meaning |
|------------|---------|
| `@sheet`   | Sheet declaration |
| `=`        | Formula prefix (start of cell value) |
| `<`        | Horizontal merge continuation |
| `^`        | Vertical merge continuation |
| `@header`  | Column header row marker |
| `//`       | Comment (outside rows only) |
| `"..."`    | Force text type |
| `!`        | Cross-sheet reference separator |
| `->`       | External sheet source line |
| `[n]`      | Single row in column references |
| `[n:m]`    | Row range in column references |
| `[...]`    | Modifier block |

---

## 16. Full Example

```
// Q1 Sales Report — generated 2024-01-15

@sheet Datos [csv]
nombre,edad,ciudad,importe
Ana,25,Madrid,120
Luis,32,Barcelona,340
Sara,25,Madrid,89
Pedro,32,Valencia,210
Marta,25,Barcelona,95

@sheet Por_Edad

// KPIs grouped by age
@header | edad[0d] | total[€][2d] | contador[0d] | ticket_medio[€][2d] |
| 25 | =SUMIF(Datos!edad,25,Datos!importe)  | =COUNTIF(Datos!edad,25) | =total/contador |
| 32 | =SUMIF(Datos!edad,32,Datos!importe)  | =COUNTIF(Datos!edad,32) | =total/contador |

[bold][bg:#f0f0f0] | ## TOTAL | =SUM(total) | =SUM(contador) | =SUM(total)/SUM(contador) |

@sheet Resumen

@header | Métrica | Valor |
| Total revenue    | =SUM(Por_Edad!total)      |
| Total clientes   | =SUM(Por_Edad!contador)   |
| Ticket medio     | =AVG(Por_Edad!ticket_medio) |
| Fecha análisis   | 2024-01-15                |
| Generado por     | "agente-ventas-v2"        |
```

---

## 17. Implementation Guide

### 17.1 Library architecture

The reference implementation is a TypeScript/JavaScript npm package called `@nachoggodino/cello`. It exposes six core functions:

```typescript
parse(text: string, options?): AST
evaluate(ast: AST, options?): Promise<AST>
format(text: string): string
formatSource(text: string, options?: { layout?: "compact" | "pretty", range?: { start: number, end: number } }): string
validate(text: string, options?): Promise<{ valid: boolean, diagnostics: Diagnostic[] }>
render(input: string | AST, options?: { strict?, title?, baseDir?, evaluate?, format?: "document" | "fragment" }): Promise<string>
```

The package also exports editor-oriented helpers from `@nachoggodino/cello/editor-core`
and session-backed source, HTML preview, visual editor, and optional workbench React
components from `@nachoggodino/cello/editor-react`.
The source component provides Cello-aware code editing while delegating undo/redo and
all source changes to the shared editor session.

### 17.2 Parser design

The parser processes the file in a **single pass**, line by line. It maintains these state variables:

```javascript
let currentSheet = null
let currentHeaders = []
let previousRowByColumn = new Map()
let jsonBufferBySheet = new Map()
let consumedDelimitedHeaderBySheet = new Set()
```

For each line, the parser checks in order:
1. Is it a comment (`//`)? → skip
2. Is it a `@sheet` declaration? → open new sheet, reset state
3. Is it a header row (`@header | ... |`)? → update `currentHeaders`
4. Is it a defaults row (`@defaults | ... |`)? → update active column defaults
5. Is it a data row (`|`)? → parse as Cello row
6. Is it a blank line? → ignore (does not consume row number)
7. Otherwise → handle by active sheet format rules (native/delimited/markdown/json)

Merge tokens are resolved immediately during row parsing:
- `<` → extend the previous cell's `colspan` in the current row
- `^` → extend the cell above's `rowspan` in `lastRow` at the same column index

### 17.3 Formula evaluation

HyperFormula is used as the formula engine when the workbook contains formulas. Formula-free workbooks skip engine loading. The package is licensed as GPLv3 and configures HyperFormula with `licenseKey: "gpl-v3"`. The integration flow:

```
AST (with formula strings)
    ↓
Translate named refs to coordinates
  "=SUM(Precio)" → "=SUM(B2:B9)"   // same-sheet footer total excludes current row
  "=SUM(Precio[*])" → "=SUM(B2:B10)"
  "=Ventas!Total" → sheet cross-reference
    ↓
Feed all sheets to HyperFormula
    ↓
HyperFormula resolves dependency graph (topological sort)
    ↓
Retrieve computed values cell by cell
    ↓
AST with computed values alongside original formulas
```

The name-to-coordinate translation is the only custom logic needed. HyperFormula handles dependency resolution, error propagation, and all function implementations.

### 17.4 Renderer

The renderer evaluates by default, unless `evaluate: false` is passed. It walks the selected AST and produces HTML in one of two shapes:

```
<style> /* inline CSS */ </style>
<div class="cello-workbook">
  <div class="cello-tabs">
    <button class="tab active">Datos</button>
    <button class="tab">Por_Edad</button>
    <button class="tab">Resumen</button>
  </div>
  <div class="cello-sheet active"> ... </div>
  <div class="cello-sheet hidden"> ... </div>
  <div class="cello-sheet hidden"> ... </div>
</div>
<script> /* inline tab switching JS */ </script>
```

`format: "document"` is the default and returns a self-contained HTML document (`<!doctype html>`) with `html`, `head`, and `body` wrappers. `format: "fragment"` returns only the inline CSS, workbook container, and inline JS so the output can be embedded inside an existing page. No external dependencies are required in either format.

Rendered tables include spreadsheet coordinate chrome: a synthetic top row displays column letters (`A`, `B`, `C`...), and a synthetic first column displays semantic row numbers. This chrome is presentation-only; it is not part of the AST or `.cel` source text. Header rows use the same row numbering as formulas, so a header at the top of a sheet is row `1` and the first value row below it is row `2`.

### 17.5 Source-preserving changes

The AST is a semantic projection and is not a lossless source representation. The public
API therefore does not provide an AST-to-`.cel` serializer. Source-authoritative tools
retain the original text and apply bounded changes through `formatSource` or editor
document commands.

```
source + command → minimal source patch → reparse and verify
```

This preserves comments, unknown or malformed fragments, line endings, spacing outside
the authorized formatting scope, and explicit/omitted/default-derived cell provenance.
Internal syntax emitters may create individual cells, rows, declarations, or entirely
new sheets when a document command has no existing source span to patch.

### 17.6 Ecosystem components

| Component | Description | Priority |
|-----------|-------------|----------|
| `@nachoggodino/cello` (npm) | GPLv3 core library: parse, evaluate, format, validate, render | v1 |
| `cello` CLI | CLI tool: `cello render file.cel > out.html`; `cello serve file.cel` for live previews | v1 |
| `cello-playground` | Web playground: split-view editor + live preview | v1 |
| `@nachoggodino/cello/editor-core` | Source-preserving workbook editing model, commands, selectors, and evaluation helpers | v1 |
| `@nachoggodino/cello/editor-react` | React source, preview, visual editor, optional workbench, and stylesheet | v1 |
| `cello-python` | Python port of parser + renderer | v2 |
| `cello-vscode` | VSCode extension with live preview | v2 |

### 17.7 Format converters

Converters transform external formats into `.cel` text. They are separate utilities, not part of the core library.

| Converter | Input | Output | Notes |
|-----------|-------|--------|-------|
| `fromCSV(csv, sheetName?)` | CSV string | `@sheet [csv]` block | Trivial |
| `fromXLSX(buffer)` | Excel binary | Multi-sheet `.cel` | Via SheetJS |
| `fromMarkdown(md)` | Markdown tables | `@sheet [markdown]` block | |
| `fromJSON(json, path?)` | JSON array | `@sheet [json]` block | Flat arrays only |
| `toCSV(cel, sheet)` | `.cel` text | CSV string | Per-sheet export |
| `toXLSX(cel)` | `.cel` text | Excel binary | Via SheetJS |

---

## 18. Use Cases

### 18.1 Primary pattern: Data sheet + KPI sheets

The dominant pattern for LLM-generated analysis:

```
@sheet RawData [csv]      ← data, any size, LLM never touches this
...

@sheet KPIs               ← LLM generates this from schema only
...formulas referencing RawData...

@sheet Summary            ← LLM generates executive summary sheet
...
```

The LLM reads only the first N rows to understand the schema, then generates the analysis sheets with formulas. A tool handles the full data conversion.

### 18.2 Use case examples

**Sales analysis**
```
"Here's our monthly sales CSV. Group by region, show total and average ticket."
→ LLM generates KPI sheet with SUMIF/COUNTIF/AVGIF per region
→ Cello evaluates correctly
→ Human reads clean tabular render
```

**Budget vs actuals**
```
"Here are my actual expenses and my budget plan."
→ Sheet 1: actuals [csv], Sheet 2: budget [csv]
→ LLM generates Sheet 3 with variance formulas and color coding
→ Over-budget cells highlighted in red automatically
```

**Financial due diligence**
```
"Here are 3 years of P&L data."
→ One sheet per year [csv]
→ LLM generates ratios sheet: CAGR, margins, YoY growth
→ All calculated by Cello, not inferred by LLM
```

**Data reconciliation**
```
"These two CSVs should match. Find discrepancies."
→ Sheet 1 and Sheet 2 with source data
→ LLM generates Sheet 3 with VLOOKUP cross-sheet comparisons
→ Mismatches surface automatically
```

**Projection modeling**
```
"If I grow 10% monthly from €1000, show me 12 months."
→ LLM generates single sheet with growth formula per row
→ No arithmetic by the LLM — just the formula pattern
```

**LLM reading back evaluated results**
```
// Two-step agentic flow:
Step 1: LLM generates .cel with formulas
Step 2: cello_evaluate() resolves all formulas to values
Step 3: cello_to_markdown_table() converts result sheet to plain text
Step 4: LLM reads plain numbers and generates written ana
