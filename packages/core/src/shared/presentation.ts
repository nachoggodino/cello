import { isNamedColorModifier, sanitizeCssColor } from "./colors.js";
import { CELLO_HEADING_STYLES, CELLO_TONE_NAMES } from "./display.js";
import { heightContentToCss, heightOuterToCss } from "./layout.js";
import type { ResolvedRowLayout } from "./layout.js";
import type { Modifier } from "./types.js";

export type PresentationStyle = Record<string, string | number>;

const headingPattern = /^#{1,3}\s+/;
const inlineStrikeMarker = "~~";
const inlineBoldPattern = /^\*[^*]+\*$/;
const inlineItalicPattern = /^_[^_]+_$/;

export function getInlineTextStyle(raw: string): PresentationStyle {
  const heading = CELLO_HEADING_STYLES.find((candidate) => raw.startsWith(candidate.prefix));
  return {
    ...(headingPattern.test(raw) ? { fontWeight: 700 } : {}),
    ...(heading ? { fontSize: heading.fontSize } : {}),
    ...(inlineBoldPattern.test(raw) ? { fontWeight: 700 } : {}),
    ...(inlineItalicPattern.test(raw) ? { fontStyle: "italic" } : {}),
    ...(isWrapped(raw, inlineStrikeMarker) ? { textDecoration: "line-through" } : {})
  };
}

export function getModifierStyle(modifiers: Modifier[]): PresentationStyle {
  return Object.assign({}, ...modifiers.map(modifierToStyle)) as PresentationStyle;
}

export function getModifierStyleRules(modifiers: Modifier[]): string[] {
  return modifiers.flatMap((modifier) => styleToRules(modifierToStyle(modifier)));
}

export function getToneClasses(modifiers: Modifier[], prefix = "cello-tone"): string[] {
  return modifiers.flatMap((modifier) => modifier.key === "tone" && modifier.value && isToneName(modifier.value) ? [`${prefix}-${modifier.value}`] : []);
}

export function getRowLayoutClasses(rowLayout: ResolvedRowLayout): string[] {
  return [
    rowLayout.mode === "wrap" ? "cello-wrap" : "cello-ellipsis",
    rowLayout.height.kind !== "auto" ? "cello-fixed-height" : "",
    rowLayout.mode === "ellipsis" && rowLayout.height.kind === "lines" ? "cello-line-clamp" : ""
  ].filter(Boolean);
}

export function getRowLayoutStyleRules(rowLayout: ResolvedRowLayout): string[] {
  const contentHeight = heightContentToCss(rowLayout.height);
  const outerHeight = heightOuterToCss(rowLayout.height);
  return !contentHeight || !outerHeight
    ? []
    : [
        `height:${outerHeight}`,
        `max-height:${outerHeight}`,
        `--cello-content-height:${contentHeight}`,
        rowLayout.height.kind === "lines" && rowLayout.height.value !== undefined ? `--cello-line-clamp:${rowLayout.height.value}` : ""
      ].filter(Boolean);
}

export function cleanInlineDisplayText(raw: string, formatted: string): string {
  if (raw.startsWith("=")) {
    return formatted;
  }
  if (isWrapped(formatted, inlineStrikeMarker)) {
    return formatted.slice(inlineStrikeMarker.length, -inlineStrikeMarker.length);
  }
  if (inlineBoldPattern.test(formatted) || inlineItalicPattern.test(formatted)) {
    return formatted.slice(1, -1);
  }
  return headingPattern.test(formatted) ? formatted.replace(headingPattern, "") : formatted;
}

function modifierToStyle(modifier: Modifier): PresentationStyle {
  if (modifier.key === "bold") return { fontWeight: 700 };
  if (modifier.key === "italic") return { fontStyle: "italic" };
  if (modifier.key === "strike") return { textDecoration: "line-through" };
  if (modifier.key === "bg" && modifier.value) return colorStyle("background", modifier.value);
  if (modifier.key === "bgfg" && modifier.value) {
    const [background = "", foreground = ""] = modifier.value.split(":");
    return { ...colorStyle("background", background), ...colorStyle("color", foreground) };
  }
  if (modifier.key.startsWith("#")) return colorStyle("color", modifier.key);
  if (modifier.key === "color" && modifier.value) return colorStyle("color", modifier.value);
  return isNamedColorModifier(modifier.key) ? { color: modifier.key } : {};
}

function colorStyle(property: "background" | "color", value: string): PresentationStyle {
  const color = sanitizeCssColor(value);
  return color ? { [property]: color } : {};
}

function styleToRules(style: PresentationStyle): string[] {
  return Object.entries(style).map(([key, value]) => `${key.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)}:${String(value)}`);
}

function isWrapped(value: string, marker: string): boolean {
  return value.startsWith(marker) && value.endsWith(marker) && value.length > marker.length * 2;
}

function isToneName(value: string): boolean {
  return (CELLO_TONE_NAMES as readonly string[]).includes(value);
}
