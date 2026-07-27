import type { Modifier } from "../../core/src/index.js";
import type { EditorCell } from "./model.js";

const mergeLeftToken = "<";
const mergeUpToken = "^";

export function getCellSourceText(cell: EditorCell): string {
  return `${cell.raw}${cell.modifiers.map((modifier) => `[${modifier.raw}]`).join("")}`;
}

export function parseCellSource(source: string): EditorCell {
  const { base, modifiers } = splitTrailingModifiers(source);
  return {
    raw: base,
    modifiers: isMergeToken(base) ? [] : modifiers
  };
}

export function toBaseRaw(raw: string, kind: string): string {
  if (kind === "formula" || kind === "merge-left" || kind === "merge-up") {
    return raw;
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

function parseModifier(raw: string): Modifier {
  if (raw.startsWith("#bg:")) {
    const [background = "", foreground = ""] = raw
      .slice(4)
      .split(":")
      .map((part) => part.trim());
    return { raw, key: "bgfg", value: `${background}:${foreground}` };
  }

  if (raw.includes(":")) {
    const [key, ...rest] = raw.split(":");
    return { raw, key: (key ?? "").trim().toLowerCase(), value: rest.join(":").trim() };
  }

  return { raw, key: raw.trim().toLowerCase() };
}
