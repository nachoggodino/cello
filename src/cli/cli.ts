#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { evaluate } from "../evaluator/evaluate.js";
import { parse } from "../parser/parse.js";
import { render } from "../renderer/render.js";
import { serialize } from "../serializer/serialize.js";
import { validate } from "../validator/validate.js";
import { VERSION } from "../version.js";
import { startServe } from "./serve.js";

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
      "  cello help [command]",
      "  cello version",
      "  cello parse <file.cel>",
      "  cello evaluate <file.cel>",
      "  cello validate <file.cel>",
      "  cello render <file.cel> [-o out.html] [--no-eval]",
      "  cello serialize <file.cel> [-o out.cel]",
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
  validate:
    "Usage: cello validate <file.cel>\n\nParse and evaluate diagnostics. Prints JSON with valid and diagnostics fields. Exits 0 when valid, 1 when diagnostics exist.\n",
  render:
    "Usage: cello render <file.cel> [-o out.html] [--no-eval]\n\nRender a workbook to self-contained HTML. Use --no-eval to leave formula cells unevaluated.\n",
  serialize: "Usage: cello serialize <file.cel> [-o out.cel]\n\nParse and serialize a workbook back to .cel text.\n",
  serve:
    "Usage: cello serve <file.cel> [--port 4321] [--host 127.0.0.1] [--open] [--no-eval]\n\nServe a live HTML preview. The server keeps the process warm for faster repeated renders. Use --open to open the URL in a browser.\n"
};

type CliCommand = "parse" | "evaluate" | "validate" | "render" | "serialize" | "serve";
type NonServeCliCommand = Exclude<CliCommand, "serve">;

interface CliRequest {
  command: CliCommand;
  inputPath: string;
  outPath: string;
  evaluate: boolean;
  host?: string;
  port?: number;
  open?: boolean;
}

interface HelpRequest {
  command: "help";
  topic: string;
}

interface VersionRequest {
  command: "version";
}

interface CliRequestError {
  error: string;
}

function parseCliRequest(argv: string[], cwd: string): CliRequest | HelpRequest | VersionRequest | CliRequestError | null {
  const [, , command, inputArg, ...rest] = argv;
  if (command === "--version" || command === "-v" || command === "version") {
    if (inputArg) {
      return { error: `Unexpected argument for version: ${inputArg}` };
    }
    return { command: "version" };
  }
  if (command === "help" || command === "--help" || command === "-h") {
    if (rest.length > 0) {
      return { error: `Unexpected argument for help: ${rest[0]}` };
    }
    return { command: "help", topic: inputArg ?? "" };
  }
  if (inputArg === "--help" || inputArg === "-h") {
    if (rest.length > 0) {
      return { error: `Unexpected argument for help: ${rest[0]}` };
    }
    return { command: "help", topic: command ?? "" };
  }
  if (!command) {
    return null;
  }
  if (!isCliCommand(command)) {
    return { error: `Unknown command: ${command}` };
  }
  if (!inputArg) {
    return { error: `Missing input file for ${command}.` };
  }
  if (inputArg.startsWith("-")) {
    return { error: `Missing input file for ${command}; received option ${inputArg}.` };
  }

  const serveOptionError = validateServeOptionScope(command, rest);
  if (serveOptionError) {
    return serveOptionError;
  }

  const argumentError = validateArguments(command, rest);
  if (argumentError) {
    return argumentError;
  }

  const resolvedOutPath = resolveOutPath(cwd, rest);
  if (typeof resolvedOutPath !== "string") {
    return resolvedOutPath;
  }

  const request: CliRequest = {
    command,
    inputPath: resolve(cwd, inputArg),
    outPath: resolvedOutPath,
    evaluate: !rest.includes("--no-eval")
  };
  if (command === "serve") {
    const resolvedServeOptions = resolveServeOptions(rest);
    if ("error" in resolvedServeOptions) {
      return resolvedServeOptions;
    }
    request.host = resolvedServeOptions.host;
    request.port = resolvedServeOptions.port;
    request.open = resolvedServeOptions.open;
  }
  return request;
}

function isCliCommand(command: string | undefined): command is CliCommand {
  return (
    command === "parse" ||
    command === "evaluate" ||
    command === "validate" ||
    command === "render" ||
    command === "serialize" ||
    command === "serve"
  );
}

