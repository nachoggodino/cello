import { describe, expect, it } from "vitest";
import * as cello from "../../../packages/core/src/index.js";

describe("public API", () => {
  it("exports core functions", () => {
    expect(typeof cello.parse).toBe("function");
    expect(typeof cello.parseDocument).toBe("function");
    expect(typeof cello.evaluate).toBe("function");
    expect(typeof cello.format).toBe("function");
    expect(typeof cello.formatSource).toBe("function");
    expect(typeof cello.render).toBe("function");
    expect(typeof cello.validate).toBe("function");
    expect("serialize" in cello).toBe(false);
  });

  it("validates cello text", async () => {
    await expect(cello.validate("@sheet S\n| A |")).resolves.toEqual({
      valid: true,
      diagnostics: []
    });
  });
});
