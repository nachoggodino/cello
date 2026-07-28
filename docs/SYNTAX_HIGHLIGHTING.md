# Cello Syntax Highlighting

Cello ships a TextMate grammar as the portable syntax-highlighting standard for `.cel` files:

- Grammar: [`packages/language-support/syntaxes/cel.tmLanguage.json`](../packages/language-support/syntaxes/cel.tmLanguage.json)
- Editor configuration: [`packages/language-support/syntaxes/cel.language-configuration.json`](../packages/language-support/syntaxes/cel.language-configuration.json)
- Language id: `cel`
- File extension: `.cel`
- Root scope: `source.cel`

TextMate grammars are supported directly by VS Code and can be consumed by Shiki, GitHub Linguist-derived tooling, Monaco bridges, and many other editor integrations.

## VS Code Contribution

The reusable source files above can be copied or vendored into an editor integration. A packaged VS Code extension should contribute the copied files from its extension output. The Cello VS Code extension copies them to `dist/syntaxes`, so its contribution block uses:

```json
{
  "contributes": {
    "languages": [
      {
        "id": "cel",
        "aliases": ["Cello", "cel"],
        "extensions": [".cel"],
        "configuration": "./dist/syntaxes/cel.language-configuration.json"
      }
    ],
    "grammars": [
      {
        "language": "cel",
        "scopeName": "source.cel",
        "path": "./dist/syntaxes/cel.tmLanguage.json"
      }
    ]
  }
}
```

## Scope Map

| Cello construct | Primary scope |
|---|---|
| `@sheet` | `keyword.control.sheet.cel` |
| Sheet name | `entity.name.section.sheet.cel` |
| Sheet format | `support.constant.format.cel` |
| Alias directive `@tone`, `@width`, `@height` | `keyword.control.alias.cel` |
| `@header` | `keyword.control.header.cel` |
| `@defaults` | `keyword.control.defaults.cel` |
| External source `->` | `keyword.operator.source.cel` |
| External path | `string.unquoted.path.cel` |
| Comment line | `comment.line.double-slash.cel` |
| Cell separator `|` | `punctuation.separator.cell.cel` |
| Formula cell | `meta.formula.cel` |
| Formula function | `support.function.formula.cel` |
| Sheet reference | `variable.other.sheet-reference.cel` |
| Cell reference | `constant.other.cell-reference.cel` |
| Range slice | `constant.other.range.cel` |
| Merge token `<` or `^` | `keyword.operator.merge.cel` |
| Modifier block | `meta.modifier.cel` |
| Tone modifier | `support.constant.tone.cel` |
| Layout modifier | `support.type.layout.cel` |
| Color literal | `constant.other.color.rgb-value.cel` |
| Forced text string | `string.quoted.double.cel` |
| ISO date | `constant.other.date.iso.cel` |
| Boolean | `constant.language.boolean.cel` |
| Number | `constant.numeric.cel` |
| Inline heading | `markup.heading.*.cel` |
| Inline bold/italic/strike | `markup.bold.cel`, `markup.italic.cel`, `markup.strikethrough.cel` |

## Recommended Theme Treatment

Themes that want a distinctive Cello look can add these VS Code `tokenColors`. The palette is warm and spreadsheet-like: amber for workbook structure, blue for modifiers, green for references, and rose for formula operators/errors.

```json
[
  { "scope": "keyword.control.sheet.cel, keyword.control.header.cel, keyword.control.defaults.cel", "settings": { "foreground": "#D97706", "fontStyle": "bold" } },
  { "scope": "entity.name.section.sheet.cel", "settings": { "foreground": "#0F766E", "fontStyle": "bold" } },
  { "scope": "support.constant.format.cel", "settings": { "foreground": "#2563EB" } },
  { "scope": "meta.formula.cel", "settings": { "foreground": "#BE123C" } },
  { "scope": "support.function.formula.cel", "settings": { "foreground": "#9333EA", "fontStyle": "bold" } },
  { "scope": "variable.other.sheet-reference.cel, variable.other.identifier.cel", "settings": { "foreground": "#15803D" } },
  { "scope": "meta.modifier.cel, support.constant.tone.cel", "settings": { "foreground": "#0284C7" } },
  { "scope": "punctuation.separator.cell.cel", "settings": { "foreground": "#94A3B8" } },
  { "scope": "keyword.operator.merge.cel", "settings": { "foreground": "#EA580C", "fontStyle": "bold" } },
  { "scope": "comment.line.double-slash.cel", "settings": { "foreground": "#78716C", "fontStyle": "italic" } }
]
```

## Design Notes

The grammar highlights Cello's native syntax first and gracefully recognizes useful tokens in imported CSV, TSV, Markdown, and JSON sheet bodies. TextMate grammars do not track full workbook parse state, so imported sheet contents are highlighted heuristically rather than by the active `@sheet [format]` declaration.

The grammar deliberately uses common TextMate parent scopes such as `keyword`, `entity.name.section`, `constant.numeric`, `string.quoted.double`, and `markup.*` so existing themes look good without Cello-specific theme rules. The `.cel` suffix on every specific scope lets dedicated themes add richer treatment.
