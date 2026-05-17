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
      return "processingInstruction";
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
  { tag: t.keyword, color: "var(--syntax-keyword)", fontWeight: "700" },
  { tag: t.comment, color: "var(--syntax-comment)", fontStyle: "italic" },
  { tag: t.number, color: "var(--syntax-number)" },
  { tag: t.bool, color: "var(--syntax-atom)" },
  { tag: t.atom, color: "var(--syntax-atom)" },
  { tag: t.operator, color: "var(--syntax-operator)", fontWeight: "700" },
  { tag: t.variableName, color: "var(--syntax-variable)" },
  { tag: t.heading, color: "var(--syntax-heading)", fontWeight: "700" },
  { tag: t.attributeName, color: "var(--syntax-attribute)" },
  { tag: t.processingInstruction, color: "var(--syntax-instruction)" }
]);

export function celloSyntaxHighlighting() {
  return syntaxHighlighting(celloHighlightStyle);
}
