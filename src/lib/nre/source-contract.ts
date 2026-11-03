/** Import validation must not silently turn malformed numbers or duplicate facts into totals. */
import { findMetaMetric } from "./meta-dictionary";
import { findGoogleMetric } from "./google-dictionary";
import type { ColumnMap, NreRow } from "./columns";
import { getRowDate } from "./columns";
import { parseDate } from "./dates";

export function validSourceNumber(value: string): boolean {
  const text = value.trim();
  if (!text || /^(?:—|-|n\/?a)$/i.test(text)) return true;
  const number = text.replace(/^(?:USD|INR|AUD|CAD|GBP|EUR|AED|NZD|SGD|MYR|PHP|ZAR|BRL|MXN|A\$|C\$|NZ\$|R\$|[$₹£€¥])\s*/i, "").replace(/\s*%$/, "");
  return /^-?(?:\d+|\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})*,\d{3})(?:\.\d+)?$/.test(number);
}

export function sourceNumericIssues(rows: NreRow[], map: ColumnMap, platform: "META" | "GOOGLE" | "TIKTOK" = "META"): string[] {
  const numeric = ["spend", "results", "reach", "impressions", "ctr", "cpc", "cpr", "frequency", "link_clicks", "purchases", "website_leads", "meta_leads", "leads", "landing_page_views"] as const;
  const issues: string[] = [];
  const mappedHeaders = new Set(numeric.map(field => map[field]).filter(Boolean));
  const numericHeaderCache = new Map<string, boolean>();
  rows.forEach((row, index) => {
    if (row._sourceError && issues.length < 5) issues.push(`Record ${index + 2}: ${row._sourceError}`);
    for (const [header, value] of Object.entries(row._raw ?? {})) {
      if (mappedHeaders.has(header)) continue;
      if (!numericHeaderCache.has(header)) {
        const definition = platform === "GOOGLE" ? findGoogleMetric(header) : findMetaMetric(header);
        numericHeaderCache.set(header, !!definition && ["primary", "secondary"].includes(definition.type) && !!definition.format && ["currency", "number", "percentage", "ratio"].includes(definition.format));
      }
      if (!numericHeaderCache.get(header)) continue;
      if (!validSourceNumber(String(value ?? "")) && issues.length < 5) issues.push(`Record ${index + 2}, ${header}: invalid number. Use a decimal point (for example 12.34), not decimal-comma or text values.`);
    }
    for (const field of numeric) {
      if (map[field] && !validSourceNumber(String(row[field] ?? "")) && issues.length < 5) {
        issues.push(`Record ${index + 2}, ${map[field]}: invalid number. Use a decimal point (for example 12.34), not decimal-comma or text values.`);
      }
    }
  });
  return issues;
}

export function duplicateDailyFacts(rows: NreRow[]): string[] {
  const seen = new Set<string>();
  const duplicates: string[] = [];
  const numericHeaderCache = new Map<string, boolean>();
  for (const row of rows) {
    // Identically named inactive entities are common in Meta exports without IDs.
    // They cannot duplicate delivered facts, but remain available for selection.
    const mappedActivity = [row.spend, row.results, row.reach, row.impressions, row.ctr, row.cpc, row.cpr, row.frequency, row.link_clicks, row.purchases, row.website_leads, row.meta_leads, row.leads, row.landing_page_views];
    const hasValue = (value: string | undefined) => !!value?.trim() && !/^(?:0+(?:\.0+)?|—|-|n\/?a)$/i.test(value.trim());
    const active = mappedActivity.some(hasValue) || Object.entries(row._raw).some(([header, value]) => {
      if (!numericHeaderCache.has(header)) {
        const definition = findMetaMetric(header) || findGoogleMetric(header);
        numericHeaderCache.set(header, !!definition && ["primary", "secondary"].includes(definition.type) && !!definition.format && ["currency", "number", "percentage", "ratio"].includes(definition.format));
      }
      return numericHeaderCache.get(header) && hasValue(value);
    });
    if (!active) continue;
    const raw = Object.fromEntries(Object.entries(row._raw).map(([h, v]) => [h.trim().toLowerCase(), v.trim()]));
    const parsed = parseDate(getRowDate(row));
    const day = parsed ? `${parsed.year}-${String(parsed.month).padStart(2, "0")}-${String(parsed.day).padStart(2, "0")}` : "";
    if (!day || !(row.campaign_name ?? "").trim()) continue;
    const key = JSON.stringify([raw["campaign id"] || row.campaign_name?.trim(), raw["ad set id"] || row.ad_set_name?.trim(), raw["ad id"] || raw["ad name"] || "", day]);
    if (seen.has(key) && duplicates.length < 5) duplicates.push(`${row.campaign_name} / ${row.ad_set_name || "campaign"} / ${day}`);
    seen.add(key);
  }
  return duplicates;
}
