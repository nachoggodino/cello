import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const canonicalPath = resolve(root, "BYLAWS.md");
const packagedPath = resolve(root, "packages/write-cel-code-skill/references/BYLAWS.md");
const authoringPath = resolve(root, "packages/write-cel-code-skill/references/cello-authoring-reference.md");
const markerPattern = /<!-- cello-bylaws-sha256: [a-f0-9]{64} -->/;

const canonical = readFileSync(canonicalPath, "utf8");
const digest = createHash("sha256").update(canonical).digest("hex");
const marker = `<!-- cello-bylaws-sha256: ${digest} -->`;
const write = process.argv.includes("--write");

if (write) {
  writeFileSync(packagedPath, canonical);
  const authoring = readFileSync(authoringPath, "utf8");
  writeFileSync(authoringPath, markerPattern.test(authoring) ? authoring.replace(markerPattern, marker) : `${marker}\n\n${authoring}`);
  console.log("Synchronized packaged Cello authoring references.");
  process.exit(0);
}

assert.equal(readFileSync(packagedPath, "utf8"), canonical, "Packaged BYLAWS.md drifted; run npm run docs:sync.");
assert.ok(readFileSync(authoringPath, "utf8").includes(marker), "Authoring reference was not reviewed against the current BYLAWS.md; run npm run docs:sync.");

for (const path of ["LICENSE", "NOTICE", "apps/vscode/LICENSE", "apps/vscode/NOTICE", "docs/README.md"]) {
  assert.ok(existsSync(resolve(root, path)), `Required release document is missing: ${path}`);
}
for (const path of ["Dockerfile", "nginx.conf", "docs/EDITOR_MODEL_PLAN.md", "docs/FORMULA_SUPPORT.md", "docs/HARDENING_PLAN.md", "apps/vscode/package-lock.json"]) {
  assert.ok(!existsSync(resolve(root, path)), `Retired or duplicate release file remains: ${path}`);
}
assert.match(readFileSync(resolve(root, "LICENSE"), "utf8"), /GNU GENERAL PUBLIC LICENSE[\s\S]*END OF TERMS AND CONDITIONS/, "LICENSE must contain the complete GPL text.");
assert.match(
  readFileSync(resolve(root, "apps/vscode/LICENSE"), "utf8"),
  /GNU GENERAL PUBLIC LICENSE[\s\S]*END OF TERMS AND CONDITIONS/,
  "VS Code LICENSE must contain the complete GPL text."
);

console.log("Documentation, licensing, and retired-file checks passed.");
