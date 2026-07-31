import { resolve } from "node:path";
import type { RenderOptions } from "../../core/src/shared/types.js";

export type CliCommand = "parse" | "evaluate" | "format" | "validate" | "render" | "serve";
export type NonServeCliCommand = Exclude<CliCommand, "serve">;

export interface CliRequest {
  command: CliCommand;
  inputPath: string;
  outPath: string;
  evaluate: boolean;
  check?: boolean;
  renderFormat?: RenderOptions["format"];
  host?: string;
  port?: number;
  open?: boolean;
}

export interface HelpRequest {
  command: "help";
  topic: string;
}

export interface VersionRequest {
  command: "version";
}

interface CliRequestError {
  error: string;
}

export type ParsedCliRequest = CliRequest | HelpRequest | VersionRequest | CliRequestError | null;

export function parseCliRequest(argv: string[], cwd: string): ParsedCliRequest {
  const [, , command, inputArg, ...rest] = argv;
  const metadataRequest = parseMetadataRequest(command, inputArg, rest);
  if (metadataRequest !== undefined) {
    return metadataRequest;
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
  return parseFileRequest(command, inputArg, rest, cwd);
}

function parseMetadataRequest(command: string | undefined, inputArg: string | undefined, rest: string[]): HelpRequest | VersionRequest | CliRequestError | undefined {
  const versionRequest = parseVersionRequest(command, inputArg);
  if (versionRequest) {
    return versionRequest;
  }
  return parseHelpRequest(command, inputArg, rest);
}

function parseVersionRequest(command: string | undefined, inputArg: string | undefined): VersionRequest | CliRequestError | undefined {
  if (!["--version", "-v", "version"].includes(command ?? "")) {
    return undefined;
  }
  return inputArg ? { error: `Unexpected argument for version: ${inputArg}` } : { command: "version" };
}

function parseHelpRequest(command: string | undefined, inputArg: string | undefined, rest: string[]): HelpRequest | CliRequestError | undefined {
  if (["help", "--help", "-h"].includes(command ?? "")) {
    return createHelpRequest(inputArg ?? "", rest);
  }
  if (["--help", "-h"].includes(inputArg ?? "")) {
    return createHelpRequest(command ?? "", rest);
  }
  return undefined;
}

function createHelpRequest(topic: string, rest: string[]): HelpRequest | CliRequestError {
  if (rest.length > 0) {
    return { error: `Unexpected argument for help: ${rest[0] ?? ""}` };
  }
  return { command: "help", topic };
}

function parseFileRequest(command: CliCommand, inputArg: string, rest: string[], cwd: string): CliRequest | CliRequestError {
  const optionScopeError = validateOptionScope(command, rest);
  if (optionScopeError) {
    return optionScopeError;
  }
  const argumentError = validateArguments(command, rest);
  if (argumentError) {
    return argumentError;
  }
  const outPath = resolveOutPath(cwd, rest);
  if (typeof outPath !== "string") {
    return outPath;
  }
  const renderFormat = command === "render" ? resolveRenderFormat(rest) : undefined;
  if (renderFormat && "error" in renderFormat) {
    return renderFormat;
  }
  return buildFileRequest(command, resolve(cwd, inputArg), outPath, rest, renderFormat?.format);
}

function buildFileRequest(
  command: CliCommand,
  inputPath: string,
  outPath: string,
  rest: string[],
  renderFormat: RenderOptions["format"] | undefined
): CliRequest | CliRequestError {
  const request: CliRequest = { command, inputPath, outPath, evaluate: !rest.includes("--no-eval") };
  if (command === "format") {
    request.check = rest.includes("--check");
  }
  if (renderFormat) {
    request.renderFormat = renderFormat;
  }
  if (command !== "serve") {
    return request;
  }
  const serveOptions = resolveServeOptions(rest);
  if ("error" in serveOptions) {
    return serveOptions;
  }
  return { ...request, ...serveOptions };
}

function isCliCommand(command: string): command is CliCommand {
  return command === "parse" || command === "evaluate" || command === "format" || command === "validate" || command === "render" || command === "serve";
}

function validateOptionScope(command: CliCommand, rest: string[]): CliRequestError | undefined {
  if (command !== "serve" && (rest.includes("--host") || rest.includes("--port") || rest.includes("--open"))) {
    return { error: "--host, --port, and --open are only supported by serve." };
  }
  if (command !== "serve" && command !== "render" && rest.includes("--no-eval")) {
    return { error: "--no-eval is only supported by render and serve." };
  }
  if (command !== "format" && rest.includes("--check")) {
    return { error: "--check is only supported by format." };
  }
  return undefined;
}

function validateArguments(command: CliCommand, rest: string[]): CliRequestError | undefined {
  const optionsWithValues = new Set(command === "serve" ? ["--host", "--port"] : ["--out", "-o", "--format"]);
  const allowedOptions = getAllowedOptions(command);
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === undefined) continue;
    if (!arg.startsWith("-")) return { error: `Unexpected argument: ${arg}` };
    if (!allowedOptions.has(arg)) return { error: `Unsupported option for ${command}: ${arg}` };
    if (optionsWithValues.has(arg)) index += 1;
  }
  return undefined;
}

function getAllowedOptions(command: CliCommand): Set<string> {
  const options = new Set<string>();
  if (command === "render" || command === "format") {
    options.add("--out");
    options.add("-o");
  }
  if (command === "render" || command === "serve") options.add("--no-eval");
  if (command === "render") options.add("--format");
  if (command === "format") options.add("--check");
  if (command === "serve") {
    options.add("--host");
    options.add("--port");
    options.add("--open");
  }
  return options;
}

function resolveServeOptions(rest: string[]): { host: string; port: number; open: boolean } | CliRequestError {
  const hostValue = readOption(rest, "--host");
  if (hostValue && "error" in hostValue) return hostValue;
  const port = resolveServePort(rest);
  if (typeof port !== "number") return port;
  const host = hostValue?.value ?? "127.0.0.1";
  return { host, port, open: rest.includes("--open") };
}

function resolveServePort(rest: string[]): number | CliRequestError {
  const portValue = readOption(rest, "--port");
  if (portValue && "error" in portValue) {
    return portValue;
  }
  const rawPort = portValue?.value;
  if (rawPort === undefined) {
    return 4321;
  }
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    return { error: "Invalid --port value." };
  }
  return port;
}

function readOption(rest: string[], name: string): { value: string } | CliRequestError | undefined {
  const index = rest.findIndex((arg) => arg === name);
  if (index < 0) return undefined;
  const value = rest[index + 1];
  return !value || value.startsWith("-") ? { error: `Missing value after ${name}.` } : { value };
}

function resolveOutPath(cwd: string, rest: string[]): string | CliRequestError {
  const outIndex = rest.findIndex((arg) => arg === "--out" || arg === "-o");
  if (outIndex < 0) return "";
  const outArg = rest[outIndex + 1];
  return !outArg || outArg.startsWith("-") ? { error: "Missing output file after -o/--out." } : resolve(cwd, outArg);
}

function resolveRenderFormat(rest: string[]): { format: RenderOptions["format"] } | CliRequestError | undefined {
  const raw = readOption(rest, "--format");
  if (!raw || "error" in raw) return raw;
  return raw.value === "document" || raw.value === "fragment" ? { format: raw.value } : { error: "Invalid --format value. Expected document or fragment." };
}
