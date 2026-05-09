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
];
