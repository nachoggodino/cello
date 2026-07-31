import { formatSource } from "@nachoggodino/cello";

describe("published Cello formatter", () => {
  it("formats Cello tables for extension formatting", () => {
    expect(formatSource("@sheet S\n| A | Long |\n| 1 | 2 |", { layout: "pretty" })).toBe("@sheet S\n| A | Long |\n| 1 | 2    |");
  });
});
