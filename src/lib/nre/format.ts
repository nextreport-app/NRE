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
