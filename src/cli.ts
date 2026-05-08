#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { evaluate } from "./evaluate.js";
import { parse } from "./parse.js";
import { render } from "./render.js";
import { serialize } from "./serialize.js";

export interface CliDeps {
  cwd: string;
  readFileFn: typeof readFile;
  writeFileFn: typeof writeFile;
  stdoutWrite: (text: string) => void;
  stderrWrite: (text: string) => void;
}

export function createCliDeps(overrides: Partial<CliDeps> = {}): CliDeps {
  return {
    cwd: overrides.cwd ?? process.cwd(),
    readFileFn: overrides.readFileFn ?? readFile,
    writeFileFn: overrides.writeFileFn ?? writeFile,
    stdoutWrite: overrides.stdoutWrite ?? ((text) => process.stdout.write(text)),
    stderrWrite: overrides.stderrWrite ?? ((text) => process.stderr.write(text))
  };
}

export async function runCli(argv: string[], deps: CliDeps = createCliDeps()): Promise<number> {
  const [, , command, inputArg, ...rest] = argv;
  if (!command || !inputArg) {
    printUsage(deps.stdoutWrite);
    return 1;
  }

  const inputPath = resolve(deps.cwd, inputArg);
  const text = await deps.readFileFn(inputPath, "utf8");
  const outIndex = rest.findIndex((arg) => arg === "--out" || arg === "-o");
  const outPath = outIndex >= 0 ? resolve(deps.cwd, rest[outIndex + 1] ?? "") : "";

  if (command === "parse") {
    const ast = parse(text);
    deps.stdoutWrite(`${JSON.stringify(ast, null, 2)}\n`);
    return 0;
  }

  if (command === "evaluate") {
    const ast = parse(text);
    const evaluated = await evaluate(ast);
    deps.stdoutWrite(`${JSON.stringify(evaluated, null, 2)}\n`);
    return 0;
  }

  if (command === "render") {
    const html = await render(text);
    if (outPath) {
      await deps.writeFileFn(outPath, html, "utf8");
      deps.stdoutWrite(`Wrote ${outPath}\n`);
      return 0;
    }
    deps.stdoutWrite(html);
    return 0;
  }

  if (command === "serialize") {
    const ast = parse(text);
    const output = serialize(ast);
    if (outPath) {
      await deps.writeFileFn(outPath, output, "utf8");
      deps.stdoutWrite(`Wrote ${outPath}\n`);
      return 0;
    }
    deps.stdoutWrite(`${output}\n`);
    return 0;
  }

  printUsage(deps.stdoutWrite);
  return 1;
}

export async function runMain(
  argv: string[],
  deps: CliDeps = createCliDeps(),
  exitFn: (code: number) => void = (code) => process.exit(code),
  runCliFn: (argv: string[], deps: CliDeps) => Promise<number> = runCli,
  stderrWrite: (text: string) => void = (text) => process.stderr.write(text)
): Promise<void> {
  try {
    const code = await runCliFn(argv, deps);
    exitFn(code);
  } catch (err) {
    const message = err instanceof Error ? err.stack ?? err.message : String(err);
    stderrWrite(`${message}\n`);
    exitFn(1);
  }
}

function printUsage(write: (text: string) => void): void {
  write(
    [
      "Usage:",
      "  cello parse <file.cel>",
      "  cello evaluate <file.cel>",
      "  cello render <file.cel> [-o out.html]",
      "  cello serialize <file.cel> [-o out.cel]"
    ].join("\n")
  );
  write("\n");
}

const isDirectExecution =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

/* c8 ignore next 3 */
if (isDirectExecution) {
  void runMain(process.argv);
}
