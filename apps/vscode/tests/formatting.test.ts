import { format as formatCello } from "@nachoggodino/cello";

describe("published Cello formatter", () => {
  it("formats Cello tables for extension formatting", () => {
    expect(formatCello("@sheet S\n| A | Long |\n| 1 | 2 |")).toBe("@sheet S\n| A | Long |\n| 1 | 2    |");
  });
});
