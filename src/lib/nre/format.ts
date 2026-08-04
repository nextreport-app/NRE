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
  const cleaned = s.replace(/[,$%\s]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/** Port of fmtCurrency_ — rounds to whole units, comma-grouped. */
export function fmtCurrency(v: unknown, symbol: string): string {
  return symbol + Math.round(parseCellNum(v)).toLocaleString("en-US");
}

/** Port of fmtCurrency2dp_ — 2 decimal places, comma-grouped. */
export function fmtCurrency2dp(v: unknown, symbol: string): string {
  return symbol + parseCellNum(v).toFixed(2);
}

/** Port of fmtNumber_ */
export function fmtNumber(v: unknown): string {
  return Math.round(parseCellNum(v)).toLocaleString("en-US");
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
 * Unlike fmtCurrency2dp (a direct, intentionally ungrouped port of the legacy
 * fmtCurrency2dp_ Apps Script function — see its test), dynamic "currency"
 * metrics include aggregate totals like Google's "cost" that can exceed
 * 1,000 and need a thousand separator to stay readable.
 */
function fmtCurrency2dpGrouped(v: unknown, symbol: string): string {
  return symbol + parseCellNum(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
