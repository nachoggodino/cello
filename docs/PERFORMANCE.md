# Performance and size budgets

Phase 7 establishes repeatable regression detection before attempting speculative
optimization. The authoritative machine-readable baselines and ceilings are in
`tests/performance/budgets.json`.

## Representative fixtures

Fixtures are generated deterministically and contain no production data.

| Scenario |  Rows | Columns | Native bytes | Foreign CSV bytes |
| -------- | ----: | ------: | -----------: | ----------------: |
| Small    |    20 |       6 |        1,070 |               760 |
| Medium   |   250 |      12 |       26,879 |            20,343 |
| Large    | 1,500 |      16 |      228,154 |           177,114 |

The formula fixture uses Quantity, Price, row-local Total, and running aggregate
columns. The external fixture uses the same scalar mix as the native fixture through
the host-provided read capability.

## Runtime methodology

`npm run perf:runtime` runs five samples after warm-up and checks median operation
latency. Each median is divided by a median 20-million-iteration integer calibration
sample. CI gates the normalized value, reducing sensitivity to runner CPU speed.

The initial ceilings are approximately 2.5 times the recorded normalized baseline.
They intentionally detect substantial regressions rather than normal shared-runner
noise. Raw per-run samples are not committed.

Reference environment: Linux x64, Node 24.15.0, measured 2026-07-31.

| Surface          | Representative operation                    |           Median |
| ---------------- | ------------------------------------------- | ---------------: |
| CLI              | Cold `cello version` process                |          38.2 ms |
| Core             | Cold core module import                     |          20.5 ms |
| React adapter    | Cold editor-react module import             |          33.5 ms |
| Parser           | Large native workbook                       |          15.0 ms |
| Source session   | Large typing reparse and revision           |          12.9 ms |
| Visual command   | Large single-cell update and verified patch |         121.9 ms |
| Compact / Pretty | Large whole-document formatting             | 120.2 / 143.5 ms |
| Formula engine   | 750 formula rows                            |          22.7 ms |
| Preview          | Large HTML generation                       |          37.5 ms |
| External source  | Large CSV capability refresh                |           3.2 ms |
| VS Code          | Large parser diagnostics pass               |           9.8 ms |

The large command and formatting medians are accepted for explicit operations over a
24,000-cell source document. Continuous typing and diagnostics remain within a
16.7 ms frame on the reference machine. Medium command latency is 3.9 ms.

The VS Code measurement covers the dominant parser/diagnostic collection work.
Extension-host activation and diagnostic publication remain covered by the real VS
Code host suite rather than a noisy synthetic Electron timer.

## Artifact and entry-point methodology

`npm run perf:sizes` measures built, minified production artifacts:

- npm packed and unpacked size.
- Packaged VSIX size.
- Independent browser builds for core, editor-core, and editor-react, with static and
  lazy chunks attributed separately.
- Playground initial, entry, CodeMirror lazy, and HyperFormula lazy chunks from the
  Vite manifest.
- Large renderer output bytes and expansion relative to source.

Deterministic size ceilings are approximately 10% above baseline.

| Artifact or surface                             |                  Baseline |
| ----------------------------------------------- | ------------------------: |
| npm tarball / unpacked                          | 217,790 / 1,030,081 bytes |
| VSIX                                            |             372,847 bytes |
| Browser core entry / lazy formula engine        |    57,191 / 696,609 bytes |
| Browser editor-core entry                       |              80,639 bytes |
| Browser editor-react entry / lazy dependencies  | 161,751 / 1,209,845 bytes |
| Playground initial / entry                      |   396,207 / 349,968 bytes |
| Playground CodeMirror / spreadsheet lazy chunks |   403,120 / 556,740 bytes |
| Large renderer output / source expansion        | 1,868,073 bytes / 8.1878x |

The browser builds externalize React peer dependencies. Lazy bytes are reported
separately instead of being hidden in one total. The browser suite verifies that the
source editor remains lazy at runtime.

## Commands and CI

```bash
npm run perf:runtime
npm run perf:sizes
npm run perf:check
```

`perf:runtime` and `perf:sizes` expect their production artifacts to exist.
`perf:check` performs all required builds before both checks. CI runs the combined
gate on the default branch and the weekly schedule. Pull requests continue to use the
faster quality, browser, and distribution gates; maintainers can run
`npm run perf:check` before merging performance-sensitive changes.

When an intentional change exceeds a ceiling:

1. Attribute the change to an operation, entry point, or dependency.
2. Optimize or explain the changed cost.
3. Record a new representative baseline only after review; never raise a ceiling just
   to make CI pass.

## Worker decision

Worker-backed parsing is deferred. The measured large typing and diagnostics paths
remain synchronous and below one reference frame, so a worker would currently add
message versioning, serialization, external-provenance, and stale-result complexity
without demonstrated benefit.

If typing or diagnostics exceeds its budget, first evaluate deferred derivation,
debouncing where source/revision updates remain immediate, and cancellation. A worker
is justified only after those measurements, and must keep source authoritative,
version messages, and discard stale results.
