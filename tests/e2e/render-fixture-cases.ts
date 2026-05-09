import type { RenderFixtureCase } from "./helpers.js";

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
,
  // generated multi-sheet cases start
  {
    name: "multi-native-kpis",
    title: "Multi Native KPIs",
    covers: ["1.core-structure","6.cross-sheet-formulas","7.named-column-ranges","10.modifiers"],
    contains: [">Data<",">Summary<",">Regions<","<td >650</td>","<td >400</td>",">420</td>",">230</td>"]
  },
  {
    name: "multi-chain-waterfall",
    title: "Multi Chain Waterfall",
    covers: ["1.core-structure","6.cross-sheet-formulas","11.inline-formatting"],
    contains: [">Data<",">Stage1<",">Stage2<",">Board<","<td >1000</td>","<td >570</td>","<td >0.57</td>","<td >GO</td>"]
  },
  {
    name: "multi-row-mod-style",
    title: "Multi Row Mod Style",
    covers: ["5.row-name-references","6.cross-sheet-formulas","10.modifier-scope"],
    contains: [">Summary<","style=\"font-weight:700\"","style=\"font-style:italic\"","style=\"background:#fef3c7\"",">20</td>",">6</td>",">26</td>"],
    notContains: ["row_sales","row_units","row_total"]
  },
  {
    name: "multi-merge-dashboard",
    title: "Multi Merge Dashboard",
    covers: ["6.cross-sheet-formulas","8.merges","11.inline-formatting"],
    contains: [">Dashboard<","colspan=\"3\"","<td >15</td>","<td >38</td>","<td >2.5333333333</td>","<td >53</td>"]
  },
  {
    name: "multi-comments-gaps",
    title: "Multi Comments Gaps",
    covers: ["3.blank-lines","6.cross-sheet-formulas","12.comments"],
    contains: [">Summary<",">Audit<","<td >35</td>","<td >20</td>","<td >5</td>","<td >15</td>"],
    notContains: ["raw import","gap comment"]
  },
  {
    name: "multi-types-thresholds",
    title: "Multi Types Thresholds",
    covers: ["6.cross-sheet-formulas","9.inferred-types","11.inline-formatting"],
    contains: [">Data<","<td >true</td>","<td >false</td>","<td >2026-01-01</td>","<td >HIGH</td>","<td >60</td>"]
  },
  {
    name: "multi-header-rebind-cross",
    title: "Multi Header Rebind Cross",
    covers: ["4.header-rows","6.cross-sheet-formulas","7.named-column-ranges"],
    contains: [">Data<","<th >Product</th>","<th >Service</th>","<th >Rate</th>","<td >12</td>","<td >70</td>","<td >82</td>"]
  },
  {
    name: "multi-resilience-chain",
    title: "Multi Resilience Chain",
    covers: ["6.cross-sheet-formulas","14.resilience-rule"],
    contains: [">Calc<","<td >10</td>","<td >#DIV/0!</td>","<td >=1+</td>","<td >#REF!</td>"]
  },
  {
    name: "multi-csv-regional-rollup",
    title: "Multi CSV Regional Rollup",
    covers: ["2.sheet-formats","6.cross-sheet-formulas","7.named-column-ranges"],
    contains: [">Data<",">Summary<",">Board<","<td >500</td>","<td >250</td>","<td >11</td>","<td >750</td>"]
  },
  {
    name: "multi-csv-noheader-coords",
    title: "Multi CSV Noheader Coords",
    covers: ["2.sheet-formats","6.coordinate-formulas","6.cross-sheet-formulas"],
    contains: [">Summary<","<td >100</td>","<td >250</td>","<td >6</td>","<td >350</td>"]
  },
  {
    name: "multi-tsv-ops-rollup",
    title: "Multi TSV Ops Rollup",
    covers: ["2.sheet-formats","6.cross-sheet-formulas","7.named-column-ranges"],
    contains: [">Data<","<td >16</td>","<td >19</td>","<td >7</td>","<td >35</td>"]
  },
  {
    name: "multi-excel-budget-rollup",
    title: "Multi Excel Budget Rollup",
    covers: ["2.sheet-formats","6.cross-sheet-formulas","7.named-column-ranges"],
    contains: [">Summary<","<td >630</td>","<td >640</td>","<td >10</td>","<td >OVER</td>"]
  },
  {
    name: "multi-markdown-scoreboard",
    title: "Multi Markdown Scoreboard",
    covers: ["2.sheet-formats","6.cross-sheet-formulas","11.inline-formatting"],
    contains: [">Summary<","<td >24</td>","<td >7</td>","<td >31</td>","<td >7</td>"]
  },
  {
    name: "multi-json-inventory",
    title: "Multi JSON Inventory",
    covers: ["2.sheet-formats","6.cross-sheet-formulas","7.named-column-ranges"],
    contains: [">Summary<","<td >13</td>","<td >3</td>","<td >10</td>","<td >20</td>"]
  },
  {
    name: "multi-json-bools-dates",
    title: "Multi JSON Bools Dates",
    covers: ["2.sheet-formats","6.cross-sheet-formulas","9.inferred-types"],
    contains: [">Data<","<td >2026-02-01</td>","<td >true</td>","<td >false</td>","<td >15</td>","<td >7</td>"]
  },
  {
    name: "multi-mixed-csv-json-native",
    title: "Multi Mixed CSV JSON Native",
    covers: ["2.sheet-formats","6.cross-sheet-formulas","7.named-column-ranges"],
    contains: [">Raw<",">Targets<",">Summary<","<td >620</td>","<td >500</td>","<td >120</td>"]
  },
  {
    name: "multi-mixed-markdown-json",
    title: "Multi Mixed Markdown JSON",
    covers: ["2.sheet-formats","6.cross-sheet-formulas","11.inline-formatting"],
    contains: [">Metrics<",">Bench<","<td >20</td>","<td >4</td>","<td >Watch</td>"]
  },
  {
    name: "multi-alias-many-sheets",
    title: "Multi Alias Many Sheets",
    covers: ["6.cross-sheet-formulas","6.first-sheet-alias","7.named-column-ranges"],
    contains: [">CalcA<",">CalcB<",">Final<","<td >12</td>","<td >6</td>","<td >18</td>","<td >20</td>"]
  },
  {
    name: "multi-slice-window-chain",
    title: "Multi Slice Window Chain",
    covers: ["6.cross-sheet-formulas","6.first-sheet-alias","7.named-column-ranges"],
    contains: [">Window<","<td >60</td>","<td >9</td>","<td >69</td>"]
  },
  {
    name: "multi-modifier-precedence-cross",
    title: "Multi Modifier Precedence Cross",
    covers: ["6.cross-sheet-formulas","10.modifier-scope-precedence","11.inline-formatting"],
    contains: [">Summary<","style=\"background:#e5e7eb;color:#111111;font-style:italic;color:#008000\"","style=\"color:purple;font-weight:700;background:#fef3c7\"","style=\"background:#e5e7eb;color:#111111;font-weight:700;background:#fef3c7;background:black;color:#fff\"","<td >20</td>"],
    notContains: ["row_total","row_flag"]
  },
  {
    name: "multi-external-firstsheet",
    title: "Multi External Firstsheet",
    covers: ["2.sheet-formats","4.external-source-line","6.cross-sheet-formulas"],
    contains: [">Imported<",">Summary<",">Review<","<td >25</td>","<td >9</td>","<td >34</td>"]
  },
  {
    name: "multi-semicolon-custom-delim",
    title: "Multi Semicolon Custom Delim",
    covers: ["2.sheet-formats","6.cross-sheet-formulas","7.named-column-ranges"],
    contains: [">Data<","<td >15</td>","<td >9</td>","<td >24</td>"]
  }
  // generated multi-sheet cases end
];
