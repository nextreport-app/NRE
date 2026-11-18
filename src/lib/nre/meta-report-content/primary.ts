import { objectiveRate } from "../objective-rate";
import { parseCsvText } from "../parse-csv";
import { rowsToCsv } from "../rows-to-csv";
import type {
  MetaContentSource,
  MetaReportContent,
  MetaObservation,
} from "./types";
/** Routing facts for existing date/campaign controls, never a claimed unsegmented source. */
export function audienceOnlyPrimary(source: MetaContentSource) {
  if (source.kind === "creative")
    throw Error(
      "Use an audience breakdown export for an audience-only import.",
    );
  const groups = new Map<string, MetaObservation[]>();
  for (const row of source.rows) {
    const key = JSON.stringify([
      row.campaignId || row.campaign,
      row.adSetId || row.adSet,
      row.date,
    ]);
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  const rows = [...groups.values()].map((group) => {
    if (new Set(group.map((row) => row.resultType)).size > 1)
      throw Error(
        "This audience export mixes primary result types within one campaign/day. Export one objective at a time.",
      );
    const sum = (
      key: "spend" | "impressions" | "clicks" | "results" | "linkClicks",
    ) =>
      group.some((row) => row[key] === null)
        ? null
        : group.reduce((n, row) => n + (row[key] ?? 0), 0);
    const spend = sum("spend")!,
      impressions = sum("impressions")!,
      clicks = sum("clicks"),
      results = sum("results");
    return [
      group[0].campaign,
      group[0].adSet ?? "",
      group[0].campaignId ?? "",
      group[0].adSetId ?? "",
      group[0].date,
      String(spend),
      String(impressions),
      results === null ? "—" : String(results),
      group[0].resultType,
      clicks === null ? "—" : String(clicks),
      clicks !== null && impressions > 0
        ? String((clicks / impressions) * 100)
        : "—",
      clicks !== null && clicks > 0 ? String(spend / clicks) : "—",
      sum("linkClicks") === null ? "—" : String(sum("linkClicks")),
      results !== null && results > 0
        ? String(objectiveRate(spend, results, group[0].resultLabel))
        : "—",
    ];
  });
  const parsed = parseCsvText(
    rowsToCsv(
      [
        "Campaign name",
        "Ad set name",
        "Campaign ID",
        "Ad set ID",
        "Day",
        `Amount spent (${source.currency})`,
        "Impressions",
        "Results",
        "Result type",
        "Clicks (all)",
        "CTR (all)",
        "CPC (all)",
        "Link clicks",
        "Cost per result",
      ],
      rows,
    ),
  );
  const audience =
    source.kind === "platform-placement"
      ? (["platform", "placement"] as const)
      : ([source.kind] as const);
  const content: MetaReportContent = {
    version: 1,
    sourceOnly: true,
    options: {
      audience: [...audience],
      creatives: false,
      includeStandard: false,
      ranking: "cpr",
      minSpend: 0,
      minResults: 5,
    },
    sources: [source],
    media: {},
    notices: [
      "Audience-only import. Standard performance slides are off because this file contains a breakdown view.",
    ],
  };
  return { parsed, content };
}
export function hasAudienceColumns(headers: string[]) {
  return headers.some((header) =>
    /^(age|gender|country|region|placement|platform|publisher[ _]platform|platform[ _]position)$/i.test(
      header.trim(),
    ),
  );
}
