/**
 * Companion spend breakdown for the single-campaign visual chart split panel.
 * The results bar shows volume; the donut shows where spend went (ad sets, or weeks).
 */

import { getRowDate, type NreRow } from "./columns";
import { parseDate } from "./dates";
import { parseCellNum } from "./format";

export interface SpendSegment {
  name: string;
  spend: number;
}

function aggregateSpendByKey(rows: NreRow[], keyFn: (row: NreRow) => string): SpendSegment[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    const spend = parseCellNum(row.spend);
    if (spend <= 0) continue;
    const key = keyFn(row).trim();
    if (!key) continue;
    map.set(key, (map.get(key) ?? 0) + spend);
  }
  return [...map.entries()]
    .map(([name, spend]) => ({ name, spend }))
    .sort((a, b) => b.spend - a.spend);
}

function weekBucketLabel(isoDate: string): string {
  const d = parseDate(isoDate);
  if (!d) return "";
  const ts = Date.UTC(d.year, d.month - 1, d.day);
  const dow = new Date(ts).getUTCDay();
  const mondayTs = ts - ((dow + 6) % 7) * 86400000;
  const sundayTs = mondayTs + 6 * 86400000;
  const fmt = (t: number) => {
    const dt = new Date(t);
    const month = dt.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
    return `${month} ${dt.getUTCDate()}`;
  };
  return `${fmt(mondayTs)} - ${fmt(sundayTs)}`;
}

function truncateLabel(name: string, max = 28): string {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

/** Ad-set spend mix first; falls back to weekly spend buckets when only one ad set. */
export function buildCompanionSpendSegments(rawRows: NreRow[]): SpendSegment[] {
  const byAdSet = aggregateSpendByKey(rawRows, (row) => String(row.ad_set_name || "").trim());
  if (byAdSet.length >= 2) {
    return byAdSet.slice(0, 5).map((s) => ({ ...s, name: truncateLabel(s.name) }));
  }

  const byWeek = aggregateSpendByKey(rawRows, (row) => weekBucketLabel(getRowDate(row)));
  if (byWeek.length >= 2) {
    return byWeek.slice(0, 5);
  }

  return [];
}
