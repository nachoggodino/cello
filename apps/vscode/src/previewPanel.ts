import type { TextDocument, WebviewPanel } from "vscode";
import * as vscode from "vscode";
import { injectPreviewFavicon, renderDocumentPreview, renderErrorDocument } from "./previewHtml.js";

export class CelloPreviewPanel {
  private readonly disposables: vscode.Disposable[] = [];
  private refreshTimer: NodeJS.Timeout | undefined;
  private disposed = false;

  public constructor(
    private readonly panel: WebviewPanel,
    private readonly document: TextDocument,
    private readonly extensionUri: vscode.Uri,
    private readonly onDispose: () => void
  ) {
    this.panel.onDidDispose(() => this.dispose(), undefined, this.disposables);
    vscode.workspace.onDidChangeTextDocument(
      (event) => {
        if (event.document.uri.toString() === this.document.uri.toString()) {
          this.scheduleRefresh();
        }
      },
      undefined,
      this.disposables
    );
    vscode.workspace.onDidSaveTextDocument(
      (savedDocument) => {
        if (savedDocument.uri.toString() === this.document.uri.toString()) {
          this.scheduleRefresh(0);
        }
      },
      undefined,
      this.disposables
    );
  }

  public async reveal(viewColumn: vscode.ViewColumn): Promise<void> {
    this.panel.reveal(viewColumn);
    await this.refresh();
  }

  public async refresh(): Promise<void> {
    try {
      const html = await renderDocumentPreview(this.document, vscode.workspace.workspaceFolders);
      const faviconUri = this.panel.webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", "icon-circle.svg")).toString();
      this.panel.webview.html = injectPreviewFavicon(html, faviconUri);
      this.panel.title = `Preview ${this.document.fileName.split(/[\\/]/).pop() ?? "Cello"}`;
    } catch (error) {
      this.panel.webview.html = renderErrorDocument(error);
    }
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = undefined;
    }
    while (this.disposables.length > 0) {
      this.disposables.pop()?.dispose();
    }
    this.onDispose();
  }

  private scheduleRefresh(delayMs = getDebounceMs()): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = undefined;
      void this.refresh();
    }, delayMs);
  }
}

export function createPreviewPanel(
  document: TextDocument,
  viewColumn: vscode.ViewColumn,
  extensionUri: vscode.Uri,
  onDispose: () => void
): CelloPreviewPanel {
  const panel = vscode.window.createWebviewPanel(
    "celloPreview",
    `Preview ${document.fileName.split(/[\\/]/).pop() ?? "Cello"}`,
    viewColumn,
    {
      enableScripts: true,
      retainContextWhenHidden: true
    }
  );
  panel.iconPath = vscode.Uri.joinPath(extensionUri, "media", "icon-circle.svg");
  return new CelloPreviewPanel(panel, document, extensionUri, onDispose);
}

function getDebounceMs(): number {
  return vscode.workspace.getConfiguration("cello.preview").get("debounceMs", 250);
}
