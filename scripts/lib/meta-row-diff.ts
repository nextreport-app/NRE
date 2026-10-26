/** Offline evidence comparison. Does not run NRE aggregation or infer manual Results. */
import { parseCsvHeadersAndRows } from "../../src/lib/nre/parse-csv";
import { META_CSV_HEADERS, insightToManualCsvRow } from "../../src/lib/nre/meta-api-sync/insight-engine";
import { normalizeMetaInsightRow } from "../../src/lib/nre/meta-api-sync/normalize-insight-row";
import { manualExportPrimaryResult } from "../../src/lib/nre/meta-api-sync/manual-export-mapper";
import type { MetaInsightRow } from "../../src/lib/meta-api";

export type EvidenceRow = {
  sourceRow: number;
  campaign: string;
  adSet: string;
  day: string;
  resultType: string;
  results: number | null;
  spend: number | null;
  cpr: number | null;
};

function dayIso(value: string): string {
  const v = value.trim();
  const isoParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  const dmyParts = /^(\d{2})-(\d{2})-(\d{4})$/.exec(v);
  if (!isoParts && !dmyParts) throw new Error(`Unsupported daily date: ${JSON.stringify(value)}. Use ISO or DD-MM-YYYY.`);
  const iso = isoParts ? `${isoParts[1]}-${isoParts[2]}-${isoParts[3]}` : `${dmyParts![3]}-${dmyParts![2]}-${dmyParts![1]}`;
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== iso) {
    throw new Error(`Invalid daily date: ${JSON.stringify(value)}`);
  }
  return iso;
}

function numeric(value: string, label: string, row: number): number | null {
  const v = value.trim();
  if (!v || v === "—" || v === "-" || /^n\/?a$/i.test(v)) return null;
  // Meta exports here use decimal points and optional comma grouping. Never turn malformed cells into zero.
  if (!/^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(v)) {
    throw new Error(`Invalid ${label} at CSV record ${row}: ${JSON.stringify(value)}`);
  }
  const n = Number(v.replaceAll(",", ""));
  if (!Number.isFinite(n)) throw new Error(`Nonfinite ${label} at CSV record ${row}`);
  return n;
}

export function csvEvidence(csv: string): EvidenceRow[] {
  const { headers, dataRows } = parseCsvHeadersAndRows(csv);
  const normalized = headers.map(h => h.trim().toLowerCase());
  const column = (label: string, match: (h: string) => boolean) => {
    const indices = normalized.flatMap((h, i) => match(h) ? [i] : []);
    if (indices.length !== 1) throw new Error(`Expected exactly one ${label} column; found ${indices.length}`);
    return indices[0];
  };
  const campaign = column("Campaign name", h => h === "campaign name");
  const adSet = column("Ad set name", h => h === "ad set name");
  const daily = normalized.some(h => h === "day" || h === "date");
  const day = daily
    ? column("Day/Date", h => h === "day" || h === "date")
    : column("Reporting starts", h => h === "reporting starts");
  const end = daily ? undefined : column("Reporting ends", h => h === "reporting ends");
  const resultType = column("Result type/indicator", h => h === "result type" || h === "result indicator");
  const results = column("Results", h => h === "results");
  const spend = column("Amount spent", h => /^amount spent(?: \([a-z]{3}\))?$/.test(h));
  const cpr = column("Cost per result", h => /^cost per result(?: \([a-z]{3}\))?$/.test(h));
  return dataRows.map((cells, i) => {
    if (cells.length !== headers.length) throw new Error(`CSV record ${i + 2} has ${cells.length} fields; expected ${headers.length}`);
    const value = (idx: number) => cells[idx]?.trim() ?? "";
    if (!value(campaign) || !value(adSet)) throw new Error(`CSV record ${i + 2} needs campaign and ad-set names; campaign-level exports cannot be paired to ad-set rows`);
    const iso = dayIso(value(day));
    if (end !== undefined && dayIso(value(end)) !== iso) throw new Error(`CSV record ${i + 2} spans multiple days`);
    return {
      sourceRow: i + 2,
      campaign: value(campaign), adSet: value(adSet), day: iso,
      resultType: value(resultType),
      results: numeric(value(results), "Results", i + 2),
      spend: numeric(value(spend), "Amount spent", i + 2),
      cpr: numeric(value(cpr), "Cost per result", i + 2),
    };
  });
}

