# Cello

Cello brings first-class `.cel` workbook support to Visual Studio Code: syntax highlighting, document formatting, file icons, and live HTML previews for plain-text spreadsheets.

Cello is a readable text format for spreadsheets with sheets, formulas, references, modifiers, merges, and rendered HTML output. This extension keeps the source file editable while showing the same workbook as an interactive preview beside it.

## Features

- Syntax highlighting for Cello sheet declarations, table rows, formulas, references, modifiers, comments, imported data, and inline formatting.
- Live rendered preview with sheet tabs, formulas, merges, colors, tones, defaults, and coordinate chrome.
- Side-by-side preview command for Markdown-style editing workflows.
- Dark and light theme-aware preview styling inside VS Code webviews.
- Document formatting through VS Code's standard **Format Document** command and **Cello: Format Document**.
- Workspace-relative external source support for imports such as `-> ./data/sales.csv`.
- `.cel` language registration and file icon association.

## Commands

- **Cello: Open Preview**
- **Cello: Open Preview to the Side**
- **Cello: Format Document**

You can also use VS Code's built-in **Format Document** command for `.cel` files.

## External Sources

Preview rendering supports workspace-relative external sources:

```cel
@sheet Sales [csv]
-> ./data/sales.csv
```

External files are resolved from the containing workspace folder. Reads outside that preview root are blocked.

## Settings

- `cello.preview.debounceMs`: delay before refreshing the live preview after edits. Default: `250`.

## Requirements

No separate Cello CLI installation is required. The extension bundles the published `@nachoggodino/cello` renderer for local previews.

## Learn More

- [Cello on GitHub](https://github.com/nachoggodino/cello)
- [Cello BYLAWS](https://github.com/nachoggodino/cello/blob/main/BYLAWS.md)
- [Cello Playground](https://playcello.app)
