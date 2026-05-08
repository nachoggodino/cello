import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCliDeps, runCli, runMain } from "../src/cli.js";

const tempDirs: string[] = [];

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (!dir) {
      continue;
    }
    await rm(dir, { recursive: true, force: true });
  }
});

async function makeTempProject(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "cello-test-"));
  tempDirs.push(dir);
  return dir;
}

describe("cli", () => {
  it("prints usage and exits 1 when command/arg are missing", async () => {
    const stdout: string[] = [];
    const deps = createCliDeps({
      cwd: "C:\\",
      stdoutWrite: (text) => stdout.push(text)
    });

    const code = await runCli(["node", "cli"], deps);
    expect(code).toBe(1);
    expect(stdout.join("")).toContain("Usage:");
  });

  it("runs parse and prints AST json", async () => {
    const cwd = await makeTempProject();
    const file = join(cwd, "sample.cel");
    await writeFile(file, "@sheet S\n| A | 1 |", "utf8");

    const stdout: string[] = [];
    const deps = createCliDeps({
      cwd,
      stdoutWrite: (text) => stdout.push(text)
    });

    const code = await runCli(["node", "cli", "parse", "sample.cel"], deps);
    expect(code).toBe(0);

    const parsedOutput = JSON.parse(stdout.join(""));
    expect(parsedOutput.sheets[0].name).toBe("S");
  });

  it("runs render and writes html file", async () => {
    const cwd = await makeTempProject();
    await writeFile(join(cwd, "sample.cel"), "@sheet S\n| A | 1 |", "utf8");

    const stdout: string[] = [];
    const deps = createCliDeps({
      cwd,
      stdoutWrite: (text) => stdout.push(text)
    });

    const code = await runCli(["node", "cli", "render", "sample.cel", "-o", "out.html"], deps);
    expect(code).toBe(0);
    expect(stdout.join("")).toContain("Wrote");

    const html = await readFile(join(cwd, "out.html"), "utf8");
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("cello-workbook");
  });

  it("runs render and writes html to stdout when no -o is provided", async () => {
    const cwd = await makeTempProject();
    await writeFile(join(cwd, "sample.cel"), "@sheet S\n| A | 1 |", "utf8");

    const stdout: string[] = [];
    const deps = createCliDeps({
      cwd,
      stdoutWrite: (text) => stdout.push(text)
    });

    const code = await runCli(["node", "cli", "render", "sample.cel"], deps);
    expect(code).toBe(0);
    expect(stdout.join("")).toContain("<!doctype html>");
  });

  it("runs evaluate and prints evaluated AST json", async () => {
    const cwd = await makeTempProject();
    await writeFile(join(cwd, "sample.cel"), "@sheet S\n| 2 | 3 | =A1+B1 |", "utf8");

    const stdout: string[] = [];
    const deps = createCliDeps({
      cwd,
      stdoutWrite: (text) => stdout.push(text)
    });

    const code = await runCli(["node", "cli", "evaluate", "sample.cel"], deps);
    expect(code).toBe(0);

    const parsedOutput = JSON.parse(stdout.join(""));
    expect(parsedOutput.sheets[0].rows[0].cells[2].computed).toBe(5);
  });

  it("runs serialize and writes output file when -o is provided", async () => {
    const cwd = await makeTempProject();
    await writeFile(join(cwd, "sample.cel"), "@sheet S\n| A | 1 |", "utf8");

    const stdout: string[] = [];
    const deps = createCliDeps({
      cwd,
      stdoutWrite: (text) => stdout.push(text)
    });

    const code = await runCli(["node", "cli", "serialize", "sample.cel", "-o", "out.cel"], deps);
    expect(code).toBe(0);
    expect(stdout.join("")).toContain("Wrote");

    const out = await readFile(join(cwd, "out.cel"), "utf8");
    expect(out).toContain("@sheet S");
  });

  it("runs serialize and prints output to stdout when no -o is provided", async () => {
    const cwd = await makeTempProject();
    await writeFile(join(cwd, "sample.cel"), "@sheet S\n| A | 1 |", "utf8");

    const stdout: string[] = [];
    const deps = createCliDeps({
      cwd,
      stdoutWrite: (text) => stdout.push(text)
    });

    const code = await runCli(["node", "cli", "serialize", "sample.cel"], deps);
    expect(code).toBe(0);
    expect(stdout.join("")).toContain("@sheet S");
  });

  it("returns 1 for unknown command", async () => {
    const cwd = await makeTempProject();
    await writeFile(join(cwd, "sample.cel"), "@sheet S\n| A | 1 |", "utf8");

    const stdout: string[] = [];
    const deps = createCliDeps({
      cwd,
      stdoutWrite: (text) => stdout.push(text)
    });

    const code = await runCli(["node", "cli", "unknown", "sample.cel"], deps);
    expect(code).toBe(1);
    expect(stdout.join("")).toContain("Usage:");
  });

  it("runMain exits with CLI return code on success", async () => {
    const exitSpy = vi.fn();
    const runCliFn = vi.fn(async () => 0);
    const stderrSpy = vi.fn();

    await runMain(["node", "cli"], createCliDeps(), exitSpy, runCliFn, stderrSpy);

    expect(runCliFn).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(0);
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it("runMain writes error and exits 1 on failure", async () => {
    const exitSpy = vi.fn();
    const runCliFn = vi.fn(async () => {
      throw new Error("kaboom");
    });
    const stderrSpy = vi.fn();

    await runMain(["node", "cli"], createCliDeps(), exitSpy, runCliFn, stderrSpy);

    expect(stderrSpy).toHaveBeenCalled();
    expect(stderrSpy.mock.calls[0][0]).toContain("kaboom");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
