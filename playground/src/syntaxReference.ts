export interface SyntaxExample {
  code: string;
  title: string;
}

export const syntaxExamples: SyntaxExample[] = [
  {
    title: "Sheets",
    code: "@sheet Budget\n@sheet Sales [csv]\n@sheet Notes [markdown]\n@sheet Data [json]"
  },
  {
    title: "Headers And Rows",
    code: "@header | Item | Plan[€][2d] | Actual[€][2d] |\n| Hosting | 300 | 340 |\n[bold] | TOTAL | =SUM(Plan) | =SUM(Actual) |"
  },
  {
    title: "Formulas",
    code: '| Total | =SUM(Amount) |\n| Madrid | =SUMIF(Raw!region,"Madrid",Raw!amount) |\n| First sheet | =SUM(!!amount) |'
  },
  {
    title: "External Data",
    code: "@sheet RawData [csv]\n-> ./sales.csv\n\n@sheet Notes [markdown]\n# Imported markdown is rendered as cells"
  },
  {
    title: "Defaults",
    code: "@header | Item | Qty | Price | Total |\n@defaults | | | | =Qty*Price |\n| Bow | 2 | 80 |\n| Strings | 4 | 22 |"
  },
  {
    title: "Modifiers",
    code: "[bold] [italic] [bg:#fef3c7] [#7c2d12]\n[€] [$] [2d] [%]"
  },
  {
    title: "Merges And Comments",
    code: "// comments are ignored\n| ## Title | < | < |\n| ^ | stacked | cells |"
  }
];
