import { StreamLanguage, syntaxHighlighting, HighlightStyle } from "@codemirror/language";
import type { StreamParser, StringStream } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

const celloParser: StreamParser<null> = {
  name: "cello",
  startState: () => null,
  token(stream: StringStream) {
    if (stream.sol() && stream.match(/\s*\/\/.*/)) {
      return "comment";
    }
    if (stream.sol() && stream.match(/\s*@sheet\b/)) {
      stream.skipToEnd();
      return "keyword";
    }
    if (stream.match(/\[[^\]]+\]/)) {
      return "attribute";
    }
    if (stream.match(/\|/)) {
      return "separator";
    }
    if (stream.match(/<|\^/)) {
      return "operator";
    }
    if (stream.match(/=\s*[A-Za-z0-9_!.$()[\]:,+\-*/" ]+/)) {
      return "formula";
    }
    if (stream.match(/##?\s+[^|]+/)) {
      return "heading";
    }
    if (stream.match(/\b(?:true|false|null)\b/i)) {
      return "atom";
    }
    if (stream.match(/-?\d+(?:\.\d+)?\b/)) {
      return "number";
    }
    if (stream.match(/\b[A-Za-z_][\w.-]*(?=\s*\|)/)) {
      return "variableName";
    }
    stream.next();
    return null;
  }
};

export const celloLanguage = StreamLanguage.define(celloParser);

export const celloHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: "#d48a2f", fontWeight: "700" },
  { tag: t.comment, color: "#8e7867", fontStyle: "italic" },
  { tag: t.number, color: "#f1b15f" },
  { tag: t.bool, color: "#d7a5ff" },
  { tag: t.atom, color: "#d7a5ff" },
  { tag: t.operator, color: "#f3c98b", fontWeight: "700" },
  { tag: t.variableName, color: "#f8ddbd" },
  { tag: t.heading, color: "#ffd99f", fontWeight: "700" },
  { tag: t.attributeName, color: "#9fd4ff" },
  { tag: t.processingInstruction, color: "#f6c177" }
]);

export function celloSyntaxHighlighting() {
  return syntaxHighlighting(celloHighlightStyle);
}
