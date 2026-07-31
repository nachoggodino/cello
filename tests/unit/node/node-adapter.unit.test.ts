import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createNodeExternalSourceOptions } from "../../../packages/core/src/node.js";

const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("createNodeExternalSourceOptions", () => {
  it("reads files within the configured real root", () => {
    const root = createRoot();
    const file = join(root, "rows.csv");
    writeFileSync(file, "A\n1\n");
    const adapter = createNodeExternalSourceOptions(root);

    expect(adapter.readExternalSource?.("rows.csv", { baseDir: adapter.baseDir ?? root, resolvedPath: file })).toBe("A\n1\n");
  });

  it("enforces the optional byte limit", () => {
    const root = createRoot();
    const file = join(root, "rows.csv");
    writeFileSync(file, "1234");
    const adapter = createNodeExternalSourceOptions(root, { maxBytes: 3 });

    expect(() => adapter.readExternalSource?.("rows.csv", { baseDir: root, resolvedPath: file })).toThrow("3-byte limit");
  });

  it("rejects traversal outside the configured root", () => {
    const parent = createRoot();
    const root = join(parent, "workbook");
    mkdirSync(root);
    const outside = join(parent, "outside.csv");
    writeFileSync(outside, "secret");
    const adapter = createNodeExternalSourceOptions(root);

    expect(() => adapter.readExternalSource?.("../outside.csv", { baseDir: root, resolvedPath: outside })).toThrow("outside the configured root");
  });

  it("rejects symlinks that escape the configured root", () => {
    const parent = createRoot();
    const root = join(parent, "workbook");
    mkdirSync(root);
    const outside = join(parent, "outside.csv");
    writeFileSync(outside, "secret");
    const link = join(root, "linked.csv");
    symlinkSync(outside, link);
    const adapter = createNodeExternalSourceOptions(root);

    expect(() => adapter.readExternalSource?.("linked.csv", { baseDir: root, resolvedPath: link })).toThrow("outside the configured root");
  });
});

function createRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "cello-node-adapter-"));
  temporaryRoots.push(root);
  return root;
}
