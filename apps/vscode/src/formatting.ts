import { formatSource } from "@nachoggodino/cello";
import * as vscode from "vscode";

const CEL_SELECTOR: vscode.DocumentSelector = { language: "cel", scheme: "*" };

export function registerFormatting(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider(CEL_SELECTOR, {
      provideDocumentFormattingEdits(document) {
        return buildFormattingEdits(document);
      }
    }),
    vscode.commands.registerCommand("cello.formatDocument", async (uri?: vscode.Uri) => {
      await formatDocument(uri);
    })
  );
}

export function buildFormattingEdits(document: Pick<vscode.TextDocument, "getText" | "positionAt">): vscode.TextEdit[] {
  const source = document.getText();
  const formatted = formatSource(source, { layout: "pretty" });
  if (formatted === source) {
    return [];
  }

  const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(source.length));
  return [vscode.TextEdit.replace(fullRange, formatted)];
}

async function formatDocument(uri: vscode.Uri | undefined): Promise<void> {
  const document = await resolveFormatDocument(uri);
  if (!document || document.languageId !== "cel") {
    void vscode.window.showWarningMessage("Open a .cel file before formatting with Cello.");
    return;
  }

  const edits = buildFormattingEdits(document);
  if (edits.length === 0) {
    return;
  }

  const workspaceEdit = new vscode.WorkspaceEdit();
  for (const edit of edits) {
    workspaceEdit.replace(document.uri, edit.range, edit.newText);
  }
  await vscode.workspace.applyEdit(workspaceEdit);
}

async function resolveFormatDocument(uri: vscode.Uri | undefined): Promise<vscode.TextDocument | undefined> {
  if (uri) {
    return vscode.workspace.openTextDocument(uri);
  }
  return vscode.window.activeTextEditor?.document;
}
