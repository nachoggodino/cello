import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { render } from "../dist/renderer/render.js";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const fixturesDir = join(root, "tests", "e2e", "fixtures");
const casesFile = join(root, "tests", "e2e", "render-fixture-cases.ts");

const cases = [
  {
    name: "multi-native-kpis",
    title: "Multi Native KPIs",
    covers: ["1.core-structure", "6.cross-sheet-formulas", "7.named-column-ranges", "10.modifiers"],
    contains: [">Data<", ">Summary<", ">Regions<", "<td >650</td>", "<td >400</td>", ">420</td>", ">230</td>"],
    cel: `@sheet Data
-Date-Region-Amount-Units-
| 2026-01-01 | Madrid | 120 | 2 |
| 2026-01-02 | Barcelona | 80 | 1 |
| 2026-01-03 | Madrid | 200 | 4 |
| 2026-01-04 | Barcelona | 150 | 3 |
| 2026-01-05 | Madrid | 100 | 2 |

@sheet Summary
-Metric-Value-
| ## Revenue | < |
| Total amount | =SUM(!!Amount) |
| First window | =SUM(!!Amount[2:4]) |
| Total units | =SUM(!!Units) |

@sheet Regions
-Region-Revenue[€][2d]-Units[0d]-
row_madrid[bold] | Madrid | =SUMIF(Data!Region,"Madrid",Data!Amount) | =SUMIF(Data!Region,"Madrid",Data!Units) |
row_barcelona[italic] | Barcelona | =SUMIF(Data!Region,"Barcelona",Data!Amount) | =SUMIF(Data!Region,"Barcelona",Data!Units) |`
  },
  {
    name: "multi-chain-waterfall",
    title: "Multi Chain Waterfall",
    covers: ["1.core-structure", "6.cross-sheet-formulas", "11.inline-formatting"],
    contains: [">Data<", ">Stage1<", ">Stage2<", ">Board<", "<td >1000</td>", "<td >570</td>", "<td >0.57</td>", "<td >GO</td>"],
    cel: `@sheet Data
-Revenue-Cost-
| 300 | 120 |
| 260 | 110 |
| 440 | 200 |

@sheet Stage1
-Metric-Value-
| Revenue | =SUM(!!Revenue) |
| Cost | =SUM(!!Cost) |
| Gross | =B2-B3 |

@sheet Stage2
-Metric-Value-
| MarginPct | =Stage1!B4/Stage1!B2 |
| Gate | =IF(B2>0.5,"GO","HOLD") |

@sheet Board
-Label-Value-
| *Gross* | =Stage1!B4 |
| _Margin_ | =Stage2!B2 |
| ~~Gate~~ | =Stage2!B3 |`
  },
  {
    name: "multi-row-mod-style",
    title: "Multi Row Mod Style",
    covers: ["5.row-name-references", "6.cross-sheet-formulas", "10.modifier-scope"],
    contains: [">Summary<", 'style="font-weight:700"', 'style="font-style:italic"', 'style="background:#fef3c7"', ">20</td>", ">6</td>", ">26</td>"],
    notContains: ["row_sales", "row_units", "row_total"],
    cel: `@sheet Data
-Amount-Qty-
| 5 | 2 |
| 9 | 1 |
| 6 | 3 |

@sheet Summary
-Metric-Value-
row_sales[bold] | Total sales | =SUM(!!Amount) |
row_units[italic] | Total units | =SUM(!!Qty) |
row_total[bg:#fef3c7] | Carry | =B2+B3 |

@sheet Review
-Check-Value-
| Final | =Summary!B4 |
| Delta | =Summary!B2-Summary!B3 |`
  },
  {
    name: "multi-merge-dashboard",
    title: "Multi Merge Dashboard",
    covers: ["6.cross-sheet-formulas", "8.merges", "11.inline-formatting"],
    contains: [">Dashboard<", 'colspan="3"', "<td >15</td>", "<td >38</td>", "<td >2.5333333333</td>", "<td >53</td>"],
    cel: `@sheet Data
-Team-Jobs-Hours-
| A | 4 | 8 |
| B | 5 | 14 |
| C | 6 | 16 |

@sheet Dashboard
-Label-Value-Note-
| ## Ops Dashboard | < | < |
| Total jobs | =SUM(!!Jobs) | ok |
| Total hours | =SUM(!!Hours) | ok |
| Avg hours | =SUM(!!Hours)/SUM(!!Jobs) | ok |

@sheet Notes
-Metric-Value-
| Board total | =Dashboard!B3+Dashboard!B4 |
| Avg copy | =Dashboard!B5 |`
  },
  {
    name: "multi-comments-gaps",
    title: "Multi Comments Gaps",
    covers: ["3.blank-lines", "6.cross-sheet-formulas", "12.comments"],
    contains: [">Summary<", ">Audit<", "<td >35</td>", "<td >20</td>", "<td >5</td>", "<td >15</td>"],
    notContains: ["raw import", "gap comment"],
    cel: `// raw import
@sheet Data
-Metric-Value-
| A | 10 |

// gap comment
| B | 20 |
| C | 5 |

@sheet Summary
-Metric-Value-
| Total | =SUM(Data!Value) |
| Max | =MAX(Data!Value) |
| Min | =MIN(Data!Value) |

@sheet Audit
-Metric-Value-
| Spread | =Summary!B3-Summary!B4 |
| Recheck | =Summary!B2 |`
  },
  {
    name: "multi-types-thresholds",
    title: "Multi Types Thresholds",
    covers: ["6.cross-sheet-formulas", "9.inferred-types", "11.inline-formatting"],
    contains: [">Data<", "<td >true</td>", "<td >false</td>", "<td >2026-01-01</td>", "<td >HIGH</td>", "<td >60</td>"],
    cel: `@sheet Data
-Label-Amount-Live-Start-Note-
| Alpha | 10 | TRUE | 2026-01-01 | "TRUE" |
| Beta | 20 | FALSE | 2026-01-02 | "123" |
| Gamma | 30 | TRUE | 2026-01-03 | plain |

@sheet Summary
-Metric-Value-
| Total amount | =SUM(!!Amount) |
| Gate | =IF(B2>50,"HIGH","OK") |
| First start | =Data!D2 |

@sheet Review
-Metric-Value-
| Carry | =Summary!B2 |
| Date copy | =Summary!B4 |`
  },
  {
    name: "multi-header-rebind-cross",
    title: "Multi Header Rebind Cross",
    covers: ["4.header-rows", "6.cross-sheet-formulas", "7.named-column-ranges"],
    contains: [">Data<", "<th >Product</th>", "<th >Service</th>", "<th >Rate</th>", "<td >12</td>", "<td >70</td>", "<td >82</td>"],
    cel: `@sheet Data
-Product-Amount-
| A | 5 |
| B | 7 |
-Service-Hours-Rate-
| Audit | 2 | 40 |
| Support | 3 | 30 |

@sheet Summary
-Metric-Value-
| Product total | =Data!B2+Data!B3 |
| Service rate total | =Data!C5+Data!C6 |

@sheet Review
-Metric-Value-
| Carry | =Summary!B2+Summary!B3 |
| Hours | =Data!B5+Data!B6 |`
  },
  {
    name: "multi-resilience-chain",
    title: "Multi Resilience Chain",
    covers: ["6.cross-sheet-formulas", "14.resilience-rule"],
    contains: [">Calc<", "<td >10</td>", "<td >#DIV/0!</td>", "<td >=1+</td>", "<td >#REF!</td>"],
    cel: `@sheet Data
-Base-Zero-
| 10 | 0 |

@sheet Calc
-Label-Value-
| Safe | =SUM(!!Base) |
| Div0 | =Data!A2/Data!B2 |
| RawBad | =1+ |
| Unknown | =Ghost!A1 |

@sheet Bridge
-Label-Value-
| Copy safe | =Calc!B2 |
| Copy err | =Calc!B3 |`
  },
  {
    name: "multi-csv-regional-rollup",
    title: "Multi CSV Regional Rollup",
    covers: ["2.sheet-formats", "6.cross-sheet-formulas", "7.named-column-ranges"],
    contains: [">Data<", ">Summary<", ">Board<", "<td >500</td>", "<td >250</td>", "<td >11</td>", "<td >750</td>"],
    cel: `@sheet Data [csv]
region,amount,units
North,200,3
South,120,2
North,300,5
South,130,1

@sheet Summary
-Metric-Value-
| North sales | =SUMIF(Data!region,"North",Data!amount) |
| South sales | =SUMIF(Data!region,"South",Data!amount) |
| Total units | =SUM(Data!units) |

@sheet Board
-Metric-Value-
| Combined | =Summary!B2+Summary!B3 |
| Units copy | =Summary!B4 |`
  },
  {
    name: "multi-csv-noheader-coords",
    title: "Multi CSV Noheader Coords",
    covers: ["2.sheet-formats", "6.coordinate-formulas", "6.cross-sheet-formulas"],
    contains: [">Summary<", "<td >100</td>", "<td >250</td>", "<td >6</td>", "<td >350</td>"],
    cel: `@sheet Data [csv:noheader]
2026-01-01,100,2
2026-01-02,150,1
2026-01-03,90,3

@sheet Summary
-Label-Value-
| First amount | =Data!B1 |
| First two amount | =Data!B1+Data!B2 |
| Total qty | =Data!C1+Data!C2+Data!C3 |

@sheet Board
-Label-Value-
| Carry | =Summary!B2+Summary!B3 |
| Qty copy | =Summary!B4 |`
  },
  {
    name: "multi-tsv-ops-rollup",
    title: "Multi TSV Ops Rollup",
    covers: ["2.sheet-formats", "6.cross-sheet-formulas", "7.named-column-ranges"],
    contains: [">Data<", "<td >16</td>", "<td >19</td>", "<td >7</td>", "<td >35</td>"],
    cel: `@sheet Data [tsv]
team\ttickets\thours
Blue\t4\t6
Red\t7\t8
Green\t5\t5

@sheet Summary
-Metric-Value-
| Tickets | =SUM(Data!tickets) |
| Hours | =SUM(Data!hours) |
| Max hours | =MAX(Data!hours) |

@sheet Review
-Metric-Value-
| Load | =Summary!B2+Summary!B3 |
| Ceiling | =Summary!B4 |`
  },
  {
    name: "multi-excel-budget-rollup",
    title: "Multi Excel Budget Rollup",
    covers: ["2.sheet-formats", "6.cross-sheet-formulas", "7.named-column-ranges"],
    contains: [">Summary<", "<td >630</td>", "<td >640</td>", "<td >10</td>", "<td >OVER</td>"],
    cel: `@sheet Data [excel]
item;plan;actual
Hosting;300;320
Tools;120;100
Ops;210;220

@sheet Summary
-Metric-Value-
| Plan | =SUM(Data!plan) |
| Actual | =SUM(Data!actual) |
| Diff | =B3-B2 |

@sheet Review
-Metric-Value-
| Status | =IF(Summary!B3>Summary!B2,"OVER","OK") |
| Diff copy | =Summary!B4 |`
  },
  {
    name: "multi-markdown-scoreboard",
    title: "Multi Markdown Scoreboard",
    covers: ["2.sheet-formats", "6.cross-sheet-formulas", "11.inline-formatting"],
    contains: [">Summary<", "<td >24</td>", "<td >7</td>", "<td >31</td>", "<td >7</td>"],
    cel: `@sheet Data [markdown]
| name | score | bonus |
| ---- | ----: | ----: |
| Ana | 7 | 1 |
| Luis | 6 | 2 |
| Sara | 5 | 3 |
| Pedro | 6 | 1 |

@sheet Summary
-Metric-Value-
| Score total | =SUM(Data!score) |
| Top score | =MAX(Data!score) |
| With bonus | =SUM(Data!score)+SUM(Data!bonus) |

@sheet Awards
-Metric-Value-
| Winner line | =Summary!B3 |
| Bonus line | =Summary!B4-Summary!B2 |`
  },
  {
    name: "multi-json-inventory",
    title: "Multi JSON Inventory",
    covers: ["2.sheet-formats", "6.cross-sheet-formulas", "7.named-column-ranges"],
    contains: [">Summary<", "<td >13</td>", "<td >3</td>", "<td >10</td>", "<td >20</td>"],
    cel: `@sheet Data [json]
[
  { "sku": "A1", "stock": 5, "reserved": 2 },
  { "sku": "B2", "stock": 8, "reserved": 1 }
]

@sheet Summary
-Metric-Value-
| Stock | =SUM(Data!stock) |
| Reserved | =SUM(Data!reserved) |
| Available | =B2-B3 |

@sheet Orders
-Metric-Value-
| Double available | =Summary!B4*2 |
| Copy stock | =Summary!B2 |`
  },
  {
    name: "multi-json-bools-dates",
    title: "Multi JSON Bools Dates",
    covers: ["2.sheet-formats", "6.cross-sheet-formulas", "9.inferred-types"],
    contains: [">Data<", "<td >2026-02-01</td>", "<td >true</td>", "<td >false</td>", "<td >15</td>", "<td >7</td>"],
    cel: `@sheet Data [json]
[
  { "day": "2026-02-01", "hours": 6, "active": true },
  { "day": "2026-02-02", "hours": 7, "active": false },
  { "day": "2026-02-03", "hours": 2, "active": true }
]

@sheet Summary
-Metric-Value-
| Hours | =SUM(Data!hours) |
| Peak | =MAX(Data!hours) |
| First day | =Data!A2 |

@sheet Review
-Metric-Value-
| Carry | =Summary!B2 |
| Peak copy | =Summary!B3 |`
  },
  {
    name: "multi-mixed-csv-json-native",
    title: "Multi Mixed CSV JSON Native",
    covers: ["2.sheet-formats", "6.cross-sheet-formulas", "7.named-column-ranges"],
    contains: [">Raw<", ">Targets<", ">Summary<", "<td >620</td>", "<td >500</td>", "<td >120</td>"],
    cel: `@sheet Raw [csv]
region,sales
North,200
South,180
East,240

@sheet Targets [json]
[
  { "region": "North", "target": 150 },
  { "region": "South", "target": 170 },
  { "region": "East", "target": 180 }
]

@sheet Summary
-Metric-Value-
| Sales | =SUM(Raw!sales) |
| Target | =SUM(Targets!target) |
| Gap | =B2-B3 |

@sheet Board
-Metric-Value-
| Gap copy | =Summary!B4 |
| Sales copy | =Summary!B2 |`
  },
  {
    name: "multi-mixed-markdown-json",
    title: "Multi Mixed Markdown JSON",
    covers: ["2.sheet-formats", "6.cross-sheet-formulas", "11.inline-formatting"],
    contains: [">Metrics<", ">Bench<", "<td >20</td>", "<td >4</td>", "<td >Watch</td>"],
    cel: `@sheet Metrics [markdown]
| label | value |
| ----- | ----: |
| latency | 120 |
| uptime | 99 |
| incidents | 2 |

@sheet Bench [json]
[
  { "target": 100, "floor": 95 }
]

@sheet Summary
-Metric-Value-
| Latency gap | =Metrics!B2-Bench!A2 |
| Uptime gap | =Metrics!B3-Bench!B2 |
| Status | =IF(B2>0,"Watch","OK") |

@sheet Notes
-Metric-Value-
| Copy | =Summary!B4 |
| Gap | =Summary!B2 |`
  },
  {
    name: "multi-alias-many-sheets",
    title: "Multi Alias Many Sheets",
    covers: ["6.cross-sheet-formulas", "6.first-sheet-alias", "7.named-column-ranges"],
    contains: [">CalcA<", ">CalcB<", ">Final<", "<td >12</td>", "<td >6</td>", "<td >18</td>", "<td >20</td>"],
    cel: `@sheet Data
-Amount-Qty-
| 3 | 1 |
| 4 | 2 |
| 5 | 3 |

@sheet CalcA
-Metric-Value-
| Sum amount | =SUM(!!Amount) |

@sheet CalcB
-Metric-Value-
| Sum qty | =SUM(!!Qty) |
| Ratio | =SUM(!!Amount)/SUM(!!Qty) |

@sheet Final
-Metric-Value-
| Combined | =CalcA!B2+CalcB!B2 |
| Ratio x10 | =CalcB!B3*10 |`
  },
  {
    name: "multi-slice-window-chain",
    title: "Multi Slice Window Chain",
    covers: ["6.cross-sheet-formulas", "6.first-sheet-alias", "7.named-column-ranges"],
    contains: [">Window<", "<td >60</td>", "<td >9</td>", "<td >69</td>"],
    cel: `@sheet Data
-Amount-Units-
| 10 | 1 |
| 20 | 2 |
| 30 | 3 |
| 40 | 4 |
| 50 | 5 |

@sheet Window
-Metric-Value-
| Amount slice | =SUM(!!Amount[2:4]) |
| Unit slice | =SUM(!!Units[3:5]) |

@sheet Final
-Metric-Value-
| Carry | =Window!B2+Window!B3 |
| Amount copy | =Window!B2 |`
  },
  {
    name: "multi-modifier-precedence-cross",
    title: "Multi Modifier Precedence Cross",
    covers: ["6.cross-sheet-formulas", "10.modifier-scope-precedence", "11.inline-formatting"],
    contains: [">Summary<", 'style="background:#e5e7eb;color:#111111;font-style:italic;color:#008000"', 'style="color:purple;font-weight:700;background:#fef3c7"', 'style="background:#e5e7eb;color:#111111;font-weight:700;background:#fef3c7;background:black;color:#fff"', "<td >20</td>"],
    notContains: ["row_total", "row_flag"],
    cel: `@sheet Data
-Amount-
| 8 |
| 12 |

@sheet Summary
-Metric[color:purple]-Value[bg:#e5e7eb][#111111]-
row_total[italic][#008000] | Total | =SUM(!!Amount) |
row_flag[bold][bg:#fef3c7] | Flag | high[bg:black][#fff] |

@sheet Review
-Label-Value-
| Mirror | =Summary!B2 |
| Copy | =Summary!B2 |`
  },
  {
    name: "multi-external-firstsheet",
    title: "Multi External Firstsheet",
    covers: ["2.sheet-formats", "4.external-source-line", "6.cross-sheet-formulas"],
    contains: [">Imported<", ">Summary<", ">Review<", "<td >25</td>", "<td >9</td>", "<td >34</td>"],
    cel: `@sheet Imported [csv]
-> ./tests/e2e/fixtures/multi-external-firstsheet.csv

@sheet Summary
-Metric-Value-
| Total amount | =SUM(Imported!amount) |
| Total qty | =SUM(Imported!qty) |

@sheet Review
-Metric-Value-
| Carry | =Summary!B2+Summary!B3 |
| Qty copy | =Summary!B3 |`
  },
  {
    name: "multi-semicolon-custom-delim",
    title: "Multi Semicolon Custom Delim",
    covers: ["2.sheet-formats", "6.cross-sheet-formulas", "7.named-column-ranges"],
    contains: [">Data<", "<td >15</td>", "<td >9</td>", "<td >24</td>"],
    cel: `@sheet Data [;]
city;amount;qty
Madrid;5;2
Sevilla;4;3
Bilbao;6;4

@sheet Summary
-Metric-Value-
| Amount | =SUM(Data!amount) |
| Qty | =SUM(Data!qty) |

@sheet Review
-Metric-Value-
| Carry | =Summary!B2+Summary!B3 |
| Amount copy | =Summary!B2 |`
  }
];

