/**
 * NRE v1 — formatting + numeric parsing helpers.
 * Direct port of fmtCurrency_/fmtCurrency2dp_/fmtNumber_/fmtPercent_/parseCellNum_
 * from meta_ads_report_v4.js. Currency symbol is parameterised per-client instead
 * of the Apps Script global CURRENCY_SYMBOL constant.
 */

import type { Currency } from "@/generated/prisma/enums";

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  INR: "₹",
  USD: "$",
  GBP: "£",
  AUD: "A$",
  CAD: "C$",
  AED: "AED",
  NZD: "NZ$",
  SGD: "S$",
  MYR: "RM",
  PHP: "₱",
  ZAR: "R",
  BRL: "R$",
  MXN: "MX$",
  EUR: "€",
};

/** Port of parseCellNum_ — strips commas/currency/percent/whitespace, tolerant of junk. */
export function parseCellNum(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  const s = String(v).trim();
  if (s === "") return 0;
  const cleaned = s.replace(/,/g, "").replace(/[^\d.-]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/** Decimal half-cents round away from zero, consistently across currency displays.
 * Division can put a true half-cent one or two binary ULPs below the boundary
 * (45.69 / 6). Snap only that tiny boundary error, never ordinary sub-half values.
 */
function roundCurrency(n: number): number {
  const scaled = Math.abs(n) * 100;
  const lower = Math.floor(scaled);
  if (!Number.isSafeInteger(lower)) return n;
  const tolerance = Math.min(1e-7, Number.EPSILON * Math.max(1, scaled) * 2);
  const cents = Math.abs(scaled - (lower + 0.5)) <= tolerance ? lower + 1 : Math.round(scaled);
  return cents === 0 ? 0 : Math.sign(n) * cents / 100;
}

/** Comma-grouped money; retain cents so positive sub-unit spend remains visible. */
export function fmtCurrency(v: unknown, symbol: string): string {
  const n = parseCellNum(v);
  return symbol + roundCurrency(n).toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 });
}

/** Fixed two-decimal currency without grouping; same rounding as other money displays. */
export function fmtCurrency2dp(v: unknown, symbol: string): string {
  return symbol + roundCurrency(parseCellNum(v)).toFixed(2);
}

/** Whole dollars when .00; otherwise 2dp with comma grouping — chart donut legend spend. */
export function fmtCurrencyAdaptive(v: unknown, symbol: string): string {
  const n = roundCurrency(parseCellNum(v));
  if (Math.abs(n - Math.round(n)) < 0.005) {
    return fmtCurrency(n, symbol);
  }
  return symbol + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Port of fmtNumber_ */
export function fmtNumber(v: unknown): string {
  return Math.round(parseCellNum(v)).toLocaleString("en-US");
}

/** Conversion counts may be fractional (modelled attribution); do not change them into integers. */
export function fmtResultCount(v: unknown): string {
  return parseCellNum(v).toLocaleString("en-US", { maximumFractionDigits: 6 });
}

/** Port of fmtPercent_ */
export function fmtPercent(v: unknown): string {
  return parseCellNum(v).toFixed(2) + "%";
}

/**
 * Formats a raw seconds value (e.g. Meta's "Video average play time") as
 * "Xm Ys" once it reaches a full minute, or "X.Xs" below that — there's no
 * existing duration formatter in this codebase to port, so this is new for
 * the dynamic metric dictionary system (meta-dictionary.ts's "duration"
 * format).
 */
export function fmtDuration(v: unknown): string {
  const totalSeconds = parseCellNum(v);
  if (totalSeconds < 60) return totalSeconds.toFixed(1) + "s";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  return `${minutes}m ${seconds}s`;
}

/** "3.45x" — used for ROAS-style metrics (dynamic metric dictionary's "ratio" format). */
export function fmtRatio(v: unknown): string {
  return parseCellNum(v).toFixed(2) + "x";
}

/**
 * Comma-grouped 2dp currency, for the dynamic metric dictionary system only.
 * Unlike ungrouped fmtCurrency2dp, dynamic "currency"
 * metrics include aggregate totals like Google's "cost" that can exceed
 * 1,000 and need a thousand separator to stay readable.
 */
function fmtCurrency2dpGrouped(v: unknown, symbol: string): string {
  return symbol + roundCurrency(parseCellNum(v)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Dispatches to the right formatter for the dynamic metric dictionary
 * system's `MetricFormat` union — every dynamically-selected metric's raw
 * aggregated value passes through here once, rather than every call site
 * picking a specific fmt* function like the rest of this file's callers do.
 */
export function formatMetricValue(
  v: unknown,
  format: "currency" | "number" | "percentage" | "duration" | "ratio" | "text",
  currencySymbol: string,
): string {
  switch (format) {
    case "currency":
      return fmtCurrency2dpGrouped(v, currencySymbol);
    case "percentage":
      return fmtPercent(v);
    case "duration":
      return fmtDuration(v);
    case "ratio":
      return fmtRatio(v);
    case "text":
      return String(v ?? "");
    case "number":
    default:
      return fmtNumber(v);
  }
}
