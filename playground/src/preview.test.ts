import { describe, expect, it } from "vitest";
import { renderPreview } from "./preview";

describe("renderPreview", () => {
  it("renders a script-free preview document", async () => {
    const result = await renderPreview("@sheet S\n| A | B |\n| 1 | 2 |");

    expect(result.html).toContain("<!doctype html>");
    expect(result.html).toContain("Cello Playground Preview");
    expect(result.html).not.toContain("<script>");
    expect(result.diagnostics).toHaveLength(0);
  });

  it("reports browser-incompatible external sources as diagnostics", async () => {
    const result = await renderPreview("@sheet Data [csv]\n-> ./data.csv");

    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        level: "warning",
        sheet: "Data",
        message: expect.stringContaining("External file sources are not available")
      })
    ]);
  });
});
