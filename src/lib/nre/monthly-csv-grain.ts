import { rowHasDailyDate, type NreRow } from "./columns";
import { parseDate } from "./dates";

export interface SourcePeriod { startIso: string; endIso: string }
function iso(value: string): string | null {
  const parsed = parseDate(value);
  if (!parsed) return null;
  const text = `${parsed.year}-${String(parsed.month).padStart(2, "0")}-${String(parsed.day).padStart(2, "0")}`;
  return Number.isFinite(Date.parse(text)) && new Date(`${text}T12:00:00Z`).toISOString().slice(0, 10) === text ? text : null;
}

/** Retain period totals as interval facts. Never synthesize daily observations. */
export function prepareMonthlyCsvFacts(rows: NreRow[]): { aggregate: boolean; errors: string[] } {
  const campaignRows = rows.filter(row => row.campaign_name?.trim());
  const candidates = campaignRows.filter(row => row._reportPeriod || !rowHasDailyDate(row));
  if (!candidates.length) return { aggregate: false, errors: [] };
  if (candidates.length !== campaignRows.length) return { aggregate: true, errors: ["Do not mix daily rows and period totals in one CSV. Export one time breakdown."] };
  const errors = new Set<string>();
  const seen = new Set<string>();
  for (const row of candidates) {
    const raw = Object.fromEntries(Object.entries(row._raw).map(([key, value]) => [key.toLowerCase().trim(), value.trim()]));
    const start = iso(raw["reporting starts"] || row.date_start || "");
    const end = iso(raw["reporting ends"] || row.date_end || "");
    if (!start || !end || start > end) { errors.add("Monthly totals need valid Reporting starts and Reporting ends dates. Export those date columns with your campaign totals."); continue; }
    let period = { startIso: start, endIso: end };
    const monthCell = raw["month"] || raw["reporting month"];
    if (monthCell) {
      const month = /^\d{4}-\d{2}$/.test(monthCell) ? monthCell : iso(monthCell)?.slice(0, 7);
      if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) { errors.add("Use an ISO month (YYYY-MM or YYYY-MM-DD) in the Month column."); continue; }
      const [year, number] = month.split("-").map(Number);
      const last = new Date(Date.UTC(year, number, 0)).toISOString().slice(0, 10);
      period = { startIso: start > `${month}-01` ? start : `${month}-01`, endIso: end < last ? end : last };
    }
    if (period.startIso > period.endIso || period.startIso.slice(0, 7) !== period.endIso.slice(0, 7) || !period.startIso.endsWith("-01")) {
      errors.add("Monthly totals must describe one calendar month starting on the 1st. For several months, use Month breakdown (one row per campaign/month) or Day breakdown; a single multi-month total cannot be split."); continue;
    }
    const key = `${row.campaign_name!.trim()}\0${period.startIso.slice(0, 7)}`;
    if (seen.has(key)) errors.add("Month-total exports need one row per campaign per month. Use campaign-level totals without ad/ad-set breakdown, or upload Day breakdown to include ad sets. Duplicate totals cannot be safely combined.");
    seen.add(key);
    if (campaignRows.length > 1 && /^(total|summary|all campaigns)$/i.test(row.campaign_name!.trim())) errors.add("Remove account-summary rows from the monthly CSV; include campaign rows only to avoid counting totals twice.");
    row._reportPeriod = period;
    row.date_start = period.startIso;
    row.date_end = period.endIso;
  }
  return { aggregate: true, errors: [...errors] };
}

/** Aggregate facts must match the requested window; they cannot be prorated. */
export function monthlyFactSelectionError(rows: NreRow[], range: SourcePeriod): string | null {
  for (const row of rows) {
    const fact = row._reportPeriod;
    if (!fact || fact.endIso < range.startIso || fact.startIso > range.endIso) continue;
    if (fact.startIso !== range.startIso || fact.endIso !== range.endIso) return `A monthly total covers ${fact.startIso} through ${fact.endIso}; it cannot be sliced to ${range.startIso} through ${range.endIso}. Export the exact selected month/MTD period, ending no later than yesterday.`;
  }
  return null;
}
