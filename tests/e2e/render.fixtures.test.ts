import { describe, expect, it } from "vitest";
import { renderFixtureCases } from "./render-fixture-cases.js";
import { assertRenderFixture, assertRenderShape, renderFixture } from "./helpers.js";

describe("render e2e fixtures", () => {
  for (const fixture of renderFixtureCases) {
    it(`renders ${fixture.name} with expected structure`, async () => {
      const { actual, workbook } = await renderFixture(fixture);
      assertRenderShape(actual, workbook);
      assertRenderFixture(fixture, actual);
      expect(actual).toContain('<div class="cello-workbook">');
    });
  }
});
