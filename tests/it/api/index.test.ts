import { describe, expect, it } from "vitest";
import * as cello from "../../../packages/core/src/index.js";

describe("public API", () => {
  it("exports core functions", () => {
    expect(typeof cello.parse).toBe("function");
    expect(typeof cello.evaluate).toBe("function");
    expect(typeof cello.format).toBe("function");
    expect(typeof cello.render).toBe("function");
    expect(typeof cello.serialize).toBe("function");
    expect(typeof cello.validate).toBe("function");
  });

  it("validates cello text", async () => {
    await expect(cello.validate("@sheet S\n| A |")).resolves.toEqual({
      valid: true,
      diagnostics: []
    });
  });
});
