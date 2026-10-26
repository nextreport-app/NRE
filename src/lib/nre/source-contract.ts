/** Import validation must not silently turn malformed numbers or duplicate facts into totals. */
import type { ColumnMap, NreRow } from "./columns";
import { getRowDate } from "./columns";
import { parseDate } from "./dates";

export function validSourceNumber(value: string): boolean {
  const text = value.trim();
  if (!text || /^(?:—|-|n\/?a)$/i.test(text)) return true;
  const number = text.replace(/^(?:USD|INR|AUD|CAD|GBP|EUR|AED|NZD|SGD|MYR|PHP|ZAR|BRL|MXN|A\$|C\$|NZ\$|R\$|[$₹£€¥])\s*/i, "").replace(/\s*%$/, "");
  return /^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(number);
}

export function sourceNumericIssues(rows: NreRow[], map: ColumnMap): string[] {
  const numeric = ["spend", "results", "reach", "impressions", "ctr", "cpc", "cpr", "frequency", "link_clicks", "purchases", "website_leads", "meta_leads", "leads", "landing_page_views"] as const;
  const issues: string[] = [];
  rows.forEach((row, index) => {
    if (row._sourceError && issues.length < 5) issues.push(`Record ${index + 2}: ${row._sourceError}`);
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
  for (const row of rows) {
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
