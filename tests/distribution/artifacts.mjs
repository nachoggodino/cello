import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import { runVSCodeCommand } from "@vscode/test-electron";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const temporaryRoot = mkdtempSync(join(tmpdir(), "cello-distribution-"));
const extensionRoot = join(repositoryRoot, "apps/vscode");

try {
  const packageArtifact = createNpmPackage();
  verifyNpmContents(packageArtifact);
  verifyInstalledConsumers(packageArtifact.tarballPath);
  verifyPlaygroundArtifact();
  const vsixPath = createVsix();
  await verifyVsix(vsixPath);
  await verifyVsixInstall(vsixPath);
  console.log("Distribution artifacts passed clean npm, browser, CLI, CSP, and VSIX verification.");
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}

function createNpmPackage() {
  const output = run("npm", ["pack", "--json", "--pack-destination", temporaryRoot], repositoryRoot);
  const metadata = parseTrailingJson(output)[0];
  assert.ok(metadata, "npm pack did not report artifact metadata.");
  return {
    files: metadata.files.map((file) => file.path),
    tarballPath: join(temporaryRoot, metadata.filename)
  };
}

function verifyNpmContents({ files, tarballPath }) {
  assert.ok(existsSync(tarballPath), "npm pack did not create the tarball.");
  const required = [
    "dist/core/src/index.js",
    "dist/core/src/node.js",
    "dist/core/src/node.d.ts",
    "dist/core/src/index.d.ts",
    "dist/core/src/index.js.map",
    "dist/core/src/index.d.ts.map",
    "dist/cli/src/cli.js",
    "dist/editor-core/src/index.js",
    "dist/editor-react/src/index.js",
    "dist/editor-react/src/styles.css",
    "docs/SPEC.md",
    "docs/examples/basic.cel",
    "packages/language-support/syntaxes/cel.tmLanguage.json",
    "packages/write-cel-code-skill/SKILL.md",
    "LICENSE",
    "NOTICE",
    "README.md",
    "package.json"
  ];
  for (const path of required) {
    assert.ok(files.includes(path), `npm package is missing ${path}.`);
  }

  const allowedRoots = ["dist/", "docs/", "packages/language-support/", "packages/write-cel-code-skill/"];
  const allowedFiles = new Set(["BYLAWS.md", "CHANGELOG.md", "LICENSE", "NOTICE", "README.md", "package.json"]);
  for (const path of files) {
    assert.ok(allowedFiles.has(path) || allowedRoots.some((root) => path.startsWith(root)), `Unexpected npm package file: ${path}`);
    assert.ok(!path.endsWith(".tsx") && (!path.endsWith(".ts") || path.endsWith(".d.ts")), `TypeScript source leaked into npm package: ${path}`);
  }

  for (const forbidden of ["docs/HARDENING_PLAN.md", "docs/EDITOR_MODEL_PLAN.md", "docs/RELEASE.md", "package-lock.json", "tsconfig.json"]) {
    assert.ok(!files.includes(forbidden), `Development-only file leaked into npm package: ${forbidden}`);
  }
}

