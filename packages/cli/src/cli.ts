#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { evaluate } from "../../core/src/evaluator/evaluate.js";
import { formatSource } from "../../core/src/formatter/source-layout.js";
import { parse } from "../../core/src/parser/parse.js";
import { render } from "../../core/src/renderer/render.js";
import { validate } from "../../core/src/validator/validate.js";
import { VERSION } from "../../core/src/version.js";
import { createNodeExternalSourceOptions } from "../../core/src/node.js";
import { startServe } from "./serve.js";
import { parseCliRequest } from "./arguments.js";
import type { CliRequest, HelpRequest, NonServeCliCommand, VersionRequest } from "./arguments.js";

export const CLI_EXIT_CODES = { success: 0, failure: 1 } as const;

export interface CliDeps {
  cwd: string;
  readFileFn: typeof readFile;
  writeFileFn: typeof writeFile;
  startServeFn: typeof startServe;
  stayOpenFn: () => Promise<number>;
  stdoutWrite: (text: string) => void;
  stderrWrite: (text: string) => void;
}

export function createCliDeps(overrides: Partial<CliDeps> = {}): CliDeps {
  return {
    cwd: overrides.cwd ?? process.cwd(),
    readFileFn: overrides.readFileFn ?? readFile,
    writeFileFn: overrides.writeFileFn ?? writeFile,
    startServeFn: overrides.startServeFn ?? startServe,
    stayOpenFn: overrides.stayOpenFn ?? (() => new Promise<number>(() => undefined)),
    stdoutWrite: overrides.stdoutWrite ?? ((text) => process.stdout.write(text)),
    stderrWrite: overrides.stderrWrite ?? ((text) => process.stderr.write(text))
  };
}

export async function runCli(argv: string[], deps: CliDeps = createCliDeps()): Promise<number> {
  const request = parseCliRequest(argv, deps.cwd);
  if (request && "error" in request) {
    deps.stderrWrite(`${request.error}\n`);
    return CLI_EXIT_CODES.failure;
  }
  if (!request) {
    printUsage(deps.stdoutWrite);
    return CLI_EXIT_CODES.failure;
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
    const message = err instanceof Error ? (err.stack ?? err.message) : String(err);
    stderrWrite(`${message}\n`);
    exitFn(CLI_EXIT_CODES.failure);
  }
}

function printUsage(write: (text: string) => void): void {
  write(
    [
      "Usage:",
      "  cello help [command]",
      "  cello version",
      "  cello parse <file.cel>",
      "  cello evaluate <file.cel>",
      "  cello format <file.cel> [--check] [-o out.cel]",
      "  cello validate <file.cel>",
      "  cello render <file.cel> [-o out.html] [--no-eval] [--format document|fragment]",
      "  cello serve <file.cel> [--port 4321] [--host 127.0.0.1] [--open] [--no-eval]"
    ].join("\n")
  );
  write("\n");
}

const HELP_TEXT: Record<string, string> = {
  help: "Usage: cello help [command]\n\nPrint general help or details for one command.\n",
  version: "Usage: cello --version\n\nPrint the cello CLI version.\n",
  parse: "Usage: cello parse <file.cel>\n\nParse a workbook and print the AST as JSON.\n",
  evaluate: "Usage: cello evaluate <file.cel>\n\nParse and evaluate formulas, then print the evaluated AST as JSON.\n",
  format:
    "Usage: cello format <file.cel> [--check] [-o out.cel]\n\nPretty-print native Cello pipe tables. Writes in place by default, supports -o/--out for an alternate destination, and --check to report whether formatting changes are needed.\n",
  validate: "Usage: cello validate <file.cel>\n\nParse and evaluate diagnostics. Prints JSON with valid and diagnostics fields. Exits 0 when valid, 1 when diagnostics exist.\n",
  render:
    "Usage: cello render <file.cel> [-o out.html] [--no-eval] [--format document|fragment]\n\nRender a workbook to HTML. The default format is document. Use fragment for an embeddable chunk without html/head/body wrappers. Use --no-eval to leave formula cells unevaluated.\n",
  serve:
    "Usage: cello serve <file.cel> [--port 4321] [--host 127.0.0.1] [--open] [--no-eval]\n\nServe a live HTML preview. The server keeps the process warm for faster repeated renders. Use --open to open the URL in a browser.\n"
};

