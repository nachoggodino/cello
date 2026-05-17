import { describe, expect, it } from "vitest";
import { renderPreview } from "./preview";

describe("renderPreview", () => {
  it("renders an interactive preview document", async () => {
    const result = await renderPreview("@sheet S\n| A | B |\n| 1 | 2 |");

    expect(result.html).toContain("<!doctype html>");
    expect(result.html).toContain("Cello Playground Preview");
    expect(result.html).toContain("<script>");
    expect(result.html).toContain("addEventListener");
    expect(result.diagnostics).toHaveLength(0);
  });

  it("reports browser-incompatible external sources as diagnostics", async () => {
    const result = await renderPreview("@sheet Data [csv]\n-> ./data.csv");
    const diagnostic = result.diagnostics[0];

    expect(diagnostic).toMatchObject({
      level: "warning",
      sheet: "Data"
    });
    expect(diagnostic?.message).toContain("External file sources are not available");
  });
});
