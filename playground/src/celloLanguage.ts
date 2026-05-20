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
    if (stream.sol() && stream.match(/\s*@(sheet|header|defaults)\b/)) {
      return "keyword";
    }
    if (stream.sol() && stream.match(/\s*->/)) {
      return "operator";
    }
    if (stream.match(/"(?:[^"\\]|\\.)*"/)) {
      return "string";
    }
    if (stream.match(/\[[^\]]+\]/)) {
      return "attribute";
    }
    if (stream.match(/\|/)) {
      return "separator";
    }
    if (stream.match(/<=|>=|<>|[+\-*/^&=<>(),:]|!/)) {
      return "operator";
    }
    if (stream.match(/\b[A-Z][A-Z0-9_]*(?=\s*\()/)) {
      return "processingInstruction";
    }
    if (stream.match(/##?\s+[^|]+/)) {
      return "heading";
    }
    if (stream.match(/\b\d{4}-\d{2}-\d{2}\b/)) {
      return "atom";
    }
    if (stream.match(/\b(?:TRUE|FALSE|true|false|null)\b/)) {
      return "atom";
    }
    if (stream.match(/-?(?:\d+\.\d+|\d+|\.\d+)\b/)) {
      return "number";
    }
    if (stream.match(/\b[A-Z]+[1-9][0-9]*\b/)) {
      return "number";
    }
    if (stream.match(/(?:!!|[A-Za-z_][\w.-]*!)/)) {
      return "variableName";
    }
    if (stream.match(/\b[A-Za-z_][\w.-]*\b/)) {
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
  { tag: t.string, color: "var(--syntax-variable)" },
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