function verifyInstalledConsumers(tarballPath) {
  const consumerRoot = join(temporaryRoot, "consumer");
  writeFileSync(join(temporaryRoot, "consumer-package.json"), JSON.stringify({ private: true, type: "module" }));
  mkdirSync(consumerRoot, { recursive: true });
  renameSync(join(temporaryRoot, "consumer-package.json"), join(consumerRoot, "package.json"));
  run("npm", ["install", "--ignore-scripts", tarballPath, "react@19.2.8", "react-dom@19.2.8"], consumerRoot);

  writeFileSync(
    join(consumerRoot, "consumer.mjs"),
    `
      import assert from "node:assert/strict";
      import { readFileSync } from "node:fs";
      import { fileURLToPath } from "node:url";
      import * as cello from "@nachoggodino/cello";
      import * as editorCore from "@nachoggodino/cello/editor-core";
      import * as nodeAdapter from "@nachoggodino/cello/node";
      import * as editorReact from "@nachoggodino/cello/editor-react";

      assert.equal(typeof cello.parseDocument, "function");
      assert.equal(typeof cello.render, "function");
      assert.equal(typeof editorCore.createEditorSession, "function");
      assert.equal(typeof editorReact.CelloWorkbench, "function");
      assert.equal(typeof nodeAdapter.createNodeExternalSourceOptions, "function");
      assert.deepEqual(Object.keys(cello).sort(), ["DIAGNOSTIC_CODES", "evaluate", "formatSource", "parse", "parseDocument", "render", "validate"]);
      assert.deepEqual(Object.keys(editorCore).sort(), ["EDITOR_COMMAND_SCHEMA_VERSION", "createEditorDocument", "createEditorSession", "createPersistedEditorCommand", "executeEditorCommand", "parsePersistedEditorCommand"]);
      assert.deepEqual(Object.keys(editorReact).sort(), ["CelloHtmlPreview", "CelloSourceEditor", "CelloVisualEditor", "CelloWorkbench", "useEditorSession"]);
      assert.equal("format" in cello, false);
      assert.equal("serialize" in cello, false);
      assert.match(
        readFileSync(fileURLToPath(import.meta.resolve("@nachoggodino/cello/editor-react/styles.css")), "utf8"),
        /celloVisualEditor/
      );
    `
  );
  run("node", ["consumer.mjs"], consumerRoot);

  writeFileSync(join(consumerRoot, "sample.cel"), "@sheet Sample\n| Value |\n| 1 |\n");
  run(resolve(consumerRoot, "node_modules/.bin/cello"), ["validate", "sample.cel"], consumerRoot);

  writeFileSync(join(consumerRoot, "index.html"), '<!doctype html><html><body><div id="root"></div><script type="module" src="/src.js"></script></body></html>');
  writeFileSync(
    join(consumerRoot, "src.js"),
    `
      import React from "react";
      import { createRoot } from "react-dom/client";
      import { createEditorSession } from "@nachoggodino/cello/editor-core";
      import { CelloHtmlPreview } from "@nachoggodino/cello/editor-react";
      import "@nachoggodino/cello/editor-react/styles.css";

      const session = createEditorSession({ source: "@sheet Browser\\n| Ready |" });
      createRoot(document.getElementById("root")).render(React.createElement(CelloHtmlPreview, { session }));
    `
  );
  run("node", [join(repositoryRoot, "node_modules/vite/bin/vite.js"), "build", consumerRoot], repositoryRoot);
  assert.ok(existsSync(join(consumerRoot, "dist/index.html")), "The clean browser consumer did not build.");
}

function verifyPlaygroundArtifact() {
  run("npm", ["run", "playground:build"], repositoryRoot);
  const distRoot = join(repositoryRoot, "apps/playground/dist");
  assert.ok(existsSync(join(distRoot, ".vite/manifest.json")), "Playground production manifest is missing.");
  const files = walkFiles(distRoot);
  assert.ok(!files.some((path) => path.endsWith(".map")), "Playground production artifact contains source maps.");

  const vercel = JSON.parse(readFileSync(join(repositoryRoot, "vercel.json"), "utf8"));
  const headers = new Map(vercel.headers?.[0]?.headers?.map((header) => [header.key, header.value]) ?? []);
  for (const key of ["Content-Security-Policy", "Permissions-Policy", "Referrer-Policy", "X-Content-Type-Options", "X-Frame-Options"]) {
    assert.ok(headers.has(key), `Playground deployment is missing ${key}.`);
  }
  const csp = headers.get("Content-Security-Policy") ?? "";
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /frame-ancestors 'none'/);
}

