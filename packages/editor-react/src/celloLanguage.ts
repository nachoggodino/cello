import {
  HighlightStyle,
  StreamLanguage,
  syntaxHighlighting
} from "@codemirror/language";
import type { StreamParser, StringStream } from "@codemirror/language";
import { tags } from "@lezer/highlight";

interface TokenRule {
  pattern: RegExp;
  token: string;
  startOfLine?: boolean;
}

const tokenRules: readonly TokenRule[] = [
  { pattern: /\s*\/\/.*$/, token: "comment", startOfLine: true },
  { pattern: /\s*@(sheet|header|defaults|tone|width|height)\b/, token: "keyword", startOfLine: true },
  { pattern: /\s*->/, token: "operator", startOfLine: true },
  { pattern: /"(?:[^"\\]|\\.)*"/, token: "string" },
  { pattern: /\[[^\]]+\]/, token: "attribute" },
  { pattern: /##?\s+[^|]+/, token: "heading" },
  { pattern: /~~[^~]+~~/, token: "strikethrough" },
  { pattern: /\*[^*]+\*/, token: "strong" },
  { pattern: /_[^_]+_/, token: "emphasis" },
  { pattern: /\b[A-Z][A-Z0-9_]*(?=\s*\()/, token: "processingInstruction" },
  { pattern: /(?:!!|[A-Za-z_][\w.-]*!)/, token: "variableName.special" },
  { pattern: /\b[A-Z]+[1-9][0-9]*\b/, token: "number.special" },
  { pattern: /\b\d{4}-\d{2}-\d{2}\b/, token: "atom" },
  { pattern: /\b(?:TRUE|FALSE|true|false|null)\b/, token: "bool" },
  { pattern: /(?<![\w.])-?(?:\d+\.\d+|\d+|\.\d+)\b/, token: "number" },
  { pattern: /<=|>=|<>|[+\-*/^&=<>(),:]|!/, token: "operator" },
  { pattern: /\|/, token: "separator" },
  { pattern: /\b[A-Za-z_][\w.-]*\b/, token: "variableName" }
];

const celloParser: StreamParser<null> = {
  name: "cello",
  startState: () => null,
  token(stream: StringStream) {
    const startOfLine = stream.sol();
    for (const rule of tokenRules) {
      if ((!rule.startOfLine || startOfLine) && stream.match(rule.pattern)) {
        return rule.token;
      }
    }
    stream.next();
    return null;
  }
};

export const celloLanguage = StreamLanguage.define(celloParser);

const celloHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: "var(--cello-source-keyword)", fontWeight: "700" },
  { tag: tags.comment, color: "var(--cello-source-comment)", fontStyle: "italic" },
  { tag: tags.string, color: "var(--cello-source-string)" },
  { tag: tags.number, color: "var(--cello-source-number)" },
  { tag: tags.special(tags.number), color: "var(--cello-source-reference)" },
  { tag: [tags.bool, tags.atom], color: "var(--cello-source-atom)" },
  { tag: tags.operator, color: "var(--cello-source-operator)", fontWeight: "700" },
  { tag: tags.separator, color: "var(--cello-source-separator)" },
  { tag: tags.variableName, color: "var(--cello-source-variable)" },
  { tag: tags.special(tags.variableName), color: "var(--cello-source-reference)" },
  { tag: tags.heading, color: "var(--cello-source-heading)", fontWeight: "700" },
  { tag: tags.attributeName, color: "var(--cello-source-attribute)" },
  { tag: tags.processingInstruction, color: "var(--cello-source-function)" },
  { tag: tags.strong, fontWeight: "700" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through" }
]);

export const celloSyntaxHighlighting = syntaxHighlighting(celloHighlightStyle);
