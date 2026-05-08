# Cello (.cel) — Specification v1.0

> Markdown, but for spreadsheets. Plain-text tabular data with formulas, designed for humans and AI.

Cello is a plain-text format for tabular data with formulas. It is human-readable, git-friendly, LLM-friendly, and renders to HTML with multiple sheets, named columns, evaluated formulas, and rich formatting. It is not a replacement for Excel — it is to Excel what Markdown is to Word.

---

## Table of Contents

1. [Philosophy](#1-philosophy)
2. [File Structure & Sheets](#2-file-structure--sheets)
3. [Sheet Input Formats](#3-sheet-input-formats)
4. [Rows](#4-rows)
5. [Columns](#5-columns)
6. [Column Header Rows](#6-column-header-rows)
7. [Row Names](#7-row-names)
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

```
@sheet SheetName [format]
```

- `SheetName` is case-sensitive.
- `[format]` is optional — if omitted, the sheet uses native Cello syntax.
- Everything between two `@sheet` declarations belongs to the first.
- A file with no `@sheet` is treated as a single anonymous sheet in native Cello format.

### Rendering

Sheets render as **horizontal tabs** at the top of the HTML output. The first sheet is active by default. If tabs overflow a single line, they scroll horizontally.

---

## 3. Sheet Input Formats

The `[format]` modifier on `@sheet` defines how the sheet content is parsed. All formats produce the same internal AST — the rest of the pipeline is identical.

### 3.1 Native Cello (default)

No format modifier needed. Full Cello syntax with formulas, modifiers, merges, etc.

```
@sheet Resumen

-Métrica-Valor[€][2d]-
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
- A **blank line** (no `|`) is an empty row and consumes a row number.
- Leading and trailing `|` are optional but recommended for readability.
- Multiple consecutive spaces inside a cell **collapse to one** on render — use spaces freely to align columns in plain text.

```
| Manzanas  | 1.20  | 50  |   ← renders as "Manzanas", "1.20", "50"
| Peras     | 0.90  | 30  |

| TOTAL     | ...   | ... |   ← row 4 (blank line was row 3)
```

---

## 5. Columns

- Columns are **auto-assigned a letter** (A, B, C... Z, AA, AB...) left to right.
- Column letters are scoped per sheet and reset at each `@sheet`.
- Both letter references and named references are always valid simultaneously.

---

## 6. Column Header Rows

A line where content is wrapped in hyphens defines **column names** for all rows below until the next header row:

```
-Producto-Precio-Cantidad-Total-
```

- Column names apply from the next data row downward.
- A second header row redefines names from that point on.
- Named references in formulas resolve against the active column header.
- Header rows render as `<th>` elements by default.
- Modifiers `[]` on a column header **apply to all cells in that column**.

```
-Producto-Precio[€][2d]-Stock[0d][bg:#fff9c4]-Activo-
```

Use `[hidden]` to define a column name for formula references without rendering the header:

```
-Producto-Precio[hidden]-Total-
```

---

## 7. Row Names

Text placed **before the first `|`** on a row is a reference name. It is **never rendered**.

```
fila_manzanas | Manzanas | 1.20 | 50 | =Precio*Cantidad |
fila_peras    | Peras    | 0.90 | 30 | =Precio*Cantidad |
```

- Row names are used in cross-row formula references.
- Rows without names are referenceable only by number.
- Modifiers `[]` on a row name **apply to all cells in that row**.

```
fila_total[bold][bg:#f5f5f5] | TOTAL | < | < | =SUM(Total) |
```

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

Any cell value starting with `=` is a formula. All standard Excel functions are supported (via HyperFormula).

```
| =Precio*Cantidad       |
| =SUM(Total)            |
| =B2*C2                 |
| =IF(Margen>0.2,"✓","✗") |
```

Both **named references** and **coordinate references** are valid and can be mixed freely.

### 9.1 Column range references

```
=SUM(Precio)          ← entire Precio column, current sheet
=SUM(Precio[2:5])     ← rows 2–5 of Precio column
=AVG(Margen)          ← entire Margen column
```

### 9.2 Cross-sheet references

Use `!` as the separator:

```
=Ventas!SUM(Total)
=Ventas!B4
=Ventas!fila_manzanas.Precio
=Datos!COUNTIF(edad,25)
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
| `# texto`     | Large text (h3)     |
| `## texto`    | Larger text (h2)    |

`#` and `##` apply to the entire cell and cannot be combined with other inline formatting in the same cell.

---

## 12. Cell Modifiers `[]`

Modifiers control formatting and rendering. They appear after a value with no space:

```
celda[bold][bg:red]
```

**Modifier scope and inheritance:**

| Where applied | Scope |
|---------------|-------|
| Column header `-Col[mod]-` | All cells in that column |
| Row name `ref[mod]` | All cells in that row |
| Individual cell `value[mod]` | That cell only |

Individual cell modifiers **override** column and row modifiers on conflict. Row modifiers override column modifiers.

### 12.1 Numeric format

| Modifier | Meaning |
|----------|---------|
| `[€]`    | Prefix with € symbol |
| `[$]`    | Prefix with $ symbol |
| `[£]`    | Prefix with £ symbol |
| `[%]`    | Percentage format |
| `[Nd]`   | N decimal places (e.g. `[2d]`, `[0d]`) |

Can be combined: `-Precio[€][2d]-`

### 12.2 Color

| Syntax         | Meaning |
|----------------|---------|
| `[#rrggbb]`    | Text color (hex) |
| `[bg:#rrggbb]` | Background color (hex) |
| `[colorname]`  | Text color (CSS named color) |
| `[bg:colorname]` | Background color (CSS named color) |
| `[#bg:#fg]`    | Both colors shorthand: background:text |

Named colors are standard CSS color names (`red`, `blue`, `green`, `orange`, `gold`, etc.).

### 12.3 Style

| Modifier   | Meaning |
|------------|---------|
| `[bold]`   | Bold text |
| `[italic]` | Italic text |
| `[hidden]` | Do not render (column, row, or cell) |

### 12.4 Combined example

```
-Producto-Precio[€][2d]-Margen[%][1d][bg:#e8f5e9]-

fila_total[bold][bg:#f0f0f0] | ## TOTAL | < | =SUM(Precio) | =SUM(Margen) |

| valor crítico[bg:red][#fff] | < | dato |
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

Cello never fails completely. Errors degrade gracefully through four levels:

| Level | Condition | Behavior | Visual |
|-------|-----------|----------|--------|
| 1 | Formula runtime error (`=1/0`, `#REF!`) | Excel-standard error code in cell | Red text |
| 2 | Formula not parseable (`=SUM(((`) | Raw formula text rendered as-is | Yellow background + ⚠ |
| 3 | Cell syntax unrecognized | Raw cell content as plain text | No style change |
| 4 | Block/sheet structure broken | Affected block as `<pre>`, parsing continues | Gray background |

**Error propagation:** A cell error does not propagate to cells that do not depend on it. Independent cells always evaluate correctly.

**Strict mode:** For CI/testing pipelines, pass `{ strict: true }` to the render function. In strict mode, any error throws an exception instead of degrading gracefully.

```javascript
render(celContent, { strict: true })  // throws on any error
render(celContent)                    // always returns HTML
```

---

## 15. Reserved Tokens

| Token      | Meaning |
|------------|---------|
| `@sheet`   | Sheet declaration |
| `=`        | Formula prefix (start of cell value) |
| `<`        | Horizontal merge continuation |
| `^`        | Vertical merge continuation |
| `-name-`   | Column header row |
| `//`       | Comment (outside rows only) |
| `"..."`    | Force text type |
| `!`        | Cross-sheet reference separator |
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
-edad[0d]-total[€][2d]-contador[0d]-ticket_medio[€][2d]-
| 25 | =SUMIF(Datos!edad,25,Datos!importe)  | =COUNTIF(Datos!edad,25) | =total/contador |
| 32 | =SUMIF(Datos!edad,32,Datos!importe)  | =COUNTIF(Datos!edad,32) | =total/contador |

fila_global[bold][bg:#f0f0f0] | ## TOTAL | =SUM(total) | =SUM(contador) | =SUM(total)/SUM(contador) |

@sheet Resumen

-Métrica-Valor-
| Total revenue    | =Por_Edad!SUM(total)      |
| Total clientes   | =Por_Edad!SUM(contador)   |
| Ticket medio     | =Por_Edad!AVG(ticket_medio) |
| Fecha análisis   | 2024-01-15                |
| Generado por     | "agente-ventas-v2"        |
```

---

## 17. Implementation Guide

### 17.1 Library architecture

The reference implementation is a TypeScript/JavaScript npm package called `cello`. It exposes four core functions:

```typescript
parse(text: string): AST
evaluate(ast: AST): AST          // resolves formulas via HyperFormula
render(ast: AST): string         // returns HTML string
serialize(ast: AST): string      // returns .cel text
```

And optional AST mutation helpers:

```typescript
ast.setCell(sheet, row, col, value)
ast.addRow(sheet, afterRow?)
ast.deleteRow(sheet, row)
ast.addSheet(name, format?)
ast.renameSheet(oldName, newName)
```

### 17.2 Parser design

The parser processes the file in a **single pass**, line by line. It maintains these state variables:

```javascript
let currentSheet = null       // active sheet being built
let currentHeaders = null     // active column header row
let currentFormat = 'cello'   // input format of current sheet
let rowIndex = 0              // current row number within sheet
let lastRow = null            // previous row (for ^ merge resolution)
```

For each line, the parser checks in order:
1. Is it a comment (`//`)? → skip
2. Is it a `@sheet` declaration? → open new sheet, reset state
3. Is it a header row (`-...-`)? → update `currentHeaders`
4. Is it a data row (`|`)? → parse as Cello row
5. Is it a blank line? → increment `rowIndex`, add empty row
6. Otherwise → pass to the active format parser (CSV, JSON, etc.)

Merge tokens are resolved immediately during row parsing:
- `<` → extend the previous cell's `colspan` in the current row
- `^` → extend the cell above's `rowspan` in `lastRow` at the same column index

### 17.3 Formula evaluation

HyperFormula is used as the formula engine. The integration flow:

```
AST (with formula strings)
    ↓
Translate named refs to coordinates
  "=SUM(Precio)" → "=SUM(B2:B10)"
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

The renderer walks the evaluated AST and produces a self-contained HTML string:

```
<div class="cello-workbook">
  <div class="cello-tabs">
    <button class="tab active">Datos</button>
    <button class="tab">Por_Edad</button>
    <button class="tab">Resumen</button>
  </div>
  <div class="cello-sheet active"> ... </div>
  <div class="cello-sheet hidden"> ... </div>
  <div class="cello-sheet hidden"> ... </div>
  <style> /* inline CSS */ </style>
  <script> /* inline tab switching JS */ </script>
</div>
```

The default output is a **self-contained HTML fragment** — all CSS and JS are inline. No external dependencies. Can be dropped into any webpage or opened as a standalone file.

### 17.5 Serializer

The serializer converts an AST back to valid `.cel` text. This enables round-trip editing: parse → mutate → serialize → parse again.

```
AST → serializer → .cel text
```

Rules:
- Preserves original formatting choices (spacing, alignment) where possible
- Reconstructs header rows from column metadata
- Outputs row names only where they exist in the AST
- Modifiers are serialized in consistent order: style → numeric → color

### 17.6 Ecosystem components

| Component | Description | Priority |
|-----------|-------------|----------|
| `cello` (npm) | Core library: parse, evaluate, render, serialize | v1 |
| `cello-cli` | CLI tool: `cello render file.cel > out.html` | v1 |
| `cello-playground` | Web playground: split-view editor + live preview | v1 |
| `cello-python` | Python port of parser + renderer | v2 |
| `cello-vscode` | VSCode extension with live preview | v2 |
| `cello-react` | React component wrapper | v2 |

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