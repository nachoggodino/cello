import { describe, expect, it } from "vitest";
import * as cello from "../../src/index.js";

describe("public API", () => {
  it("exports core functions", () => {
    expect(typeof cello.parse).toBe("function");
    expect(typeof cello.evaluate).toBe("function");
    expect(typeof cello.render).toBe("function");
    expect(typeof cello.serialize).toBe("function");
  });
});

