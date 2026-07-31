import { describe, expect, it } from "vitest";
import { resolveExternalSourcePath } from "../../../packages/core/src/shared/external-path.js";

describe("resolveExternalSourcePath", () => {
  it.each([
    ["/workspace/data", "../shared/rows.csv", "/workspace/shared/rows.csv"],
    ["/workspace/data/", "./rows.csv", "/workspace/data/rows.csv"],
    [".", "data/rows.csv", "data/rows.csv"],
    ["C:\\workspace\\data", "..\\shared\\rows.csv", "C:/workspace/shared/rows.csv"],
    ["/workspace", "/absolute/rows.csv", "/absolute/rows.csv"]
  ])("resolves %s plus %s lexically", (baseDir, requestedPath, expected) => {
    expect(resolveExternalSourcePath(baseDir, requestedPath)).toBe(expected);
  });

  it("does not traverse above an absolute root", () => {
    expect(resolveExternalSourcePath("/workspace", "../../../etc/passwd")).toBe("/etc/passwd");
  });
});
