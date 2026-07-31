import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { evaluate, formatSource, parse, parseDocument, render } from "../../dist/core/src/index.js";
import { createEditorSession } from "../../dist/editor-core/src/index.js";
import { PERFORMANCE_SCENARIOS, createForeignWorkbook, createFormulaWorkbook, createNativeWorkbook, describePerformanceFixtures } from "./fixtures.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const budgetPath = resolve(repositoryRoot, "tests/performance/budgets.json");
const sampleCount = Number(process.env.CELLO_PERF_SAMPLES ?? 5);
const checkBudgets = process.argv.includes("--check");
const sources = Object.fromEntries(Object.entries(PERFORMANCE_SCENARIOS).map(([name, scenario]) => [name, createNativeWorkbook(scenario)]));
const measurements = {};
let checksum = 0;

const calibrationMs = measureCalibration();
measureStartup();
measureParsing();
measureFormatting();
measureSessions();
measureExternalRefresh();
measureDiagnostics();
await measureEvaluation();
await measureRendering();

const report = {
  schemaVersion: 1,
  environment: {
    node: process.version,
    platform: process.platform,
    architecture: process.arch,
    samples: sampleCount,
    calibrationMs: round(calibrationMs)
  },
  fixtures: describePerformanceFixtures(),
  metrics: measurements
};

if (checkBudgets) {
  checkRuntimeBudgets(report, JSON.parse(readFileSync(budgetPath, "utf8")));
}

console.log(JSON.stringify(report, null, 2));

function measureStartup() {
  const scenarios = {
    "startup.cli.version": ["dist/cli/src/cli.js", "version"],
    "startup.core.import": ["--input-type=module", "-e", "await import('./dist/core/src/index.js')"],
    "startup.editorReact.import": ["--input-type=module", "-e", "await import('./dist/editor-react/src/index.js')"]
  };
  for (const [name, args] of Object.entries(scenarios)) {
    record(
      name,
      measureSync(() => {
        const result = spawnSync(process.execPath, args, { cwd: repositoryRoot, encoding: "utf8" });
        assert.equal(result.status, 0, result.stderr);
        return result.stdout.length;
      }, 1)
    );
  }
}

function measureParsing() {
  for (const [name, source] of Object.entries(sources)) {
    record(
      `parse.native.${name}`,
      measureSync(() => parse(source).sheets[0]?.rows.length ?? 0, iterationsFor(name))
    );
  }
}

function measureFormatting() {
  for (const name of ["medium", "large"]) {
    const source = sources[name];
    assert.ok(source);
    record(
      `format.compact.${name}`,
      measureSync(() => formatSource(source, { layout: "compact" }).length, iterationsFor(name))
    );
    record(
      `format.pretty.${name}`,
      measureSync(() => formatSource(source, { layout: "pretty" }).length, iterationsFor(name))
    );
  }
}

function measureSessions() {
  for (const name of ["medium", "large"]) {
    const source = sources[name];
    assert.ok(source);
    const session = createEditorSession({ source });
    let suffix = false;
    record(
      `session.typing.${name}`,
      measureSync(() => {
        suffix = !suffix;
        const result = session.setSource(`${source}\n// typing-${suffix ? "a" : "b"}`, { history: "merge", historyGroup: "benchmark" });
        assert.equal(result.ok, true);
        return result.snapshot.revision;
      }, iterationsFor(name))
    );

    let value = false;
    record(
      `command.updateCell.${name}`,
      measureSync(() => {
        value = !value;
        const result = session.execute({
          type: "update-cell",
          address: { sheetIndex: 0, rowIndex: 1, colIndex: 0 },
          source: value ? "101" : "102",
          mode: "content"
        });
        assert.equal(result.ok, true);
        return result.document.source.length;
      }, iterationsFor(name))
    );
  }
}

function measureExternalRefresh() {
  for (const name of ["medium", "large"]) {
    const fixture = createForeignWorkbook(PERFORMANCE_SCENARIOS[name]);
    record(
      `external.refresh.${name}`,
      measureSync(
        () =>
          parseDocument(fixture.source, {
            baseDir: "/representative",
            readExternalSource: () => fixture.externalText
          }).workbook.sheets[0]?.rows.length ?? 0,
        iterationsFor(name)
      )
    );
  }
}

function measureDiagnostics() {
  const source = `${sources.large}\nThis line is intentionally invalid`;
  record(
    "vscode.diagnostics.large",
    measureSync(() => parse(source).diagnostics.length, 1)
  );
}

async function measureEvaluation() {
  for (const [name, rows] of [
    ["medium", PERFORMANCE_SCENARIOS.medium.rows],
    ["large", 750]
  ]) {
    const workbook = parse(createFormulaWorkbook(rows));
    record(`evaluate.formulas.${name}`, await measureAsync(async () => (await evaluate(workbook)).sheets[0]?.rows.length ?? 0, 1, 3));
  }
}

async function measureRendering() {
  for (const name of ["small", "medium", "large"]) {
    const source = sources[name];
    assert.ok(source);
    record(`preview.render.${name}`, await measureAsync(async () => (await render(source, { evaluate: false, nonce: "benchmark" })).length, 1));
  }
}

function measureCalibration() {
  return measureSync(
    () => {
      let value = 0x811c9dc5;
      for (let index = 0; index < 20_000_000; index += 1) {
        value = Math.imul(value ^ index, 16777619);
      }
      return value;
    },
    1,
    7
  );
}

function measureSync(operation, iterations = 1, samples = sampleCount) {
  operation();
  const timings = [];
  for (let sample = 0; sample < samples; sample += 1) {
    const start = performance.now();
    for (let iteration = 0; iteration < iterations; iteration += 1) {
      checksum ^= Number(operation()) | 0;
    }
    timings.push((performance.now() - start) / iterations);
  }
  return median(timings);
}

async function measureAsync(operation, iterations = 1, samples = sampleCount) {
  await operation();
  const timings = [];
  for (let sample = 0; sample < samples; sample += 1) {
    const start = performance.now();
    for (let iteration = 0; iteration < iterations; iteration += 1) {
      checksum ^= Number(await operation()) | 0;
    }
    timings.push((performance.now() - start) / iterations);
  }
  return median(timings);
}

function record(name, medianMs) {
  measurements[name] = {
    medianMs: round(medianMs),
    normalized: round(medianMs / calibrationMs)
  };
}

function checkRuntimeBudgets(reportValue, budgets) {
  const failures = [];
  for (const [name, expected] of Object.entries(budgets.runtime.metrics)) {
    const actual = reportValue.metrics[name];
    if (!actual) {
      failures.push(`${name}: measurement missing`);
      continue;
    }
    if (actual.normalized > expected.maxNormalized) {
      failures.push(`${name}: normalized ${actual.normalized} exceeds ${expected.maxNormalized}`);
    }
  }
  assert.equal(failures.length, 0, `Runtime performance budget failures:\n${failures.join("\n")}`);
}

function iterationsFor(name) {
  if (name === "small") return 20;
  if (name === "medium") return 3;
  return 1;
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function round(value) {
  return Number(value.toFixed(4));
}