const manualCases = String.raw`import type { RenderFixtureCase } from "./helpers.js";

export const renderFixtureCases: RenderFixtureCase[] = [
  {
    name: "anonymous-sheet",
    title: "Anonymous Sheet",
    covers: ["1.core-structure", "3.blank-lines", "6.coordinate-formulas"],
    contains: [">Sheet1<", "<td >Ana</td>", "<td >Luis</td>", "<td >7</td>", "<td >9</td>"]
  },
  {
    name: "external-source",
    title: "External Source",
    covers: ["2.sheet-declaration", "4.external-source-line", "6.cross-sheet-formulas", "7.named-column-ranges"],
    contains: [">Imported<", ">Summary<", "<td >25</td>", "<td >Slice</td>", "<td >FirstSheetAlias</td>"]
  },
  {
    name: "native-bylaws",
    title: "Native BYLAWS",
    covers: ["4.header-rows", "6.formulas", "7.named-ranges", "10.modifiers", "11.inline-formatting"],
    contains: [
      '<span class="cello-bold">North</span>',
      'style="background:#fff9c4"',
      'style="font-style:italic"',
      'style="font-weight:700"',
      '<span class="cello-h1">TOTAL</span>',
      '<span class="cello-h2">Revenue</span>',
      "<del>legacy</del>",
      ">25</td>",
      "<td >2026-01-01</td>",
      "<td >TRUE</td>"
    ]
  },
  {
    name: "header-rebinding",
    title: "Header Rebinding",
    covers: ["4.header-rows", "7.named-column-ranges"],
    contains: ["<th >Item</th>", "<th >Qty</th>", "<th >Amount</th>", "<th >Total</th>", "<td >10</td>"]
  },
  {
    name: "row-name-modifiers",
    title: "Row Name Modifiers",
    covers: ["5.row-name-references", "10.modifier-scope"],
    contains: ['style="font-style:italic"', 'style="background:#fef3c7"', 'style="font-weight:700"', ">12</td>"],
    notContains: ["row_alpha", "row_beta", "row_total"]
  },
  {
    name: "formula-matrix",
    title: "Formula Matrix",
    covers: ["6.formulas", "7.named-column-ranges"],
    contains: ["<td >CrossA1</td>", "<td >CrossNamed</td>", "<td >LocalAlias</td>", "<td >Coord</td>", "<td >6</td>", "<td >5</td>"]
  },
  {
    name: "types-precedence",
    title: "Types and Precedence",
    covers: ["9.inferred-types", "10.modifier-scope-precedence"],
    contains: [
      "<td style=\"color:purple;font-style:italic;color:blue\">42</td>",
      "<td style=\"background:#e5e7eb;color:#111111;font-style:italic;color:blue\">2026-02-01</td>",
      "<td style=\"font-style:italic;color:blue\">true</td>",
      "<td style=\"color:purple;color:red\">TRUE</td>",
      "<td style=\"background:#e5e7eb;color:#111111;background:black;color:white\">plain</td>",
      "<td style=\"color:orange\">cell</td>"
    ]
  },
  {
    name: "comments-blanklines",
    title: "Comments and Blank Lines",
    covers: ["3.blank-lines", "12.comments"],
    contains: ["<td >Start</td>", "<td >End</td>", "<td >1</td>", "<td >2</td>"],
    notContains: ["lead comment", "spacer comment"]
  },
  {
    name: "format-matrix",
    title: "Format Matrix",
    covers: ["2.sheet-formats", "4.header-rows"],
    contains: [">CsvData<", ">Notes<", ">JsonData<", "<th >name</th>", "<th >title</th>", "<th >code</th>", '<span class="cello-bold">Lead</span>', "<td >32</td>", "<td >false</td>"]
  },
  {
    name: "merge-layout",
    title: "Merge Layout",
    covers: ["8.merges", "11.inline-formatting"],
    contains: ['colspan="3"', 'rowspan="2"', "<td >Alcala</td>", ">12</td>"]
  },
  {
    name: "resilience-errors",
    title: "Resilience Errors",
    covers: ["14.resilience-rule"],
    contains: ["<td >1</td>", "<td >2</td>", "<td >3</td>", "<td >4</td>", "<td >#DIV/0!</td>", "<td >=1+</td>", "<td >#NAME?</td>", "<td >???</td>"]
  }
`;

