import type { ReactNode } from "react";

const formulaTokenPattern =
  /([A-Za-z_][\w ]*!|!!)|(\[[^\]]+\])|([+\-*/^(),[\]])|(=)|([A-Za-z_][\w ]*)|(\s+|.)/g;

export function renderFormulaHighlight(source: string): ReactNode {
  if (!source.startsWith("=")) {
    return source;
  }
  return tokenizeFormula(source).map((token, index) => (
    <span key={`${token.text}-${index}`} className={`formula-${token.kind}`}>
      {token.text}
    </span>
  ));
}

export function renderInlineDisplay(source: string): ReactNode {
  const nodes: ReactNode[] = [];
  const pattern = /(\*([^*]+)\*)|(_([^_]+)_)|(~~([^~]+)~~)/g;
  let cursor = 0;
  for (const match of source.matchAll(pattern)) {
    if (match.index > cursor) {
      nodes.push(source.slice(cursor, match.index));
    }
    const text = match[2] ?? match[4] ?? match[6] ?? "";
    const style = match[2]
      ? { fontWeight: 700 }
      : match[4]
        ? { fontStyle: "italic" }
        : { textDecoration: "line-through" };
    nodes.push(
      <span key={`${match.index}-${text}`} style={style}>
        {text}
      </span>
    );
    cursor = match.index + match[0].length;
  }
  if (cursor < source.length) {
    nodes.push(source.slice(cursor));
  }
  return nodes.length > 0 ? nodes : source;
}

function tokenizeFormula(source: string): Array<{ kind: string; text: string }> {
  const tokens: Array<{ kind: string; text: string }> = [];
  for (const match of source.matchAll(formulaTokenPattern)) {
    const text = match[0];
    const kind = match[4]
      ? "equals"
      : match[1]
        ? "sheet"
        : match[2]
          ? "range"
          : match[3]
            ? "operator"
            : match[5]
              ? "column"
              : "plain";
    tokens.push({ kind, text });
  }
  return tokens;
}
