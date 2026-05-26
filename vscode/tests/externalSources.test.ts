import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createExternalSourceResolver, getPreviewBaseDir, isPathInside } from "../src/externalSources.js";

const tempRoot = join(tmpdir(), `cello-vscode-${process.pid}`);

beforeEach(() => {
  rmSync(tempRoot, { recursive: true, force: true });
  mkdirSync(tempRoot, { recursive: true });
});

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("external source resolution", () => {
  it("uses the containing workspace folder as the preview base", () => {
    const workspaceRoot = join(tempRoot, "workspace");
    const nestedRoot = join(workspaceRoot, "nested");
    const documentPath = join(nestedRoot, "report.cel");

    const baseDir = getPreviewBaseDir({
      documentUri: { scheme: "file", fsPath: documentPath },
      workspaceFolders: [{ uri: { fsPath: workspaceRoot } }, { uri: { fsPath: nestedRoot } }]
    });

    expect(baseDir).toBe(nestedRoot);
  });

  it("falls back to the document directory outside a workspace", () => {
    const documentPath = join(tempRoot, "loose", "report.cel");

    expect(
      getPreviewBaseDir({
        documentUri: { scheme: "file", fsPath: documentPath },
        workspaceFolders: undefined
      })
    ).toBe(join(tempRoot, "loose"));
  });

  it("reads workspace-relative external files", () => {
    const workspaceRoot = join(tempRoot, "workspace");
    const dataPath = join(workspaceRoot, "data", "sales.csv");
    mkdirSync(join(workspaceRoot, "data"), { recursive: true });
    writeFileSync(dataPath, "Name,Amount\nAda,10\n", "utf8");

    const resolver = createExternalSourceResolver({
      documentUri: { scheme: "file", fsPath: join(workspaceRoot, "reports", "report.cel") },
      workspaceFolders: [{ uri: { fsPath: workspaceRoot } }]
    });

    expect(
      resolver.readExternalSource("./data/sales.csv", {
        baseDir: resolver.baseDir,
        resolvedPath: resolve(resolver.baseDir, "./data/sales.csv")
      })
    ).toBe("Name,Amount\nAda,10\n");
  });

  it("rejects external files outside the preview base", () => {
    const workspaceRoot = join(tempRoot, "workspace");
    const resolver = createExternalSourceResolver({
      documentUri: { scheme: "file", fsPath: join(workspaceRoot, "report.cel") },
      workspaceFolders: [{ uri: { fsPath: workspaceRoot } }]
    });

    expect(() =>
      resolver.readExternalSource("../secret.csv", {
        baseDir: resolver.baseDir,
        resolvedPath: resolve(resolver.baseDir, "../secret.csv")
      })
    ).toThrow("outside the Cello preview root");
  });

  it("detects containment without accepting sibling path prefixes", () => {
    expect(isPathInside(join(tempRoot, "rooted", "file.csv"), join(tempRoot, "root"))).toBe(false);
    expect(isPathInside(join(tempRoot, "root", "file.csv"), join(tempRoot, "root"))).toBe(true);
  });
});
