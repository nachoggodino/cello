#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { evaluate } from "../evaluator/evaluate.js";
import { parse } from "../parser/parse.js";
import { render } from "../renderer/render.js";
import { serialize } from "../serializer/serialize.js";
import { validate } from "../validator/validate.js";

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
  const request = parseCliRequest(argv, deps.cwd);
  if (request && "error" in request) {
    deps.stderrWrite(`${request.error}\n`);
    return 1;
  }
  if (!request) {
    printUsage(deps.stdoutWrite);
    return 1;
  }

  return runCliRequest(request, deps);
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
      "  cello validate <file.cel>",
      "  cello render <file.cel> [-o out.html]",
      "  cello serialize <file.cel> [-o out.cel]"
    ].join("\n")
  );
  write("\n");
}

type CliCommand = "parse" | "evaluate" | "validate" | "render" | "serialize";

interface CliRequest {
  command: CliCommand;
  inputPath: string;
  outPath: string;
}

interface CliRequestError {
  error: string;
}

function parseCliRequest(argv: string[], cwd: string): CliRequest | CliRequestError | null {
  const [, , command, inputArg, ...rest] = argv;
  if (!isCliCommand(command) || !inputArg) {
    return null;
  }

  const resolvedOutPath = resolveOutPath(cwd, rest);
  if (typeof resolvedOutPath !== "string") {
    return resolvedOutPath;
  }

  return {
    command,
    inputPath: resolve(cwd, inputArg),
    outPath: resolvedOutPath
  };
}

function isCliCommand(command: string | undefined): command is CliCommand {
  return (
    command === "parse" ||
    command === "evaluate" ||
    command === "validate" ||
    command === "render" ||
    command === "serialize"
  );
}

function resolveOutPath(cwd: string, rest: string[]): string | CliRequestError {
  const outIndex = rest.findIndex((arg) => arg === "--out" || arg === "-o");
  if (outIndex < 0) {
    return "";
  }
  const outArg = rest[outIndex + 1];
  if (!outArg || outArg.startsWith("-")) {
    return { error: "Missing output file after -o/--out." };
  }
  return resolve(cwd, outArg);
}

async function runCliRequest(request: CliRequest, deps: CliDeps): Promise<number> {
  const text = await deps.readFileFn(request.inputPath, "utf8");
  let ast: ReturnType<typeof parse> | undefined;
  const getAst = (): ReturnType<typeof parse> => {
    ast ??= parse(text);
    return ast;
  };

  const handlers: Record<CliCommand, () => Promise<number>> = {
    parse: async () => writeStdoutJson(getAst(), deps.stdoutWrite),
    evaluate: async () => writeStdoutJson(await evaluate(getAst()), deps.stdoutWrite),
    validate: async () => writeValidationResult(await validate(text, { baseDir: dirname(request.inputPath) }), deps.stdoutWrite),
    render: async () => writeCliOutput(await render(text), request.outPath, deps, false),
    serialize: async () => writeCliOutput(serialize(getAst()), request.outPath, deps, true)
  };

  return handlers[request.command]();
}

function writeValidationResult(value: Awaited<ReturnType<typeof validate>>, stdoutWrite: (text: string) => void): number {
  writeStdoutJson(value, stdoutWrite);
  return value.valid ? 0 : 1;
}

function writeStdoutJson(value: unknown, stdoutWrite: (text: string) => void): number {
  stdoutWrite(`${JSON.stringify(value, null, 2)}\n`);
  return 0;
}

async function writeCliOutput(
  output: string,
  outPath: string,
  deps: CliDeps,
  appendTrailingNewline: boolean
): Promise<number> {
  if (outPath) {
    await deps.writeFileFn(outPath, output, "utf8");
    deps.stdoutWrite(`Wrote ${outPath}\n`);
    return 0;
  }

  deps.stdoutWrite(appendTrailingNewline ? `${output}\n` : output);
  return 0;
}

const isDirectExecution =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

/* c8 ignore next 3 */
if (isDirectExecution) {
  void runMain(process.argv);
}

