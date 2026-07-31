import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as vscode from "vscode";

const extensionId = "nachoggodino.cello-vscode";

export async function run(): Promise<void> {
  const workspace = vscode.workspace.workspaceFolders?.[0];
  assert.ok(workspace, "The controlled extension-host workspace must be open.");

  const reportUri = vscode.Uri.joinPath(workspace.uri, "report.cel");
  const report = await vscode.workspace.openTextDocument(reportUri);
  const editor = await vscode.window.showTextDocument(report);
  const extension = vscode.extensions.getExtension(extensionId);
  assert.ok(extension, `Expected extension ${extensionId} to be installed.`);
  await extension.activate();

  await runActivationCase(extension, report);
  await runDiagnosticsCase(editor, report);
  await runFormattingCase(editor, report);
  await runPreviewCase(report, reportUri);
  await runExternalSourceCase(workspace);
  await runSymlinkDenialCase(workspace);
}

async function runActivationCase(extension: vscode.Extension<unknown>, report: vscode.TextDocument): Promise<void> {
  await runCase("activates and registers the Cello language", async () => {
    assert.equal(extension.isActive, true);
    assert.equal(report.languageId, "cel");
    assert.ok((await vscode.languages.getLanguages()).includes("cel"));
  });
}

async function runDiagnosticsCase(editor: vscode.TextEditor, report: vscode.TextDocument): Promise<void> {
  await runCase("publishes and clears live parser diagnostics", async () => {
    const original = report.getText();
    const applied = await editor.edit((builder) => {
      builder.replace(fullDocumentRange(report), "@sheet Report\nthis is not a row\n| Valid |");
    });
    assert.equal(applied, true);

    await waitFor(() => vscode.languages.getDiagnostics(report.uri).length === 1);
    const [diagnostic] = vscode.languages.getDiagnostics(report.uri);
    assert.ok(diagnostic);
    assert.equal(diagnostic.severity, vscode.DiagnosticSeverity.Warning);
    assert.equal(diagnostic.range.start.line, 1);
    assert.equal(diagnostic.source, "Cello");
    assert.match(diagnostic.message, /Skipped non-row line/);

    await editor.edit((builder) => {
      builder.replace(fullDocumentRange(report), original);
    });
    await waitFor(() => vscode.languages.getDiagnostics(report.uri).length === 0);
  });
}

async function runFormattingCase(editor: vscode.TextEditor, report: vscode.TextDocument): Promise<void> {
  await runCase("formats a live Cello document through the registered provider", async () => {
    const original = report.getText();
    const applied = await editor.edit((builder) => {
      builder.replace(fullDocumentRange(report), "@sheet Report\n| A | Longer |\n| 1 | 2 |");
    });
    assert.equal(applied, true);

    await vscode.commands.executeCommand("editor.action.formatDocument");
    assert.equal(report.getText(), "@sheet Report\n| A | Longer |\n| 1 | 2      |");

    await editor.edit((builder) => {
      builder.replace(fullDocumentRange(report), original);
    });
  });
}

async function runPreviewCase(report: vscode.TextDocument, reportUri: vscode.Uri): Promise<void> {
  await runCase("opens, refreshes, reveals, and closes a preview panel", async () => {
    await vscode.commands.executeCommand("cello.openPreview");
    await waitFor(() => findPreviewTab("Preview report.cel") !== undefined);
    await vscode.commands.executeCommand("cello.openPreviewToSide", reportUri);
    assert.ok(findPreviewTab("Preview report.cel"));

    const workspaceEdit = new vscode.WorkspaceEdit();
    workspaceEdit.insert(report.uri, report.positionAt(report.getText().length), "\n| Refreshed | 9 |");
    assert.equal(await vscode.workspace.applyEdit(workspaceEdit), true);

    await delay(400);
    assert.ok(findPreviewTab("Preview report.cel"));
    await closeTab(findPreviewTab("Preview report.cel"));
  });
}

async function runExternalSourceCase(workspace: vscode.WorkspaceFolder): Promise<void> {
  await runCase("handles external refresh and traversal denial in a controlled workspace", async () => {
    const externalUri = vscode.Uri.joinPath(workspace.uri, "external.cel");
    await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(externalUri));
    await vscode.commands.executeCommand("cello.openPreview");
    await waitFor(() => findPreviewTab("Preview external.cel") !== undefined);

    const dependencyUri = vscode.Uri.joinPath(workspace.uri, "data", "imported.cel");
    const originalDependency = await vscode.workspace.fs.readFile(dependencyUri);
    await vscode.workspace.fs.writeFile(dependencyUri, new TextEncoder().encode("@sheet Imported\n| Updated |"));
    await delay(400);
    assert.ok(findPreviewTab("Preview external.cel"));
    await vscode.workspace.fs.writeFile(dependencyUri, originalDependency);
    await closeTab(findPreviewTab("Preview external.cel"));

    const traversalUri = vscode.Uri.joinPath(workspace.uri, "traversal.cel");
    await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(traversalUri));
    await vscode.commands.executeCommand("cello.openPreview");
    await waitFor(() => findPreviewTab("Preview traversal.cel") !== undefined);
    assert.ok(findPreviewTab("Preview traversal.cel"), "Traversal input must fail inside the preview instead of crashing the host.");
    await closeTab(findPreviewTab("Preview traversal.cel"));
  });
}

async function runSymlinkDenialCase(workspace: vscode.WorkspaceFolder): Promise<void> {
  await runCase("denies an external source reached through a workspace symlink", async () => {
    const outsideDirectory = mkdtempSync(join(tmpdir(), "cello-vscode-host-"));
    const outsideSource = join(outsideDirectory, "outside.csv");
    const linkUri = vscode.Uri.joinPath(workspace.uri, "data", "outside-link.csv");
    try {
      writeFileSync(outsideSource, "name,value\noutside,1\n");
      symlinkSync(outsideSource, linkUri.fsPath);

      const documentUri = vscode.Uri.joinPath(workspace.uri, "symlink.cel");
      const document = await vscode.workspace.openTextDocument(documentUri);
      await vscode.window.showTextDocument(document);
      await waitFor(() =>
        vscode.languages.getDiagnostics(document.uri).some((diagnostic) => diagnostic.severity === vscode.DiagnosticSeverity.Error && diagnostic.message.includes("outside"))
      );
      await vscode.commands.executeCommand("cello.openPreview");
      await waitFor(() => findPreviewTab("Preview symlink.cel") !== undefined);
      await closeTab(findPreviewTab("Preview symlink.cel"));
    } finally {
      if (existsSync(linkUri.fsPath)) {
        unlinkSync(linkUri.fsPath);
      }
      rmSync(outsideDirectory, { recursive: true, force: true });
    }
  });
}

async function runCase(name: string, testCase: () => Promise<void>): Promise<void> {
  process.stdout.write(`  extension host: ${name} ... `);
  await testCase();
  process.stdout.write("passed\n");
}

function fullDocumentRange(document: vscode.TextDocument): vscode.Range {
  return new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length));
}

function findPreviewTab(label: string): vscode.Tab | undefined {
  return vscode.window.tabGroups.all.flatMap((group) => group.tabs).find((tab) => tab.label === label);
}

async function closeTab(tab: vscode.Tab | undefined): Promise<void> {
  if (tab) {
    await vscode.window.tabGroups.close(tab);
  }
}

async function waitFor(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) {
      throw new Error("Timed out waiting for the extension host.");
    }
    await delay(25);
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, milliseconds);
  });
}
