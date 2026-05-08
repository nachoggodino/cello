import type { Modifier, SheetFormat } from "./types.js";

export function columnLetter(index: number): string {
  let n = index;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out || "A";
}

export function deepClone<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function parseTrailingModifiers(value: string): { base: string; modifiers: Modifier[] } {
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

  return { base: rest.trim(), modifiers };
}

export function parseModifier(raw: string): Modifier {
  if (raw.includes(":")) {
    const [key, ...rest] = raw.split(":");
    return { raw, key: (key ?? "").trim().toLowerCase(), value: rest.join(":").trim() };
  }

  if (raw.startsWith("#bg:")) {
    return { raw, key: "bgfg", value: raw.slice(4).trim() };
  }

  return { raw, key: raw.trim().toLowerCase() };
}

export function inferType(value: string): { inferredType: "number" | "date" | "boolean" | "text" | "empty"; parsed: string | number | boolean | null } {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { inferredType: "empty", parsed: null };
  }

  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
    return { inferredType: "text", parsed: trimmed.slice(1, -1) };
  }

  if (trimmed === "TRUE") {
    return { inferredType: "boolean", parsed: true };
  }
  if (trimmed === "FALSE") {
    return { inferredType: "boolean", parsed: false };
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return { inferredType: "date", parsed: trimmed };
  }

  const maybeNumber = Number(trimmed);
  if (!Number.isNaN(maybeNumber) && Number.isFinite(maybeNumber)) {
    return { inferredType: "number", parsed: maybeNumber };
  }

  return { inferredType: "text", parsed: trimmed };
}

export function parseSheetFormat(rawFormat?: string): SheetFormat {
  if (!rawFormat || rawFormat.trim().length === 0) {
    return { kind: "cello" };
  }

  const token = rawFormat.trim();
  const lower = token.toLowerCase();

  if (lower === "markdown") {
    return { kind: "markdown" };
  }

  if (lower.startsWith("json")) {
    const parts = token.split(":");
    if (parts.length > 1) {
      return { kind: "json", path: parts.slice(1).join(":") };
    }
    return { kind: "json" };
  }

  if (lower.startsWith("csv")) {
    return { kind: "delimited", delimiter: ",", noHeader: lower.includes("noheader"), alias: "csv" };
  }
  if (lower.startsWith("tsv")) {
    return { kind: "delimited", delimiter: "\t", noHeader: lower.includes("noheader"), alias: "tsv" };
  }
  if (lower.startsWith("excel")) {
    return { kind: "delimited", delimiter: ";", noHeader: lower.includes("noheader"), alias: "excel" };
  }

  const [formatHead, ...flags] = token.split(":");
  const noHeader = flags.some((f) => f.trim().toLowerCase() === "noheader");
  if (formatHead && formatHead.length === 1) {
    return { kind: "delimited", delimiter: formatHead, noHeader };
  }
  if (formatHead === "\\t") {
    return { kind: "delimited", delimiter: "\t", noHeader };
  }

  return { kind: "cello" };
}

export function splitDelimitedLine(line: string, delimiter: string): string[] {
  const output: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && ch === delimiter) {
      output.push(current);
      current = "";
      continue;
    }

    current += ch;
  }
  output.push(current);
  return output;
}
