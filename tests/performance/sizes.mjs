import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { render } from "../../dist/core/src/index.js";
import { PERFORMANCE_SCENARIOS, createNativeWorkbook } from "./fixtures.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const budgetPath = resolve(repositoryRoot, "tests/performance/budgets.json");
const checkBudgets = process.argv.includes("--check");
const temporaryRoot = mkdtempSync(join(tmpdir(), "cello-performance-"));

try {
  const metrics = {
    ...measureNpmPackage(),
    ...measureVsix(),
    ...(await measureBrowserEntries()),
    ...measurePlayground(),
    ...(await measureRendererGrowth())
  };
  const report = { schemaVersion: 1, metrics };
  if (checkBudgets) {
    checkSizeBudgets(report, JSON.parse(readFileSync(budgetPath, "utf8")));
  }
  console.log(JSON.stringify(report, null, 2));
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}

function measureNpmPackage() {
  const output = run("npm", ["pack", "--json", "--ignore-scripts", "--pack-destination", temporaryRoot], repositoryRoot);
  const metadata = JSON.parse(output)[0];
  assert.ok(metadata, "npm pack did not report package metadata.");
  return {
    "npm.tarball.bytes": metadata.size,
    "npm.unpacked.bytes": metadata.unpackedSize
  };
}

function measureVsix() {
  const manifest = JSON.parse(readFileSync(resolve(repositoryRoot, "apps/vscode/package.json"), "utf8"));
  const path = resolve(repositoryRoot, "apps/vscode", `cello-vscode-${manifest.version}.vsix`);
  return { "vscode.vsix.bytes": statSync(path).size };
}

async function measureBrowserEntries() {
  const entries = {
    core: resolve(repositoryRoot, "packages/core/src/index.ts"),
    editorCore: resolve(repositoryRoot, "packages/editor-core/src/index.ts"),
    editorReact: resolve(repositoryRoot, "packages/editor-react/src/index.ts")
  };
  const measurements = {};
  for (const [name, entry] of Object.entries(entries)) {
    const output = await buildBrowserEntry(name, entry);
    const chunks = output.output.filter((item) => item.type === "chunk");
    const entryChunk = chunks.find((chunk) => chunk.isEntry);
    assert.ok(entryChunk, `Browser build for ${name} did not produce an entry chunk.`);
    measurements[`browser.${name}.entry.bytes`] = Buffer.byteLength(entryChunk.code);
    measurements[`browser.${name}.static.bytes`] = sumStaticChunkBytes(entryChunk, chunks);
    measurements[`browser.${name}.lazy.bytes`] = chunks
      .filter((chunk) => !chunk.isEntry && !isStaticDependency(entryChunk, chunk.fileName, chunks))
      .reduce((total, chunk) => total + Buffer.byteLength(chunk.code), 0);
  }
  return measurements;
}

async function buildBrowserEntry(name, entry) {
  const result = await build({
    configFile: false,
    logLevel: "silent",
    build: {
      write: false,
      minify: true,
      sourcemap: false,
      lib: { entry, formats: ["es"], fileName: name },
      rollupOptions: {
        external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"]
      }
    }
  });
  const outputs = Array.isArray(result) ? result : [result];
  return { output: outputs.flatMap((item) => item.output) };
}

function sumStaticChunkBytes(entry, chunks) {
  const seen = new Set();
  const visit = (fileName) => {
    if (seen.has(fileName)) return 0;
    seen.add(fileName);
    const chunk = chunks.find((candidate) => candidate.fileName === fileName);
    if (!chunk) return 0;
    return Buffer.byteLength(chunk.code) + chunk.imports.reduce((total, dependency) => total + visit(dependency), 0);
  };
  return visit(entry.fileName);
}

function isStaticDependency(entry, fileName, chunks) {
  const pending = [...entry.imports];
  const seen = new Set();
  while (pending.length > 0) {
    const candidate = pending.pop();
    if (!candidate || seen.has(candidate)) continue;
    if (candidate === fileName) return true;
    seen.add(candidate);
    const chunk = chunks.find((item) => item.fileName === candidate);
    if (chunk) pending.push(...chunk.imports);
  }
  return false;
}

function measurePlayground() {
  const playgroundRoot = resolve(repositoryRoot, "apps/playground/dist");
  const manifest = JSON.parse(readFileSync(resolve(playgroundRoot, ".vite/manifest.json"), "utf8"));
  const entry = Object.values(manifest).find((item) => item.isEntry);
  assert.ok(entry, "Playground manifest has no entry.");
  const codeMirror = findManifestChunk(manifest, (key, item) => key.includes("CodeMirrorSourceSurface") || item.file.includes("CodeMirrorSourceSurface"));
  const spreadsheet = findManifestChunk(manifest, (_key, item) => item.file.includes("spreadsheet-"));
  const initialFiles = collectManifestFiles(manifest, entry);
  return {
    "playground.initial.bytes": sumFileBytes(playgroundRoot, initialFiles),
    "playground.entry.bytes": statSync(resolve(playgroundRoot, entry.file)).size,
    "playground.codemirror.lazy.bytes": statSync(resolve(playgroundRoot, codeMirror.file)).size,
    "playground.spreadsheet.lazy.bytes": statSync(resolve(playgroundRoot, spreadsheet.file)).size
  };
}

function collectManifestFiles(manifest, entry) {
  const files = new Set([entry.file, ...(entry.css ?? [])]);
  const pending = [...(entry.imports ?? [])];
  while (pending.length > 0) {
    const key = pending.pop();
    if (!key) continue;
    const item = manifest[key];
    if (!item || files.has(item.file)) continue;
    files.add(item.file);
    for (const css of item.css ?? []) files.add(css);
    pending.push(...(item.imports ?? []));
  }
  return files;
}

function findManifestChunk(manifest, predicate) {
  const match = Object.entries(manifest).find(([key, item]) => predicate(key, item))?.[1];
  assert.ok(match, "Expected lazy playground chunk was not present in the manifest.");
  return match;
}

function sumFileBytes(root, files) {
  return [...files].reduce((total, path) => total + statSync(resolve(root, path)).size, 0);
}

async function measureRendererGrowth() {
  const source = createNativeWorkbook(PERFORMANCE_SCENARIOS.large);
  const html = await render(source, { evaluate: false, nonce: "benchmark" });
  const inputBytes = Buffer.byteLength(source);
  const outputBytes = Buffer.byteLength(html);
  return {
    "renderer.large.output.bytes": outputBytes,
    "renderer.large.expansion.ratio": Number((outputBytes / inputBytes).toFixed(4))
  };
}

function checkSizeBudgets(report, budgets) {
  const failures = [];
  for (const [name, expected] of Object.entries(budgets.sizes.metrics)) {
    const actual = report.metrics[name];
    if (actual === undefined) {
      failures.push(`${name}: measurement missing`);
      continue;
    }
    const maximum = expected.maxBytes ?? expected.maxRatio;
    if (actual > maximum) {
      failures.push(`${name}: ${actual} exceeds ${maximum}`);
    }
  }
  assert.equal(failures.length, 0, `Size budget failures:\n${failures.join("\n")}`);
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    env: { ...process.env, npm_config_cache: process.env.npm_config_cache ?? join(temporaryRoot, "npm-cache") }
  });
  if (result.status !== 0) {
    throw new Error([result.stdout, result.stderr].filter(Boolean).join("\n"));
  }
  return result.stdout;
}
