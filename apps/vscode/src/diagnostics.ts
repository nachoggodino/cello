import type { Diagnostic as CelloDiagnostic } from "@nachoggodino/cello";
import { parse } from "@nachoggodino/cello";
import type { ExtensionContext, TextDocument } from "vscode";
import * as vscode from "vscode";
import { createExternalSourceResolver } from "./externalSources.js";

const diagnosticSource = "Cello";

export function registerDiagnostics(context: ExtensionContext): void {
  const collection = vscode.languages.createDiagnosticCollection("cello");

  const refresh = (document: TextDocument): void => {
    if (document.languageId !== "cel") {
      return;
    }
    collection.set(document.uri, collectDiagnostics(document));
  };

  for (const document of vscode.workspace.textDocuments) {
    refresh(document);
  }

  context.subscriptions.push(
    collection,
    vscode.workspace.onDidOpenTextDocument(refresh),
    vscode.workspace.onDidChangeTextDocument((event) => {
      refresh(event.document);
    }),
    vscode.workspace.onDidCloseTextDocument((document) => {
      collection.delete(document.uri);
    })
  );
}

function collectDiagnostics(document: TextDocument): vscode.Diagnostic[] {
  let diagnostics: CelloDiagnostic[];
  try {
    const externalSources = createExternalSourceResolver({
      documentUri: document.uri,
      workspaceFolders: vscode.workspace.workspaceFolders
    });
    diagnostics = parse(document.getText(), externalSources).diagnostics;
  } catch {
    diagnostics = parse(document.getText()).diagnostics;
  }

  return diagnostics.map((diagnostic) => toVsCodeDiagnostic(document, diagnostic));
}

function toVsCodeDiagnostic(document: TextDocument, diagnostic: CelloDiagnostic): vscode.Diagnostic {
  const lineIndex = Math.min(Math.max((diagnostic.line ?? 1) - 1, 0), Math.max(document.lineCount - 1, 0));
  const line = document.lineAt(lineIndex);
  const start = new vscode.Position(lineIndex, 0);
  const end = line.text.length > 0 ? new vscode.Position(lineIndex, line.text.length) : start;
  const output = new vscode.Diagnostic(
    new vscode.Range(start, end),
    diagnostic.message,
    diagnostic.severity === "error" ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning
  );
  output.source = diagnosticSource;
  return output;
}
