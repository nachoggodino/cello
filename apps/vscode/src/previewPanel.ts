import { dirname, resolve } from "node:path";
import type { TextDocument, WebviewPanel } from "vscode";
import * as vscode from "vscode";
import { getPreviewBaseDir, isPathInside } from "./externalSources.js";
import { injectPreviewFavicon, renderDocumentPreview, renderErrorDocument } from "./previewHtml.js";

export class CelloPreviewPanel {
  private readonly disposables: vscode.Disposable[] = [];
  private dependencyDisposables: vscode.Disposable[] = [];
  private refreshTimer: NodeJS.Timeout | undefined;
  private refreshGeneration = 0;
  private disposed = false;

  public constructor(
    private readonly panel: WebviewPanel,
    private readonly document: TextDocument,
    private readonly extensionUri: vscode.Uri,
    private readonly onDispose: () => void
  ) {
    this.panel.onDidDispose(
      () => {
        this.dispose();
      },
      undefined,
      this.disposables
    );
    vscode.workspace.onDidChangeTextDocument(
      (event) => {
        if (event.document.uri.toString() === this.document.uri.toString()) {
          this.rebuildDependencyWatchers();
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
    this.rebuildDependencyWatchers();
  }

  public async reveal(viewColumn: vscode.ViewColumn): Promise<void> {
    this.panel.reveal(viewColumn);
    await this.refresh();
  }

  public async refresh(): Promise<void> {
    const generation = ++this.refreshGeneration;
    try {
      const html = await renderDocumentPreview(this.document, vscode.workspace.workspaceFolders);
      if (this.disposed || generation !== this.refreshGeneration) {
        return;
      }
      const faviconUri = this.panel.webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", "icon-circle.svg")).toString();
      this.panel.webview.html = injectPreviewFavicon(html, faviconUri);
      this.panel.title = `Preview ${this.document.fileName.split(/[\\/]/).pop() ?? "Cello"}`;
    } catch (error) {
      if (this.disposed || generation !== this.refreshGeneration) {
        return;
      }
      this.panel.webview.html = renderErrorDocument(error);
    }
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.refreshGeneration += 1;
    this.disposeDependencyWatchers();
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = undefined;
    }
    while (this.disposables.length > 0) {
      this.disposables.pop()?.dispose();
    }
    this.onDispose();
  }

  private rebuildDependencyWatchers(): void {
    this.disposeDependencyWatchers();
    let baseDir: string;
    try {
      baseDir = getPreviewBaseDir({
        documentUri: this.document.uri,
        workspaceFolders: vscode.workspace.workspaceFolders
      });
    } catch {
      return;
    }

    const paths = Array.from(this.document.getText().matchAll(/^\s*->\s+(.+?)\s*$/gm), (match) => match[1]).filter(
      (path): path is string => path !== undefined && !/^[a-z][a-z\d+.-]*:\/\//i.test(path)
    );
    const candidates = new Set(paths.map((path) => resolve(baseDir, path)).filter((path) => isPathInside(path, baseDir)));

    for (const candidate of candidates) {
      const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(vscode.Uri.file(dirname(candidate)), "*"));
      const refreshTarget = (uri: vscode.Uri) => {
        if (resolve(uri.fsPath) === candidate) {
          this.scheduleRefresh(0);
        }
      };
      this.dependencyDisposables.push(watcher, watcher.onDidCreate(refreshTarget), watcher.onDidChange(refreshTarget), watcher.onDidDelete(refreshTarget));
    }
  }

  private disposeDependencyWatchers(): void {
    for (const disposable of this.dependencyDisposables.splice(0)) {
      disposable.dispose();
    }
  }

  private scheduleRefresh(delayMs = getDebounceMs()): void {
    this.refreshGeneration += 1;
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = undefined;
      void this.refresh();
    }, delayMs);
  }
}

export function createPreviewPanel(document: TextDocument, viewColumn: vscode.ViewColumn, extensionUri: vscode.Uri, onDispose: () => void): CelloPreviewPanel {
  const panel = vscode.window.createWebviewPanel("celloPreview", `Preview ${document.fileName.split(/[\\/]/).pop() ?? "Cello"}`, viewColumn, {
    enableScripts: true,
    retainContextWhenHidden: true
  });
  panel.iconPath = vscode.Uri.joinPath(extensionUri, "media", "icon-circle.svg");
  return new CelloPreviewPanel(panel, document, extensionUri, onDispose);
}

function getDebounceMs(): number {
  return vscode.workspace.getConfiguration("cello.preview").get("debounceMs", 250);
}