export function insightEvidence(input: unknown): { rows: EvidenceRow[]; decisions: unknown[] } {
  const data = Array.isArray(input) ? input : (input as { data?: unknown })?.data;
  if (!Array.isArray(data)) throw new Error("Insights JSON must be an array or an object with a data array (all pages captured)");
  if (!Array.isArray(input) && (input as { paging?: { next?: unknown } }).paging?.next) {
    throw new Error("Insights JSON still has paging.next; capture all pages before comparing");
  }
  for (const row of data) {
    if (!row || typeof row !== "object") throw new Error("Each Insights record must be an object");
    if (row.date_end && row.date_end !== row.date_start) throw new Error("Insights must be daily, not a period total");
  }
  const normalized = (data as MetaInsightRow[]).map(normalizeMetaInsightRow);
  // No dedupe or campaign-level enrichment: expose duplicate/missing rows at the mapper boundary.
  const cells = normalized.map(insightToManualCsvRow);
  const csv = [META_CSV_HEADERS, ...cells].map(row => row.map(v => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\n");
  return {
    rows: csvEvidence(csv),
    decisions: normalized.map((row, i) => ({
      sourceRow: i + 2,
      selected: manualExportPrimaryResult(row),
      optimizationGoal: row.optimization_goal ?? null,
      resultMetrics: row.results ?? null,
      resultCosts: row.cost_per_result ?? null,
      objectiveMetrics: row.objective_results ?? null,
      objectiveCosts: row.cost_per_objective_result ?? null,
      actions: row.actions ?? null,
      actionCosts: row.cost_per_action_type ?? null,
    })),
  };
}

const key = (row: EvidenceRow) => JSON.stringify([row.campaign, row.adSet, row.day]);
const typeText = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

export function diffRows(manual: EvidenceRow[], api: EvidenceRow[]) {
  const group = (rows: EvidenceRow[]) => {
    const map = new Map<string, EvidenceRow[]>();
    for (const row of rows) map.set(key(row), [...(map.get(key(row)) ?? []), row]);
    return map;
  };
  const left = group(manual), right = group(api);
  const rows = [...new Set([...left.keys(), ...right.keys()])].sort().map(k => {
    const m = left.get(k) ?? [], a = right.get(k) ?? [];
    const differences: Array<{ field: string; manual: unknown; api: unknown; delta?: number }> = [];
    let status: "equal" | "different" | "manual-only" | "api-only" | "ambiguous";
    if (m.length > 1 || a.length > 1) status = "ambiguous";
    else if (!m.length) status = "api-only";
    else if (!a.length) status = "manual-only";
    else {
      if (typeText(m[0].resultType) !== typeText(a[0].resultType)) {
        differences.push({ field: "resultType", manual: m[0].resultType, api: a[0].resultType });
      }
      for (const field of ["spend", "results", "cpr"] as const) {
        const x = m[0][field], y = a[0][field];
        // Preserve blank vs zero, require exact counts, permit at most half a cent monetary rounding.
        if (x === y) continue;
        if (x !== null && y !== null && Math.abs(x - y) <= (field === "results" ? 0 : 0.005000001)) continue;
        differences.push({ field, manual: x, api: y, ...(x !== null && y !== null ? { delta: y - x } : {}) });
      }
      status = differences.length ? "different" : "equal";
    }
    return { key: JSON.parse(k) as string[], status, manual: m, api: a, differences };
  });
  const totals = (evidence: EvidenceRow[]) => ({
    rows: evidence.length,
    spend: evidence.reduce((s, r) => s + (r.spend ?? 0), 0),
    // Mixed objectives are intentionally separate; a grand total of leads + reach is meaningless.
    resultsByType: Object.fromEntries([...new Set(evidence.map(r => typeText(r.resultType)))].sort().map(t => [
      t || "(blank)", evidence.filter(r => typeText(r.resultType) === t).reduce((s, r) => s + (r.results ?? 0), 0),
    ])),
  });
  return {
    comparison: "Exact trimmed campaign + ad-set + ISO day; names are case-sensitive; no dedupe, rollup, enrichment, or hybrid merge",
    tolerances: { results: 0, spend: 0.005, cpr: 0.005, blankEqualsZero: false },
    summary: Object.fromEntries(["equal", "different", "manual-only", "api-only", "ambiguous"].map(status => [status, rows.filter(r => r.status === status).length])),
    manualTotals: totals(manual), apiTotals: totals(api), rows,
  };
}