function validateServeOptionScope(command: CliCommand, rest: string[]): CliRequestError | undefined {
  if (command !== "serve" && (rest.includes("--host") || rest.includes("--port") || rest.includes("--open"))) {
    return { error: "--host, --port, and --open are only supported by serve." };
  }
  if (command !== "serve" && command !== "render" && rest.includes("--no-eval")) {
    return { error: "--no-eval is only supported by render and serve." };
  }
  return undefined;
}

function validateArguments(command: CliCommand, rest: string[]): CliRequestError | undefined {
  const optionsWithValues = new Set(command === "serve" ? ["--host", "--port"] : ["--out", "-o"]);
  const allowedOptions = new Set<string>();
  if (command === "render" || command === "serialize") {
    allowedOptions.add("--out");
    allowedOptions.add("-o");
  }
  if (command === "render" || command === "serve") {
    allowedOptions.add("--no-eval");
  }
  if (command === "serve") {
    allowedOptions.add("--host");
    allowedOptions.add("--port");
    allowedOptions.add("--open");
  }

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === undefined) {
      continue;
    }
    if (!arg.startsWith("-")) {
      return { error: `Unexpected argument: ${arg}` };
    }
    if (!allowedOptions.has(arg)) {
      return { error: `Unsupported option for ${command}: ${arg}` };
    }
    if (optionsWithValues.has(arg)) {
      index += 1;
      continue;
    }
  }
  return undefined;
}

function resolveServeOptions(rest: string[]): { host: string; port: number; open: boolean } | CliRequestError {
  const hostValue = readOption(rest, "--host");
  if (hostValue && "error" in hostValue) {
    return hostValue;
  }
  const portValue = readOption(rest, "--port");
  if (portValue && "error" in portValue) {
    return portValue;
  }
  const host = hostValue?.value ?? "127.0.0.1";
  const rawPort = portValue?.value;
  const port = rawPort === undefined ? 4321 : Number(rawPort);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    return { error: "Invalid --port value." };
  }
  return { host, port, open: rest.includes("--open") };
}

function readOption(rest: string[], name: string): { value: string } | CliRequestError | undefined {
  const index = rest.findIndex((arg) => arg === name);
  if (index < 0) {
    return undefined;
  }
  const value = rest[index + 1];
  if (!value || value.startsWith("-")) {
    return { error: `Missing value after ${name}.` };
  }
  return { value };
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

async function runCliRequest(request: CliRequest | HelpRequest | VersionRequest, deps: CliDeps): Promise<number> {
  if (request.command === "version") {
    deps.stdoutWrite(`${VERSION}\n`);
    return 0;
  }

  if (request.command === "help") {
    return writeHelp(request.topic, deps.stdoutWrite, deps.stderrWrite);
  }

  if (request.command === "serve") {
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

  const text = await deps.readFileFn(request.inputPath, "utf8");
  let ast: ReturnType<typeof parse> | undefined;
  const getAst = (): ReturnType<typeof parse> => {
    ast ??= parse(text);
    return ast;
  };

  const handlers: Record<NonServeCliCommand, () => Promise<number>> = {
    parse: async () => writeStdoutJson(getAst(), deps.stdoutWrite),
    evaluate: async () => writeStdoutJson(await evaluate(getAst()), deps.stdoutWrite),
    validate: async () => writeValidationResult(await validate(text, { baseDir: dirname(request.inputPath) }), deps.stdoutWrite),
    render: async () =>
      writeCliOutput(
        await render(text, {
          baseDir: dirname(request.inputPath),
          evaluate: request.evaluate
        }),
        request.outPath,
        deps,
        false
      ),
    serialize: async () => writeCliOutput(serialize(getAst()), request.outPath, deps, true)
  };

  return handlers[request.command]();
}

function writeHelp(
  topic: string,
  stdoutWrite: (text: string) => void,
  stderrWrite: (text: string) => void
): number {
  if (topic.length === 0) {
    printUsage(stdoutWrite);
    return 0;
  }
  const text = HELP_TEXT[topic];
  if (!text) {
    stderrWrite(`Unknown help topic: ${topic}\n`);
    return 1;
  }
  stdoutWrite(text);
  return 0;
}

function formatTerminalLink(url: string): string {
  return `\u001B]8;;${url}\u0007${url}\u001B]8;;\u0007`;
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
  process.argv[1] !== undefined && isDirectCliExecution(process.argv[1], import.meta.url);

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
