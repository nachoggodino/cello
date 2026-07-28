import { isCellModifier, parseModifier } from "../../core/src/index.js";
import type { Modifier } from "../../core/src/index.js";
import type { EditorCell } from "./model.js";

const mergeLeftToken = "<";
const mergeUpToken = "^";

export function getCellSourceText(cell: EditorCell): string {
  return `${cell.raw}${cell.modifiers.map((modifier) => `[${modifier.raw}]`).join("")}`;
}

export function parseCellSource(source: string): EditorCell {
  const { base, modifiers } = source.startsWith("=") ? splitTrailingCellModifiers(source) : splitTrailingModifiers(source);
  return {
    raw: base,
    modifiers: isMergeToken(base) ? [] : modifiers
  };
}

export function toBaseRaw(raw: string, kind: string): string {
  if (kind === "merge-left" || kind === "merge-up") {
    return raw;
  }
  if (kind === "formula") {
    return splitTrailingCellModifiers(raw).base;
  }
  return splitTrailingModifiers(raw).base;
}

export function isMergeToken(value: string): boolean {
  return value === mergeLeftToken || value === mergeUpToken;
}

export function getMergeToken(direction: "left" | "up"): string {
  return direction === "left" ? mergeLeftToken : mergeUpToken;
}

function splitTrailingModifiers(value: string): { base: string; modifiers: Modifier[] } {
  let rest = value.trimEnd();
  const modifiers: Modifier[] = [];

  while (rest.endsWith("]")) {
    const open = rest.lastIndexOf("[");
    if (open < 0) {
      break;
    }
    const rawContent = rest.slice(open + 1, -1);
    if (rawContent.includes("[") || rawContent.includes("]")) {
      break;
    }
    modifiers.unshift(parseModifier(rawContent));
    rest = rest.slice(0, open).trimEnd();
  }

  return { base: rest, modifiers };
}

function splitTrailingCellModifiers(value: string): { base: string; modifiers: Modifier[] } {
  let rest = value.trimEnd();
  const modifiers: Modifier[] = [];

  while (rest.endsWith("]")) {
    const open = rest.lastIndexOf("[");
    if (open < 0) {
      break;
    }
    const rawContent = rest.slice(open + 1, -1);
    if (rawContent.includes("[") || rawContent.includes("]")) {
      break;
    }
    const modifier = parseModifier(rawContent);
    if (!isCellModifier(modifier)) {
      break;
    }
    modifiers.unshift(modifier);
    rest = rest.slice(0, open).trimEnd();
  }

  return { base: rest, modifiers };
}
