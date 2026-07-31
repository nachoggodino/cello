export const PERFORMANCE_SCENARIOS = {
  small: { rows: 20, columns: 6 },
  medium: { rows: 250, columns: 12 },
  large: { rows: 1_500, columns: 16 }
};

export function createNativeWorkbook({ rows, columns }) {
  const headers = Array.from({ length: columns }, (_, index) => `Column${index + 1}`);
  const lines = ["@sheet Native", `@header | ${headers.join(" | ")} |`];
  for (let row = 1; row <= rows; row += 1) {
    const cells = headers.map((_, column) => createValue(row, column));
    lines.push(`| ${cells.join(" | ")} |`);
  }
  return lines.join("\n");
}

export function createFormulaWorkbook(rows) {
  const lines = ["@sheet Formula", "@header | Quantity | Price | Total | Running |"];
  for (let row = 1; row <= rows; row += 1) {
    lines.push(`| ${(row % 9) + 1} | ${((row % 17) + 1) / 2} | =Quantity*Price | =SUM(Total) |`);
  }
  return lines.join("\n");
}

export function createForeignWorkbook({ rows, columns }) {
  return {
    source: "@sheet Foreign [csv]\n-> representative.csv",
    externalText: createCsv(rows, columns)
  };
}

export function describePerformanceFixtures() {
  return Object.fromEntries(
    Object.entries(PERFORMANCE_SCENARIOS).map(([name, scenario]) => {
      const native = createNativeWorkbook(scenario);
      const foreign = createForeignWorkbook(scenario);
      return [
        name,
        {
          rows: scenario.rows,
          columns: scenario.columns,
          nativeBytes: Buffer.byteLength(native),
          foreignBytes: Buffer.byteLength(foreign.externalText)
        }
      ];
    })
  );
}

function createCsv(rows, columns) {
  const headers = Array.from({ length: columns }, (_, index) => `column_${index + 1}`);
  const lines = [headers.join(",")];
  for (let row = 1; row <= rows; row += 1) {
    lines.push(headers.map((_, column) => escapeCsv(createValue(row, column))).join(","));
  }
  return lines.join("\n");
}

function createValue(row, column) {
  switch (column % 4) {
    case 0:
      return String(row * (column + 1));
    case 1:
      return `Item ${row}-${column + 1}`;
    case 2:
      return row % 2 === 0 ? "true" : "false";
    default:
      return ((row * (column + 3)) / 10).toFixed(2);
  }
}

function escapeCsv(value) {
  if (!/[,"\n]/.test(value)) {
    return value;
  }
  return `"${value.replaceAll('"', '""')}"`;
}
