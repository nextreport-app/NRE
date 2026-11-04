import type { NreRow } from "./columns";
import { CURRENCY_SYMBOLS } from "./format";

const codes = new Set(Intl.supportedValuesOf("currency"));
/** Explicit ISO currency evidence only. A bare $ never distinguishes USD/AUD/CAD. */
export function detectCsvCurrency(
  headers: string[],
  rows: NreRow[],
): { code: string | null; error?: string } {
  if (!headers.length) headers = sourceHeaders(rows);
  const found = new Set<string>();
  for (const header of headers) {
    if (!/\b(spent|spend|cost|cpc|cpm|cpr|budget)\b/i.test(header)) continue;
    for (const match of header.matchAll(/[([]\s*([A-Z]{3})\s*[)\]]/gi)) {
      const code = match[1].toUpperCase();
      // Meta's CPC (all) is a click scope, not the ISO code for Albanian lek.
      if (code === "ALL" && !/\b(amount|spent|spend|budget)\b/i.test(header))
        continue;
      if (codes.has(code)) found.add(code);
    }
  }
  const currencyHeaders = headers.filter((header) =>
    /^(?:account[ _])?currency(?:[ _]code)?$/i.test(header.trim()),
  );
  for (const row of rows)
    for (const header of currencyHeaders) {
      const value = row._raw?.[header]?.trim().toUpperCase();
      if (!value) continue;
      if (!codes.has(value))
        return {
          code: null,
          error:
            "The CSV contains an unrecognized currency code. Export ISO currency codes, such as USD or AUD.",
        };
      found.add(value);
    }
  if (found.size > 1)
    return {
      code: null,
      error:
        "This CSV mixes currencies. Export one ad-account currency per report; amounts cannot be added without an exchange-rate conversion.",
    };
  return { code: [...found][0] ?? null };
}
export function sourceHeaders(rows: NreRow[]): string[] {
  const headers = new Set<string>();
  for (const row of rows)
    for (const header in row._raw ?? {}) headers.add(header);
  return [...headers];
}
export function resolveReportCurrencySymbol(
  headers: string[],
  rows: NreRow[],
  fallback: string,
): string {
  const detected = detectCsvCurrency(headers, rows);
  if (detected.error) throw new Error(detected.error);
  if (!detected.code) return fallback;
  return (
    CURRENCY_SYMBOLS[detected.code as keyof typeof CURRENCY_SYMBOLS] ??
    `${detected.code} `
  );
}
