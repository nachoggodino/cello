import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { startServe } from "../../packages/cli/src/serve.js";

describe("serve e2e fixtures", () => {
  it("serves a fixture workbook over http", async () => {
    const handle = await startServe(join("tests", "e2e", "fixtures", "multi-native-kpis.cel"), { port: 0 });
    try {
      const response = await fetch(handle.url);
      const html = await response.text();

      expect(handle.url).toMatch(/\/multi-native-kpis\.cel$/);
      expect(response.status).toBe(200);
      expect(html).toContain("cello-workbook");
      expect(html).toContain("Regions");
    } finally {
      await handle.close();
    }
  });
});
