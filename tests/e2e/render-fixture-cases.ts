import type { RenderFixtureCase } from "./helpers.js";

function fixture(name: string, title: string, covers: string[], contains: string[], notContains?: string[]): RenderFixtureCase {
  return { name, title, covers, contains, ...(notContains ? { notContains } : {}) };
}

const baseCases: RenderFixtureCase[] = [
  fixture(
    "anonymous-sheet",
    "Anonymous Sheet",
    ["1.core-structure", "3.blank-lines", "6.coordinate-formulas"],
    [">Sheet1<", "<td >Ana</td>", "<td >Luis</td>", "<td >7</td>", "<td >9</td>"]
  ),
  fixture(
    "external-source",
    "External Source",
    ["2.sheet-declaration", "4.external-source-line", "6.cross-sheet-formulas", "7.named-column-ranges"],
    [">Imported<", ">Summary<", "<td >25</td>", "<td >Slice</td>", "<td >FirstSheetAlias</td>"]
  ),
  fixture(
    "native-bylaws",
    "Native BYLAWS",
    ["4.header-rows", "6.formulas", "7.named-ranges", "10.modifiers", "11.inline-formatting"],
    [
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
  ),
  fixture(
    "header-rebinding",
    "Header Rebinding",
    ["4.header-rows", "7.named-column-ranges"],
    ["<th >Item</th>", "<th >Qty</th>", "<th >Amount</th>", "<th >Total</th>", "<td >10</td>"]
  ),
  fixture(
    "row-name-modifiers",
    "Row Modifiers",
    ["5.row-modifiers", "10.modifier-scope"],
    ['style="font-style:italic"', 'style="background:#fef3c7"', 'style="font-weight:700"', ">12</td>"]
  ),
  fixture(
    "formula-matrix",
    "Formula Matrix",
    ["6.formulas", "7.named-column-ranges"],
    ["<td >CrossA1</td>", "<td >CrossNamed</td>", "<td >LocalAlias</td>", "<td >Coord</td>", "<td >6</td>", "<td >5</td>"]
  ),
  fixture(
    "types-precedence",
    "Types and Precedence",
    ["9.inferred-types", "10.modifier-scope-precedence"],
    [
      '<td style="color:purple;font-style:italic;color:blue">42</td>',
      '<td style="background:#e5e7eb;color:#111111;font-style:italic;color:blue">2026-02-01</td>',
      '<td style="font-style:italic;color:blue">true</td>',
      '<td style="color:purple;color:red">TRUE</td>',
      '<td style="background:#e5e7eb;color:#111111;background:black;color:white">plain</td>',
      '<td style="color:orange">cell</td>'
    ]
  ),
  fixture(
    "comments-blanklines",
    "Comments and Blank Lines",
    ["3.blank-lines", "12.comments"],
    ["<td >Start</td>", "<td >End</td>", "<td >1</td>", "<td >2</td>"],
    ["lead comment", "spacer comment"]
  ),
  fixture(
    "format-matrix",
    "Format Matrix",
    ["2.sheet-formats", "4.header-rows"],
    [">CsvData<", ">Notes<", ">JsonData<", "<th >name</th>", "<th >title</th>", "<th >code</th>", '<span class="cello-bold">Lead</span>', "<td >32</td>", "<td >false</td>"]
  ),
  fixture(
    "defaults-formula-functions",
    "Defaults Formula Functions",
    ["6.formulas", "7.named-column-ranges", "10.modifiers"],
    [">Orders<", ">Report<", "<td >Pending</td>", "<td >2</td>", "<td >3</td>", "<td >0</td>", "<td >$6.00</td>"]
  ),
  fixture("merge-layout", "Merge Layout", ["8.merges", "11.inline-formatting"], ['colspan="3"', 'rowspan="2"', "<td >Alcala</td>", ">12</td>"]),
  fixture(
    "resilience-errors",
    "Resilience Errors",
    ["14.resilience-rule"],
    ["<td >1</td>", "<td >2</td>", "<td >3</td>", "<td >4</td>", "<td >#DIV/0!</td>", "<td >=1+</td>", "<td >#NAME?</td>", "<td >???</td>"]
  )
];

const generatedCaseSpecs: Array<[string, string, string[], string[], string[]?]> = [
  [
    "multi-native-kpis",
    "Multi Native KPIs",
    ["1.core-structure", "6.cross-sheet-formulas", "7.named-column-ranges", "10.modifiers"],
    [">Data<", ">Summary<", ">Regions<", "<td >650</td>", "<td >400</td>", ">€420.00</td>", ">€230.00</td>", ">8</td>", ">4</td>"]
  ],
  [
    "multi-chain-waterfall",
    "Multi Chain Waterfall",
    ["1.core-structure", "6.cross-sheet-formulas", "11.inline-formatting"],
    [">Data<", ">Stage1<", ">Stage2<", ">Board<", "<td >1000</td>", "<td >570</td>", "<td >0.57</td>", "<td >GO</td>"]
  ],
  [
    "multi-row-mod-style",
    "Multi Row Mod Style",
    ["5.row-modifiers", "6.cross-sheet-formulas", "10.modifier-scope"],
    [">Summary<", 'style="font-weight:700"', 'style="font-style:italic"', 'style="background:#fef3c7"', ">20</td>", ">6</td>", ">26</td>"]
  ],
  [
    "multi-merge-dashboard",
    "Multi Merge Dashboard",
    ["6.cross-sheet-formulas", "8.merges", "11.inline-formatting"],
    [">Dashboard<", 'colspan="3"', "<td >15</td>", "<td >38</td>", "<td >2.5333333333</td>", "<td >53</td>"]
  ],
  [
    "multi-comments-gaps",
    "Multi Comments Gaps",
    ["3.blank-lines", "6.cross-sheet-formulas", "12.comments"],
    [">Summary<", ">Audit<", "<td >35</td>", "<td >20</td>", "<td >5</td>", "<td >15</td>"],
    ["raw import", "gap comment"]
  ],
  [
    "multi-types-thresholds",
    "Multi Types Thresholds",
    ["6.cross-sheet-formulas", "9.inferred-types", "11.inline-formatting"],
    [">Data<", "<td >true</td>", "<td >false</td>", "<td >2026-01-01</td>", "<td >HIGH</td>", "<td >60</td>"]
  ],
  [
    "multi-header-rebind-cross",
    "Multi Header Rebind Cross",
    ["4.header-rows", "6.cross-sheet-formulas", "7.named-column-ranges"],
    [">Data<", "<th >Product</th>", "<th >Service</th>", "<th >Rate</th>", "<td >12</td>", "<td >70</td>", "<td >82</td>"]
  ],
  [
    "multi-resilience-chain",
    "Multi Resilience Chain",
    ["6.cross-sheet-formulas", "14.resilience-rule"],
    [">Calc<", "<td >10</td>", "<td >#DIV/0!</td>", "<td >=1+</td>", "<td >#REF!</td>"]
  ],
  [
    "multi-csv-regional-rollup",
    "Multi CSV Regional Rollup",
    ["2.sheet-formats", "6.cross-sheet-formulas", "7.named-column-ranges"],
    [">Data<", ">Summary<", ">Board<", "<td >500</td>", "<td >250</td>", "<td >11</td>", "<td >750</td>"]
  ],
  [
    "multi-csv-noheader-coords",
    "Multi CSV Noheader Coords",
    ["2.sheet-formats", "6.coordinate-formulas", "6.cross-sheet-formulas"],
    [">Summary<", "<td >100</td>", "<td >250</td>", "<td >6</td>", "<td >350</td>"]
  ],
  [
    "multi-tsv-ops-rollup",
    "Multi TSV Ops Rollup",
    ["2.sheet-formats", "6.cross-sheet-formulas", "7.named-column-ranges"],
    [">Data<", "<td >16</td>", "<td >19</td>", "<td >7</td>", "<td >35</td>"]
  ],
  [
    "multi-excel-budget-rollup",
    "Multi Excel Budget Rollup",
    ["2.sheet-formats", "6.cross-sheet-formulas", "7.named-column-ranges"],
    [">Summary<", "<td >630</td>", "<td >640</td>", "<td >10</td>", "<td >OVER</td>"]
  ],
  [
    "multi-markdown-scoreboard",
    "Multi Markdown Scoreboard",
    ["2.sheet-formats", "6.cross-sheet-formulas", "11.inline-formatting"],
    [">Summary<", "<td >24</td>", "<td >7</td>", "<td >31</td>", "<td >7</td>"]
  ],
  [
    "multi-json-inventory",
    "Multi JSON Inventory",
    ["2.sheet-formats", "6.cross-sheet-formulas", "7.named-column-ranges"],
    [">Summary<", "<td >13</td>", "<td >3</td>", "<td >10</td>", "<td >20</td>"]
  ],
  [
    "multi-json-bools-dates",
    "Multi JSON Bools Dates",
    ["2.sheet-formats", "6.cross-sheet-formulas", "9.inferred-types"],
    [">Data<", "<td >2026-02-01</td>", "<td >true</td>", "<td >false</td>", "<td >15</td>", "<td >7</td>"]
  ],
  [
    "multi-mixed-csv-json-native",
    "Multi Mixed CSV JSON Native",
    ["2.sheet-formats", "6.cross-sheet-formulas", "7.named-column-ranges"],
    [">Raw<", ">Targets<", ">Summary<", "<td >620</td>", "<td >500</td>", "<td >120</td>"]
  ],
  [
    "multi-mixed-markdown-json",
    "Multi Mixed Markdown JSON",
    ["2.sheet-formats", "6.cross-sheet-formulas", "11.inline-formatting"],
    [">Metrics<", ">Bench<", "<td >20</td>", "<td >4</td>", "<td >Watch</td>"]
  ],
  [
    "multi-alias-many-sheets",
    "Multi Alias Many Sheets",
    ["6.cross-sheet-formulas", "6.first-sheet-alias", "7.named-column-ranges"],
    [">CalcA<", ">CalcB<", ">Final<", "<td >12</td>", "<td >6</td>", "<td >18</td>", "<td >20</td>"]
  ],
  [
    "multi-slice-window-chain",
    "Multi Slice Window Chain",
    ["6.cross-sheet-formulas", "6.first-sheet-alias", "7.named-column-ranges"],
    [">Window<", "<td >60</td>", "<td >9</td>", "<td >69</td>"]
  ],
  [
    "multi-modifier-precedence-cross",
    "Multi Modifier Precedence Cross",
    ["6.cross-sheet-formulas", "10.modifier-scope-precedence", "11.inline-formatting"],
    [
      ">Summary<",
      'style="background:#e5e7eb;color:#111111;font-style:italic;color:#008000"',
      'style="color:purple;font-weight:700;background:#fef3c7"',
      'style="background:#e5e7eb;color:#111111;font-weight:700;background:#fef3c7;background:black;color:#fff"',
      "<td >20</td>"
    ]
  ],
  [
    "multi-external-firstsheet",
    "Multi External Firstsheet",
    ["2.sheet-formats", "4.external-source-line", "6.cross-sheet-formulas"],
    [">Imported<", ">Summary<", ">Review<", "<td >25</td>", "<td >9</td>", "<td >34</td>"]
  ],
  [
    "multi-semicolon-custom-delim",
    "Multi Semicolon Custom Delim",
    ["2.sheet-formats", "6.cross-sheet-formulas", "7.named-column-ranges"],
    [">Data<", "<td >15</td>", "<td >9</td>", "<td >24</td>"]
  ]
];

export const renderFixtureCases: RenderFixtureCase[] = [
  ...baseCases,
  ...generatedCaseSpecs.map(([name, title, covers, contains, notContains]) => fixture(name, title, covers, contains, notContains))
];
