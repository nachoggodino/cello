import type { ExtensionContext, TextEditor } from "vscode";
import * as vscode from "vscode";
import { registerDiagnostics } from "./diagnostics.js";
import { registerFormatting } from "./formatting.js";
import { CelloPreviewPanel, createPreviewPanel } from "./previewPanel.js";

const previews = new Map<string, CelloPreviewPanel>();

export function activate(context: ExtensionContext): void {
  registerDiagnostics(context);
  registerFormatting(context);
  context.subscriptions.push(
    vscode.commands.registerCommand("cello.openPreview", async () => {
      await openPreview(vscode.window.activeTextEditor, vscode.ViewColumn.Active, context.extensionUri);
    }),
    vscode.commands.registerCommand("cello.openPreviewToSide", async (uri?: vscode.Uri) => {
      const editor = await resolveEditor(uri);
      await openPreview(editor, vscode.ViewColumn.Beside, context.extensionUri);
    }),
    new vscode.Disposable(() => {
      for (const preview of previews.values()) {
        preview.dispose();
      }
      previews.clear();
    })
  );
}

export function deactivate(): void {
  for (const preview of previews.values()) {
    preview.dispose();
  }
  previews.clear();
}

async function resolveEditor(uri: vscode.Uri | undefined): Promise<TextEditor | undefined> {
  if (!uri) {
    return vscode.window.activeTextEditor;
  }

  const document = await vscode.workspace.openTextDocument(uri);
  return vscode.window.showTextDocument(document, { preview: false, preserveFocus: true });
}

async function openPreview(editor: TextEditor | undefined, viewColumn: vscode.ViewColumn, extensionUri: vscode.Uri): Promise<void> {
  if (!editor || editor.document.languageId !== "cel") {
    void vscode.window.showWarningMessage("Open a .cel file before starting a Cello preview.");
    return;
  }

  const key = editor.document.uri.toString();
  let preview = previews.get(key);
  if (!preview) {
    preview = createPreviewPanel(editor.document, viewColumn, extensionUri, () => previews.delete(key));
    previews.set(key, preview);
  }

  await preview.reveal(viewColumn);
}
