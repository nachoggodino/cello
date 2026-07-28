import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { startServe, type ServeHandle } from "../../../packages/cli/src/serve.js";

const tempDirs: string[] = [];
const handles: ServeHandle[] = [];

afterEach(async () => {
  while (handles.length > 0) {
    await handles.pop()?.close();
  }
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      await rm(dir, { recursive: true, force: true });
    }
  }
});

async function makeFile(source: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "cello-serve-"));
  tempDirs.push(dir);
  const file = join(dir, "sample.cel");
  await writeFile(file, source, "utf8");
  return file;
}

describe("serve", () => {
  it("serves rendered html from a local url", async () => {
    const file = await makeFile("@sheet S\n| A | 1 |");
    const handle = await startServe(file, { port: 0 });
    handles.push(handle);

    const response = await fetch(handle.url);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(handle.url).toMatch(/\/sample\.cel$/);
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("cello-workbook");
    expect(html).toContain("/__cello/version");
  });

  it("can serve formulas without evaluation", async () => {
    const file = await makeFile("@sheet S\n| 1 | 2 | =A1+B1 |");
    const handle = await startServe(file, { port: 0, evaluate: false });
    handles.push(handle);

    const response = await fetch(handle.url);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('<span class="cello-cell-content">=A1+B1</span>');
    expect(html).not.toContain('<span class="cello-cell-content">3</span>');
  });

  it("returns 404 for non-workbook routes", async () => {
    const file = await makeFile("@sheet S\n| A |");
    const handle = await startServe(file, { port: 0 });
    handles.push(handle);

    const response = await fetch(new URL("/missing", handle.url));

    expect(response.status).toBe(404);
  });

  it("updates the served html after file changes", async () => {
    const file = await makeFile("@sheet S\n| Before |");
    const handle = await startServe(file, { port: 0 });
    handles.push(handle);
    const firstVersion = await readVersion(handle.url);

    await writeFile(file, "@sheet S\n| After |", "utf8");
    await waitForVersionChange(handle.url, firstVersion);
    const response = await fetch(handle.url);
    const html = await response.text();

    expect(html).toContain("After");
    expect(html).not.toContain("Before");
  });
});

async function readVersion(url: string): Promise<number> {
  const versionUrl = new URL("/__cello/version", url);
  const response = await fetch(versionUrl);
  const payload = (await response.json()) as { version: number };
  return payload.version;
}

async function waitForVersionChange(url: string, previous: number): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < 2000) {
    if ((await readVersion(url)) !== previous) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("Timed out waiting for live-reload version change.");
}
