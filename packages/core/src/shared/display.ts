import type { Modifier } from "./types.js";

export type CurrencySymbol = "€" | "$" | "£";
export type ToneName = "ok" | "warn" | "error" | "info" | "muted" | "accent";

export interface NumericDisplayFormat {
  decimals?: number;
  currency?: CurrencySymbol;
  percent: boolean;
}

export const CELLO_HEADING_STYLES = [
  { level: "h1", prefix: "## ", className: "cello-h1", fontSize: "1.25rem" },
  { level: "h2", prefix: "# ", className: "cello-h2", fontSize: "1.1rem" },
  { level: "h3", prefix: "### ", className: "cello-h3", fontSize: "1rem" }
] as const;

export const CELLO_TONE_NAMES: ToneName[] = ["ok", "warn", "error", "info", "muted", "accent"];

export const CELLO_TONE_COLORS: Record<ToneName, { color: string; background: string }> = {
  ok: { color: "#166534", background: "#dcfce7" },
  warn: { color: "#9a3412", background: "#ffedd5" },
  error: { color: "#991b1b", background: "#fee2e2" },
  info: { color: "#1d4ed8", background: "#dbeafe" },
  muted: { color: "#475569", background: "#e2e8f0" },
  accent: { color: "#6d28d9", background: "#ede9fe" }
};

export function formatDisplayValue(value: string | number | boolean | null, modifiers: Modifier[]): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return String(value);
  }

  const format = collectNumericDisplayFormat(modifiers);
  if (!format) {
    return String(value);
  }

  const scaled = format.percent ? value * 100 : value;
  const numberText = format.decimals === undefined ? String(scaled) : scaled.toFixed(format.decimals);
  return `${format.currency ?? ""}${numberText}${format.percent ? "%" : ""}`;
}

export function collectNumericDisplayFormat(modifiers: Modifier[]): NumericDisplayFormat | undefined {
  const format: NumericDisplayFormat = { percent: false };
  let found = false;

  for (const mod of modifiers) {
    if (isCurrencyModifier(mod.key)) {
      format.currency = mod.key;
      found = true;
      continue;
    }
    if (mod.key === "%") {
      format.percent = true;
      found = true;
      continue;
    }

    const decimals = parseDecimalsModifier(mod.key);
    if (decimals !== undefined) {
      format.decimals = decimals;
      found = true;
    }
  }

  return found ? format : undefined;
}

export function isCurrencyModifier(key: string): key is CurrencySymbol {
  return key === "€" || key === "$" || key === "£";
}

export function parseDecimalsModifier(key: string): number | undefined {
  const match = /^(\d+)d$/.exec(key);
  if (!match) {
    return undefined;
  }

  const decimals = Number(match[1]);
  return Number.isSafeInteger(decimals) ? decimals : undefined;
}
