import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { validate } from "../../packages/core/src/validator/validate.js";

const fixturesDir = join("tests", "e2e", "fixtures");

describe("validate e2e fixtures", () => {
  it("validates a feature-rich workbook fixture", async () => {
    const text = await readFile(join(fixturesDir, "multi-native-kpis.cel"), "utf8");

    await expect(validate(text, { baseDir: process.cwd() })).resolves.toEqual({
      valid: true,
      diagnostics: []
    });
  });

  it("reports diagnostics for a resilient workbook fixture", async () => {
    const text = await readFile(join(fixturesDir, "resilience-errors.cel"), "utf8");
    const result = await validate(text, { baseDir: process.cwd() });

    expect(result.valid).toBe(false);
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });
});
