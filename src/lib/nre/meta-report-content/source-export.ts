import { assertMetaReportSource, type MetaReportSelection } from "./selection";
import type { MetaContentSource, MetaReportContent } from "./types";

/** Export only normalized report facts, never credentials or a Graph payload. */
export function metaReportSourceExport(selection: MetaReportSelection, content?: MetaReportContent) {
  const source = content?.sources.find(source => {
    try { assertMetaReportSource(selection, source); return true; }
    catch { return false; }
  });
  if (!source) return null;
  const period = source.granularity === "period";
  const dimensions: [string, keyof MetaContentSource["rows"][number]][] =
    source.kind === "age" ? [["Age", "age"]] :
    source.kind === "location" ? [[source.locationLevel === "country" ? "Country" : "Region", "location"]] :
    source.kind === "platform" ? [["Platform", "platform"]] :
    source.kind === "placement" ? [["Placement", "placement"]] :
    source.kind === "platform-placement" ? [["Platform", "platform"], ["Placement", "placement"]] : [];
  const headers = ["Campaign ID", "Campaign name", "Ad set ID", "Ad set name", "Ad ID", "Ad name",
    ...(period ? ["Reporting starts", "Reporting ends"] : ["Day"]),
    ...dimensions.map(([name]) => name), "Device platform", `Amount spent (${source.currency})`,
    "Impressions", "Results", "Result type", "NRE API result action", "Clicks (all)", "Link clicks",
    "Landing page views", "NRE purchase value", "Attribution setting"];
  return {
    headers, rowCount: source.rows.length,
    granularity: source.granularity ?? "daily", coverage: source.coverage,
    row(index: number) {
      const r = source.rows[index];
      return [r.campaignId ?? "", r.campaign, r.adSetId ?? "", r.adSet ?? "", r.adId ?? "", r.adName ?? "",
        ...(period ? [source.coverage.startIso, source.coverage.endIso] : [r.date]),
        ...dimensions.map(([, key]) => r[key] ?? ""), r.devicePlatform ?? "", r.spend, r.impressions,
        r.results ?? "—", r.resultType, r.resultAction ?? "", r.clicks ?? "—", r.linkClicks ?? "—",
        r.landingViews ?? "—", r.purchaseValue ?? "—", r.attribution ?? ""];
    },
  };
}