await mkdir(fixturesDir, { recursive: true });
await writeFile(join(fixturesDir, "multi-external-firstsheet.csv"), "region,amount,qty\nNorth,10,4\nSouth,15,5\n", "utf8");

for (const fixture of cases) {
  await writeFile(join(fixturesDir, `${fixture.name}.cel`), `${fixture.cel}\n`, "utf8");
  const html = await render(fixture.cel, { title: fixture.title, baseDir: root });
  await writeFile(join(fixturesDir, `${fixture.name}.view.html`), `${extractWorkbookViewHtml(html)}\n`, "utf8");
}

const generatedEntries = cases.map((fixture) => toTsEntry(fixture)).join(",\n");
const casesSource = `${manualCases},\n  // generated multi-sheet cases start\n${generatedEntries}\n  // generated multi-sheet cases end\n];\n`;
await writeFile(casesFile, casesSource, "utf8");

function normalizeHtml(html) {
  return html.replace(/\r\n/g, "\n").trim();
}

function extractWorkbookViewHtml(fullDocumentHtml) {
  const marker = '<div class="cello-workbook">';
  const start = fullDocumentHtml.indexOf(marker);
  if (start === -1) throw new Error("Rendered HTML missing workbook container.");
  const scriptTagStart = fullDocumentHtml.indexOf("<script>", start);
  if (scriptTagStart === -1) throw new Error("Rendered HTML missing script section.");
  return normalizeHtml(fullDocumentHtml.slice(start, scriptTagStart));
}

function toTsEntry(fixture) {
  const lines = [
    "  {",
    `    name: ${JSON.stringify(fixture.name)},`,
    `    title: ${JSON.stringify(fixture.title)},`,
    `    covers: ${JSON.stringify(fixture.covers)},`,
    `    contains: ${JSON.stringify(fixture.contains)}${fixture.notContains ? "," : ""}`
  ];
  if (fixture.notContains) {
    lines.push(`    notContains: ${JSON.stringify(fixture.notContains)}`);
  }
  lines.push("  }");
  return lines.join("\n");
}