function createVsix() {
  run("npm", ["run", "package"], extensionRoot);
  const manifest = JSON.parse(readFileSync(join(extensionRoot, "package.json"), "utf8"));
  const vsixPath = join(extensionRoot, `cello-vscode-${manifest.version}.vsix`);
  assert.ok(existsSync(vsixPath), "VSIX packaging did not create the expected artifact.");
  return vsixPath;
}

async function verifyVsix(vsixPath) {
  const archive = await JSZip.loadAsync(readFileSync(vsixPath));
  const entries = Object.values(archive.files)
    .filter((entry) => !entry.dir)
    .map((entry) => entry.name);
  const required = [
    "extension/LICENSE.txt",
    "extension/NOTICE",
    "extension/package.json",
    "extension/readme.md",
    "extension/changelog.md",
    "extension/dist/extension.js",
    "extension/dist/syntaxes/cel.tmLanguage.json",
    "extension/dist/syntaxes/cel.language-configuration.json",
    "extension/media/icon.png"
  ];
  for (const path of required) {
    assert.ok(entries.includes(path), `VSIX is missing ${path}.`);
  }
  for (const path of entries) {
    assert.ok(!/^extension\/(?:src|tests|node_modules)\//.test(path), `Development directory leaked into VSIX: ${path}`);
    assert.ok(!/(?:package-lock\.json|tsconfig\.json|vitest\.config|\.map)$/.test(path), `Development file leaked into VSIX: ${path}`);
    assert.ok(!path.startsWith("extension/dist/test/"), `Host test output leaked into VSIX: ${path}`);
  }

  const manifestEntry = archive.file("extension/package.json");
  assert.ok(manifestEntry, "VSIX is missing its extension manifest.");
  const extensionManifest = JSON.parse(await manifestEntry.async("string"));
  const rootManifest = JSON.parse(readFileSync(join(repositoryRoot, "package.json"), "utf8"));
  assert.equal(extensionManifest.devDependencies?.["@nachoggodino/cello"], rootManifest.version);
  assert.equal(extensionManifest.engines?.vscode, "^1.125.0");
}

async function verifyVsixInstall(vsixPath) {
  const extensionsDirectory = join(temporaryRoot, "vscode-profile", "extensions");
  const userDataDirectory = join(temporaryRoot, "vscode-profile", "user-data");
  const profileArguments = ["--extensions-dir=" + extensionsDirectory, "--user-data-dir=" + userDataDirectory];
  const options = {
    version: process.env.CELLO_VSCODE_TEST_VERSION ?? "1.125.0",
    spawn: { cwd: temporaryRoot, env: { ...process.env, DONT_PROMPT_WSL_INSTALL: "1" } }
  };

  await runVSCodeCommand(["--install-extension", vsixPath, "--force", ...profileArguments], options);
  const installed = await runVSCodeCommand(["--list-extensions", "--show-versions", ...profileArguments], options);
  const manifest = JSON.parse(readFileSync(join(extensionRoot, "package.json"), "utf8"));
  assert.ok(
    installed.stdout
      .split(/\r?\n/)
      .map((entry) => entry.trim().toLowerCase())
      .includes(extensionId(manifest) + "@" + manifest.version),
    "The packaged VSIX was not listed after an isolated clean installation."
  );
}

function walkFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(path) : [path];
  });
}

function extensionId(manifest) {
  return (manifest.publisher + "." + manifest.name).toLowerCase();
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      npm_config_cache: process.env.npm_config_cache ?? join(temporaryRoot, "npm-cache")
    },
    maxBuffer: 20 * 1024 * 1024
  });
  if (result.status !== 0) {
    throw new Error([`${command} ${args.join(" ")} failed with exit code ${result.status}.`, result.stdout, result.stderr].filter(Boolean).join("\n"));
  }
  return result.stdout;
}

function parseTrailingJson(output) {
  const start = output.lastIndexOf("\n[");
  const json = start >= 0 ? output.slice(start + 1) : output;
  return JSON.parse(json);
}
