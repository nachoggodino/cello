import { render } from "@nachoggodino/cello";
import type { TextDocument } from "vscode";
import type { ExternalSourceContext } from "./externalSources.js";
import { createExternalSourceResolver } from "./externalSources.js";

export async function renderDocumentPreview(
  document: Pick<TextDocument, "getText" | "uri" | "fileName">,
  workspaceFolders: ExternalSourceContext["workspaceFolders"]
): Promise<string> {
  const externalSources = createExternalSourceResolver({
    documentUri: document.uri,
    workspaceFolders
  });

  const html = await render(document.getText(), {
    baseDir: externalSources.baseDir,
    readExternalSource: externalSources.readExternalSource,
    interactive: true,
    title: `Cello Preview: ${document.fileName}`
  });

  return injectPreviewHostStyles(html);
}

export function injectPreviewHostStyles(html: string): string {
  const style = `<style>
    html, body {
      background: var(--vscode-editor-background, #ffffff);
      color: var(--vscode-editor-foreground, #111827);
    }
    body {
      margin: 0;
      padding: 16px;
      box-sizing: border-box;
    }
    .cello-workbook {
      color: var(--vscode-editor-foreground, #111827);
    }
    .cello-sheet {
      overflow: auto;
      padding-bottom: 24px;
    }
    .cello-workbook table {
      background: var(--vscode-editor-background, #ffffff);
    }
    .cello-workbook th:not([class]):not([style]),
    .cello-workbook td:not([class]):not([style]) {
      color: var(--vscode-editor-foreground, #111827);
      background: var(--vscode-editor-background, #ffffff);
    }
    .cello-workbook th,
    .cello-workbook td {
      border-color: var(--vscode-panel-border, #d1d5db);
    }
    .cello-workbook th:not([class]):not([style]),
    .cello-workbook .cello-corner-index,
    .cello-workbook .cello-column-index,
    .cello-workbook .cello-row-index {
      color: var(--vscode-sideBar-foreground, var(--vscode-editor-foreground, #111827));
      background: var(--vscode-sideBar-background, #f3f4f6);
    }
    .cello-tabs {
      position: sticky;
      top: 0;
      z-index: 1;
      padding-bottom: 12px;
      background: var(--vscode-editor-background, #ffffff);
    }
    .cello-tab {
      color: var(--vscode-button-secondaryForeground, var(--vscode-editor-foreground, #111827));
      background: var(--vscode-button-secondaryBackground, #ffffff);
      border-color: var(--vscode-button-border, var(--vscode-panel-border, #d1d5db));
    }
    .cello-tab.active {
      color: var(--vscode-button-foreground, #ffffff);
      background: var(--vscode-button-background, #111827);
      border-color: var(--vscode-button-background, #111827);
    }
    .cello-workbook .cello-tone-ok { color: var(--cello-tone-ok-color) !important; background: var(--cello-tone-ok-background) !important; }
    .cello-workbook .cello-tone-warn { color: var(--cello-tone-warn-color) !important; background: var(--cello-tone-warn-background) !important; }
    .cello-workbook .cello-tone-error { color: var(--cello-tone-error-color) !important; background: var(--cello-tone-error-background) !important; }
    .cello-workbook .cello-tone-info { color: var(--cello-tone-info-color) !important; background: var(--cello-tone-info-background) !important; }
    .cello-workbook .cello-tone-muted { color: var(--cello-tone-muted-color) !important; background: var(--cello-tone-muted-background) !important; }
    .cello-workbook .cello-tone-accent { color: var(--cello-tone-accent-color) !important; background: var(--cello-tone-accent-background) !important; }
  </style>`;

  return html.replace("</head>", `  ${style}\n</head>`);
}

export function injectPreviewFavicon(html: string, faviconUri: string): string {
  const link = `<link rel="icon" type="image/svg+xml" href="${escapeHtml(faviconUri)}" />`;
  return html.replace("</head>", `  ${link}\n</head>`);
}

export function renderErrorDocument(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Cello Preview Error</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 24px; color: #1f2937; }
    pre { white-space: pre-wrap; border: 1px solid #fecaca; background: #fff1f2; color: #991b1b; padding: 12px; border-radius: 6px; }
  </style>
</head>
<body>
  <h1>Cello preview failed</h1>
  <pre>${escapeHtml(message)}</pre>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
