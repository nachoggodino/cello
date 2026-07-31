import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import packageJson from "../../../package.json" with { type: "json" };
import { createCliDeps, isDirectCliExecution, runCli, runMain } from "../../../packages/cli/src/cli.js";
import { VERSION } from "../../../packages/core/src/version.js";

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

async function runCliCase(
  argv: string[],
  source = "@sheet S\n| A | 1 |"
): Promise<{ code: number; cwd: string; stdout: string; stderr: string }> {
  const cwd = await makeTempProject();
  await writeFile(join(cwd, "sample.cel"), source, "utf8");

  const stdout: string[] = [];
  const stderr: string[] = [];
  const deps = createCliDeps({
    cwd,
    stdoutWrite: (text) => stdout.push(text),
    stderrWrite: (text) => stderr.push(text)
  });

  const code = await runCli(argv, deps);
  return { code, cwd, stdout: stdout.join(""), stderr: stderr.join("") };
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

  it("returns 1 when -o is provided without an output file", async () => {
    const { code, stderr } = await runCliCase(["node", "cli", "render", "sample.cel", "-o"]);
    expect(code).toBe(1);
    expect(stderr).toContain("Missing output file after -o/--out.");
  });

  it("returns 1 when --format is provided without a value", async () => {
    const { code, stderr } = await runCliCase(["node", "cli", "render", "sample.cel", "--format"]);
    expect(code).toBe(1);
    expect(stderr).toContain("Missing value after --format.");
  });

  it("prints general help", async () => {
    const { code, stdout } = await runCliCase(["node", "cli", "help"]);
    expect(code).toBe(0);
    expect(stdout).toContain("cello help [command]");
    expect(stdout).toContain("cello version");
    expect(stdout).toContain("cello format <file.cel> [--check] [-o out.cel]");
    expect(stdout).toContain("cello render <file.cel> [-o out.html] [--no-eval] [--format document|fragment]");
    expect(stdout).toContain("cello serve <file.cel>");
  });

  it("prints the package version", async () => {
    const { code, stdout } = await runCliCase(["node", "cli", "--version"]);
    expect(code).toBe(0);
    expect(stdout).toBe(`${packageJson.version}\n`);
    expect(VERSION).toBe(packageJson.version);
  });

  it("prints command help", async () => {
    const { code, stdout } = await runCliCase(["node", "cli", "help", "serve"]);
    expect(code).toBe(0);
    expect(stdout).toContain("Usage: cello serve <file.cel>");
    expect(stdout).toContain("--open");
  });

  it("returns 1 for unknown help topics", async () => {
    const { code, stderr } = await runCliCase(["node", "cli", "help", "missing"]);
    expect(code).toBe(1);
    expect(stderr).toContain("Unknown help topic: missing");
  });

  it("rejects extra help arguments", async () => {
    const { code, stderr } = await runCliCase(["node", "cli", "help", "serve", "extra"]);
    expect(code).toBe(1);
    expect(stderr).toContain("Unexpected argument for help: extra");
  });

  it("rejects serve-only flags on other commands", async () => {
    const { code, stderr } = await runCliCase(["node", "cli", "render", "sample.cel", "--port", "9999"]);
    expect(code).toBe(1);
    expect(stderr).toContain("--host, --port, and --open are only supported by serve.");
  });

  it("rejects --no-eval outside render and serve", async () => {
    const { code, stderr } = await runCliCase(["node", "cli", "parse", "sample.cel", "--no-eval"]);
    expect(code).toBe(1);
    expect(stderr).toContain("--no-eval is only supported by render and serve.");
  });

  it("rejects --check outside format", async () => {
    const { code, stderr } = await runCliCase(["node", "cli", "parse", "sample.cel", "--check"]);
    expect(code).toBe(1);
    expect(stderr).toContain("--check is only supported by format.");
  });

  it("rejects unsupported options with a command-specific message", async () => {
    const { code, stderr } = await runCliCase(["node", "cli", "parse", "sample.cel", "--format", "json"]);
    expect(code).toBe(1);
    expect(stderr).toContain("Unsupported option for parse: --format");
  });

  it("rejects invalid render output formats", async () => {
    const { code, stderr } = await runCliCase(["node", "cli", "render", "sample.cel", "--format", "json"]);
    expect(code).toBe(1);
    expect(stderr).toContain("Invalid --format value. Expected document or fragment.");
  });

  it("rejects extra positional arguments", async () => {
    const { code, stderr } = await runCliCase(["node", "cli", "parse", "sample.cel", "extra.cel"]);
    expect(code).toBe(1);
    expect(stderr).toContain("Unexpected argument: extra.cel");
  });

  it("detects direct execution through a symlinked npm bin", async () => {
    const cwd = await makeTempProject();
    const target = join(cwd, "cli.js");
    const linkedBin = join(cwd, "cello");
    await writeFile(target, "", "utf8");
    await symlink(target, linkedBin);

    expect(isDirectCliExecution(linkedBin, pathToFileURL(target).href)).toBe(true);
  });

  for (const { name, argv, source, assert } of [
    {
      name: "runs parse and prints AST json",
      argv: ["node", "cli", "parse", "sample.cel"],
      source: "@sheet S\n| A | 1 |",
      assert: ({ code, stdout }: { code: number; stdout: string }) => {
        expect(code).toBe(0);
        expect(JSON.parse(stdout).sheets[0].name).toBe("S");
      }
    },
    {
      name: "runs validate and prints valid result json",
      argv: ["node", "cli", "validate", "sample.cel"],
      source: "@sheet S\n| A | 1 |",
      assert: ({ code, stdout }: { code: number; stdout: string }) => {
        expect(code).toBe(0);
        expect(JSON.parse(stdout)).toEqual({
          valid: true,
          diagnostics: []
        });
      }
    },
    {
      name: "runs validate and returns 1 when diagnostics exist",
      argv: ["node", "cli", "validate", "sample.cel"],
      source: "@sheet S\nnot a row\n| ok |",
      assert: ({ code, stdout }: { code: number; stdout: string }) => {
        expect(code).toBe(1);
        const result = JSON.parse(stdout) as { valid: boolean; diagnostics: Array<{ level: string; line?: number }> };
        expect(result.valid).toBe(false);
        expect(result.diagnostics).toContainEqual(expect.objectContaining({ level: "warning", line: 2 }));
      }
    },
    {
      name: "runs render and writes html file",
      argv: ["node", "cli", "render", "sample.cel", "-o", "out.html"],
      source: "@sheet S\n| A | 1 |",
      assert: async ({ code, cwd, stdout }: { code: number; cwd: string; stdout: string }) => {
        expect(code).toBe(0);
        expect(stdout).toContain("Wrote");
        const html = await readFile(join(cwd, "out.html"), "utf8");
        expect(html).toContain("<!doctype html>");
        expect(html).toContain("cello-workbook");
      }
    },
    {
      name: "runs render and writes html to stdout when no -o is provided",
      argv: ["node", "cli", "render", "sample.cel"],
      source: "@sheet S\n| A | 1 |",
      assert: ({ code, stdout }: { code: number; stdout: string }) => {
        expect(code).toBe(0);
        expect(stdout).toContain("<!doctype html>");
      }
    },
    {
      name: "runs render and writes fragment html to stdout",
      argv: ["node", "cli", "render", "sample.cel", "--format", "fragment"],
      source: "@sheet S\n| A | 1 |",
      assert: ({ code, stdout }: { code: number; stdout: string }) => {
        expect(code).toBe(0);
        expect(stdout).not.toContain("<!doctype html>");
        expect(stdout).not.toContain("<body>");
        expect(stdout).toContain('<div class="cello-workbook">');
        expect(stdout).toContain("<style>");
        expect(stdout).toContain("<script>");
      }
    },
    {
      name: "runs render and writes fragment html to output file",
      argv: ["node", "cli", "render", "sample.cel", "--format", "fragment", "-o", "fragment.html"],
      source: "@sheet S\n| A | 1 |",
      assert: async ({ code, cwd, stdout }: { code: number; cwd: string; stdout: string }) => {
        expect(code).toBe(0);
        expect(stdout).toContain("Wrote");
        const html = await readFile(join(cwd, "fragment.html"), "utf8");
        expect(html).not.toContain("<!doctype html>");
        expect(html).toContain("cello-workbook");
      }
    },
    {
      name: "runs render without evaluating formulas",
      argv: ["node", "cli", "render", "sample.cel", "--no-eval"],
      source: "@sheet S\n| 1 | 2 | =A1+B1 |",
      assert: ({ code, stdout }: { code: number; stdout: string }) => {
        expect(code).toBe(0);
        expect(stdout).toContain('<span class="cello-cell-content">=A1+B1</span>');
        expect(stdout).not.toContain('<span class="cello-cell-content">3</span>');
      }
    },
    {
      name: "runs evaluate and prints evaluated AST json",
      argv: ["node", "cli", "evaluate", "sample.cel"],
      source: "@sheet S\n| 2 | 3 | =A1+B1 |",
      assert: ({ code, stdout }: { code: number; stdout: string }) => {
        expect(code).toBe(0);
        expect(JSON.parse(stdout).sheets[0].rows[0].cells[2].computed).toBe(5);
      }
    },
    {
      name: "runs format in place by default",
      argv: ["node", "cli", "format", "sample.cel"],
      source: "@sheet S\n@header | A | B |\n| 1 | 22 |",
      assert: async ({ code, cwd, stdout }: { code: number; cwd: string; stdout: string }) => {
        expect(code).toBe(0);
        expect(stdout).toContain("Wrote");
        expect(await readFile(join(cwd, "sample.cel"), "utf8")).toBe("@sheet S\n@header | A | B  |\n        | 1 | 22 |");
      }
    },
    {
      name: "runs format and writes output file when -o is provided",
      argv: ["node", "cli", "format", "sample.cel", "-o", "out.cel"],
      source: "@sheet S\n| A | 1 |",
      assert: async ({ code, cwd, stdout }: { code: number; cwd: string; stdout: string }) => {
        expect(code).toBe(0);
        expect(stdout).toContain("Wrote");
        expect(await readFile(join(cwd, "out.cel"), "utf8")).toBe("@sheet S\n| A | 1 |");
        expect(await readFile(join(cwd, "sample.cel"), "utf8")).toBe("@sheet S\n| A | 1 |");
      }
    },
    {
      name: "runs format --check and reports drift",
      argv: ["node", "cli", "format", "sample.cel", "--check"],
      source: "@sheet S\n@header | A | B |\n| 1 | 22 |",
      assert: ({ code, stdout }: { code: number; stdout: string }) => {
        expect(code).toBe(1);
        expect(stdout).toContain("Needs formatting");
      }
    },
    {
      name: "runs format --check and reports already formatted files",
      argv: ["node", "cli", "format", "sample.cel", "--check"],
      source: "@sheet S\n@header | A | B  |\n        | 1 | 22 |",
      assert: ({ code, stdout }: { code: number; stdout: string }) => {
        expect(code).toBe(0);
        expect(stdout).toContain("Already formatted");
      }
    },
    {
      name: "rejects the removed serialize command",
      argv: ["node", "cli", "serialize", "sample.cel"],
      source: "@sheet S\n| A | 1 |",
      assert: ({ code, stderr }: { code: number; stderr: string }) => {
        expect(code).toBe(1);
        expect(stderr).toContain("Unknown command: serialize");
      }
    },
    {
      name: "returns 1 for unknown command",
      argv: ["node", "cli", "unknown", "sample.cel"],
      source: "@sheet S\n| A | 1 |",
      assert: ({ code, stderr }: { code: number; stderr: string }) => {
        expect(code).toBe(1);
        expect(stderr).toContain("Unknown command: unknown");
      }
    }
  ]) {
    it(name, async () => {
      await assert(await runCliCase(argv, source));
    });
  }

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

  it("starts serve, prints the local url, and passes options", async () => {
    const cwd = await makeTempProject();
    await writeFile(join(cwd, "sample.cel"), "@sheet S\n| =1+1 |", "utf8");
    const stdout: string[] = [];
    const readFileFn = vi.fn(async () => {
      throw new Error("serve should not pre-read the input file");
    }) as unknown as typeof readFile;
    const startServeFn = vi.fn(async () => ({
      url: "http://127.0.0.1:9999/",
      server: {} as never,
      watcher: {} as never,
      close: async () => undefined
    }));
    const stayOpenFn = vi.fn(async () => 0);
    const deps = createCliDeps({
      cwd,
      readFileFn,
      stdoutWrite: (text) => stdout.push(text),
      startServeFn,
      stayOpenFn
    });

    const code = await runCli(
      ["node", "cli", "serve", "sample.cel", "--port", "9999", "--host", "127.0.0.1", "--open", "--no-eval"],
      deps
    );

    expect(code).toBe(0);
    expect(startServeFn).toHaveBeenCalledWith(join(cwd, "sample.cel"), {
      host: "127.0.0.1",
      port: 9999,
      open: true,
      evaluate: false
    });
    expect(readFileFn).not.toHaveBeenCalled();
    expect(stayOpenFn).toHaveBeenCalledTimes(1);
    expect(stdout.join("")).toContain("http://127.0.0.1:9999/");
  });
});
