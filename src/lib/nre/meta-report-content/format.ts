import { fmtCurrency2dp, fmtResultCount } from "../format";
import type { MetaContentPage, MetaPerformanceRow } from "./types";
export const metricNumber = (
  n: number | null,
  kind: "number" | "money" | "percent" | "ratio",
  currency: string,
) =>
  n === null
    ? "—"
    : kind === "money"
      ? fmtCurrency2dp(n, currency)
      : kind === "percent"
        ? `${n.toFixed(2)}%`
        : kind === "ratio"
          ? `${n.toFixed(2)}x`
          : fmtResultCount(n);
export function metaPageTable(
  page: MetaContentPage,
  currency: string,
): string[][] {
  const showRoas = page.rows.some((row) => row.roas !== null),
    showCvr = page.rows.some((row) => row.websiteCvr !== null);
  const headers = [
    page.kind === "audience" ? "Segment" : "Ad",
    "Spend",
    "Impressions",
    page.objective,
    page.costLabel,
    "CTR (all)",
    ...(showRoas ? ["ROAS"] : []),
    ...(showCvr ? ["Website CVR"] : []),
  ];
  return [
    headers,
    ...page.rows.map((row) => [
      `${page.kind === "creative-table" ? (row.rank ? `${row.rank}. ` : "") : ""}${row.name.length > 36 ? row.name.slice(0, 36) + "…" : row.name}${page.kind === "creative-table" ? ` · ID ${row.adId}` : ""}`,
      metricNumber(row.spend, "money", currency),
      metricNumber(row.impressions, "number", currency),
      metricNumber(row.results, "number", currency),
      metricNumber(row.cpr, "money", currency),
      metricNumber(row.ctr, "percent", currency),
      ...(showRoas ? [metricNumber(row.roas, "ratio", currency)] : []),
      ...(showCvr ? [metricNumber(row.websiteCvr, "percent", currency)] : []),
    ]),
  ];
}
export function metaPreviewMetrics(
  row: MetaPerformanceRow,
  page: MetaContentPage,
  currency: string,
) {
  return [
    ["Ad spend", metricNumber(row.spend, "money", currency)],
    [page.objective, metricNumber(row.results, "number", currency)],
    [page.costLabel, metricNumber(row.cpr, "money", currency)],
    ["CTR (all)", metricNumber(row.ctr, "percent", currency)],
    ["ROAS", metricNumber(row.roas, "ratio", currency)],
    ["Website CVR", metricNumber(row.websiteCvr, "percent", currency)],
    ["CPC (all)", metricNumber(row.cpc, "money", currency)],
    ["CPM", metricNumber(row.cpm, "money", currency)],
  ]
    .filter(([label]) => label !== "ROAS" || row.roas !== null)
    .filter(([label]) => label !== "Website CVR" || row.websiteCvr !== null);
}