async function runCliRequest(request: CliRequest | HelpRequest | VersionRequest, deps: CliDeps): Promise<number> {
  if (request.command === "version") {
    deps.stdoutWrite(`${VERSION}\n`);
    return CLI_EXIT_CODES.success;
  }

  if (request.command === "help") {
    return writeHelp(request.topic, deps.stdoutWrite, deps.stderrWrite);
  }

  if (request.command === "serve") {
    return runServeRequest(request, deps);
  }

  const text = await deps.readFileFn(request.inputPath, "utf8");
  const externalSourceOptions = createNodeExternalSourceOptions(resolve(request.inputPath, ".."));
  let ast: ReturnType<typeof parse> | undefined;
  const getAst = (): ReturnType<typeof parse> => {
    ast ??= parse(text, externalSourceOptions);
    return ast;
  };

  const handlers: Record<NonServeCliCommand, () => Promise<number>> = {
    parse: () => Promise.resolve(writeStdoutJson(getAst(), deps.stdoutWrite)),
    evaluate: async () => writeStdoutJson(await evaluate(getAst()), deps.stdoutWrite),
    format: async () => writeFormattedOutput(formatSource(text, { layout: "pretty" }), text, request, deps),
    validate: async () => writeValidationResult(await validate(text, externalSourceOptions), deps.stdoutWrite),
    render: async () =>
      writeCliOutput(
        await render(text, {
          ...externalSourceOptions,
          evaluate: request.evaluate,
          ...(request.renderFormat ? { format: request.renderFormat } : {})
        }),
        request.outPath,
        deps
      )
  };

  return handlers[request.command]();
}

async function runServeRequest(request: CliRequest, deps: CliDeps): Promise<number> {
  const serveOptions: Parameters<typeof startServe>[1] = { evaluate: request.evaluate };
  if (request.host !== undefined) {
    serveOptions.host = request.host;
  }
  if (request.port !== undefined) {
    serveOptions.port = request.port;
  }
  if (request.open !== undefined) {
    serveOptions.open = request.open;
  }
  const handle = await deps.startServeFn(request.inputPath, serveOptions);
  deps.stdoutWrite(`Serving ${request.inputPath}\n${formatTerminalLink(handle.url)}\n`);
  return deps.stayOpenFn();
}

async function writeFormattedOutput(formatted: string, original: string, request: CliRequest, deps: CliDeps): Promise<number> {
  const changed = formatted !== original;

  if (request.check) {
    deps.stdoutWrite(`${changed ? "Needs formatting" : "Already formatted"}: ${request.inputPath}\n`);
    return changed ? CLI_EXIT_CODES.failure : CLI_EXIT_CODES.success;
  }

  const destination = request.outPath || request.inputPath;
  if (!changed && destination === request.inputPath) {
    deps.stdoutWrite(`Already formatted: ${request.inputPath}\n`);
    return CLI_EXIT_CODES.success;
  }

  await deps.writeFileFn(destination, formatted, "utf8");
  deps.stdoutWrite(`Wrote ${destination}\n`);
  return CLI_EXIT_CODES.success;
}

function writeHelp(topic: string, stdoutWrite: (text: string) => void, stderrWrite: (text: string) => void): number {
  if (topic.length === 0) {
    printUsage(stdoutWrite);
    return CLI_EXIT_CODES.success;
  }
  const text = HELP_TEXT[topic];
  if (!text) {
    stderrWrite(`Unknown help topic: ${topic}\n`);
    return CLI_EXIT_CODES.failure;
  }
  stdoutWrite(text);
  return CLI_EXIT_CODES.success;
}

function formatTerminalLink(url: string): string {
  return `\u001B]8;;${url}\u0007${url}\u001B]8;;\u0007`;
}

function writeValidationResult(value: Awaited<ReturnType<typeof validate>>, stdoutWrite: (text: string) => void): number {
  writeStdoutJson(value, stdoutWrite);
  return value.valid ? CLI_EXIT_CODES.success : CLI_EXIT_CODES.failure;
}

function writeStdoutJson(value: unknown, stdoutWrite: (text: string) => void): number {
  stdoutWrite(`${JSON.stringify(value, null, 2)}\n`);
  return CLI_EXIT_CODES.success;
}

async function writeCliOutput(output: string, outPath: string, deps: CliDeps): Promise<number> {
  if (outPath) {
    await deps.writeFileFn(outPath, output, "utf8");
    deps.stdoutWrite(`Wrote ${outPath}\n`);
    return CLI_EXIT_CODES.success;
  }

  deps.stdoutWrite(output);
  return CLI_EXIT_CODES.success;
}

const isDirectExecution = process.argv[1] !== undefined && isDirectCliExecution(process.argv[1], import.meta.url);

export function isDirectCliExecution(argvPath: string, moduleUrl: string): boolean {
  try {
    return realpathSync(argvPath) === realpathSync(fileURLToPath(moduleUrl));
  } catch {
    return pathToFileURL(argvPath).href === moduleUrl;
  }
}

/* c8 ignore next 3 */
if (isDirectExecution) {
  void runMain(process.argv);
}
