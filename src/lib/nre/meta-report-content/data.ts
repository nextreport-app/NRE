import { metaClientNarrative } from "../report-client-narrative";
import { metaReportTitle } from "./selection";
import type { NreRow } from "../columns";
import { getRowDate, rowHasDailyDate } from "../columns";
import { parseDate, getDateRangeAbbrLabel } from "../dates";
import { computeCsvDateBounds, type DateRangeIso } from "../date-range";
import { getResultLabels, resultTypeTextForObjectiveDetection } from "../objective";
import { objectiveRate } from "../objective-rate";
import { fmtCurrency2dp } from "../format";
import { detectCsvCurrency } from "../csv-currency";
import {
  DIMENSION_LABELS,
  type MetaContentSource,
  type MetaReportContent,
  type MetaObservation,
  type MetaPerformanceRow,
  type MetaContentPresentation,
  type MetaContentPage,
  type AudienceDimension,
} from "./types";
const normalized = (key: string) =>
  key.trim().toLowerCase().replaceAll("_", " ");
export function rawCell(row: NreRow, names: string[]): string | undefined {
  const key = Object.keys(row._raw ?? {}).find((key) =>
    names.includes(normalized(key)),
  );
  return key === undefined ? undefined : row._raw[key];
}
function number(raw: string | undefined, optional = false): number | null {
  if (raw === undefined || /^(?:—|-|n\/?a|not available)$/i.test(raw.trim()))
    return optional ? null : 0;
  if (!raw.trim()) return 0;
  const n = Number(raw.replaceAll(",", "").replace(/[%$£₹]/g, ""));
  if (!Number.isFinite(n) || n < 0)
    throw Error(
      "A breakdown or ad export contains invalid or negative metrics. Check the source values.",
    );
  return n;
}
function dim(row: NreRow, names: string[]) {
  return rawCell(row, names)?.trim() || "Unknown";
}
/** Normalize each source independently; breakdowns are never concatenated into account totals. */
export function parseMetaContentSource(
  parsed: { rows: NreRow[]; headers: string[] },
  currency: string,
): MetaContentSource {
  const { rows, headers } = parsed;
  if (
    rows.some((row) => row.spend === undefined || row.impressions === undefined)
  )
    throw Error("Include Amount spent and Impressions in each export.");
  if (!rows.length || rows.length > 100000)
    throw Error("Upload an export with 1–100,000 daily rows.");
  const header = (names: string[]) =>
    headers.some((h) => names.includes(normalized(h)));
  const has = (name: string[]) =>
    header(name) && rows.some((row) => !!rawCell(row, name)?.trim());
  const dimensions = [
    has(["age"]),
    has(["region", "country"]),
    has(["platform", "publisher platform"]),
    has(["placement", "platform position"]),
  ];
  if (
    (dimensions[0] && dimensions.slice(1).some(Boolean)) ||
    (dimensions[1] && (dimensions[2] || dimensions[3]))
  )
    throw Error(
      "Use separate exports for Age and Location. Platform and Placement can share one export.",
    );
  if (has(["region"]) && has(["country"]))
    throw Error("Use either Country or Region in a location export, not both.");
  if (has(["gender"]))
    throw Error(
      "Remove the Gender breakdown for now; upload the Age breakdown on its own.",
    );
  let kind: MetaContentSource["kind"];
  if (dimensions[0]) kind = "age";
  else if (dimensions[1]) kind = "location";
  else if (dimensions[2] && dimensions[3]) kind = "platform-placement";
  else if (dimensions[2]) kind = "platform";
  else if (dimensions[3]) kind = "placement";
  else if (header(["ad id"]) && has(["ad name"])) kind = "creative";
  else
    throw Error(
      "This file needs Age, Region/Country, Platform/Placement, or Ad ID and Ad name columns.",
    );
  const detected = detectCsvCurrency(headers, rows);
  if (detected.error) throw Error(detected.error);
  if (detected.code && detected.code !== currency)
    throw Error(
      `This export uses ${detected.code}; the report uses ${currency}. Upload matching currencies.`,
    );
  if (!rows.every(rowHasDailyDate))
    throw Error(
      "Export these sections with a Day breakdown so the report can select the correct dates.",
    );
  const coverage = computeCsvDateBounds(rows);
  if (!coverage) throw Error("The export has no valid date coverage.");
  const identities = new Set<string>();
  const hasDevicePlatform = header(["device platform"]);
  const deviceScopes = new Map<string, boolean>();
  const observations = rows.map((row) => {
    const date = parseDate(getRowDate(row));
    if (!date || !row.campaign_name?.trim())
      throw Error("Every breakdown/ad row needs a campaign and a valid Day.");
    const resultType =
      resultTypeTextForObjectiveDetection(row) ||
      rawCell(row, ["result type"])?.trim() ||
      "";
    if (resultType.length > 200)
      throw Error(
        "The Result type label is too long. Use the primary result column from Ads Manager.",
      );
    const action = rawCell(row, ["nre api result action"]);
    const websitePurchase =
      /website.*purchase|purchase.*website/i.test(resultType) ||
      /offsite.*purchase/i.test(action ?? "");
    const labels = getResultLabels(resultType);
    const resultLabel =
      labels.resultLabel === "RESULTS" && resultType
        ? resultType.toUpperCase()
        : labels.resultLabel;
    const o: MetaObservation = {
      date: `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`,
      campaign: row.campaign_name.trim(),
      campaignId: rawCell(row, ["campaign id"]),
      adSet: row.ad_set_name,
      adSetId: rawCell(row, ["ad set id"]),
      adId: rawCell(row, ["ad id"])?.trim(),
      adName: rawCell(row, ["ad name"])?.trim(),
      resultType,
      resultLabel,
      costLabel: labels.costLabel,
      resultAction: rawCell(row, ["nre api result action"]),
      spend: number(row.spend)!,
      impressions: number(row.impressions)!,
      results: resultType ? number(row.results, true) : null,
      clicks: number(rawCell(row, ["clicks (all)", "clicks"]), true),
      linkClicks: number(row.link_clicks, true),
      landingViews: number(row.landing_page_views, true),
      purchaseValue: number(
        rawCell(row, [
          "nre purchase value",
          ...(websitePurchase
            ? [
                "website purchases conversion value",
                "website purchase conversion value",
              ]
            : [
                "purchases conversion value",
                "purchase conversion value",
                "purchase value",
              ]),
        ]),
        true,
      ),
      attribution: rawCell(row, ["attribution setting"]),
      devicePlatform: rawCell(row, ["device platform"])?.trim() || undefined,
      ...(dimensions[0] ? { age: dim(row, ["age"]) } : {}),
      ...(dimensions[1] ? { location: dim(row, ["region", "country"]) } : {}),
      ...(dimensions[2]
        ? { platform: dim(row, ["platform", "publisher platform"]) }
        : {}),
      ...(dimensions[3]
        ? { placement: dim(row, ["placement", "platform position"]) }
        : {}),
    };
    if (kind === "creative" && !o.adId)
      throw Error(
        "Every creative row needs an Ad ID. Names alone cannot safely match ads or images.",
      );
    if (kind === "creative" && !/^\d{1,40}$/.test(o.adId!))
      throw Error("The export has an invalid Ad ID.");
    const identity = [
      o.campaignId || o.campaign,
      o.adSetId || o.adSet,
      o.adId,
      o.date,
      o.age,
      o.location,
      o.platform,
      o.placement,
    ];
    // Device platform subdivides one placement (e.g. Desktop versus In-app).
    // Preserve disjoint slices, but never combine a placement total with them.
    const deviceTotal = !o.devicePlatform || /^(?:all|total)(?: devices?| platforms?)?$/i.test(o.devicePlatform);
    const scopeId = JSON.stringify(identity);
    if (hasDevicePlatform && deviceScopes.has(scopeId) && deviceScopes.get(scopeId) !== deviceTotal)
      throw Error("This export mixes placement totals with device-level rows. Export one consistent breakdown without overlapping totals.");
    deviceScopes.set(scopeId, deviceTotal);
    const id = JSON.stringify([...identity, deviceTotal ? null : o.devicePlatform]);
    if (identities.has(id))
      throw Error(
        "This export has duplicate rows at the same day and breakdown/ad level. Remove overlapping totals before uploading.",
      );
    identities.add(id);
    return o;
  });
  // Meta omits Result type on zero-result days/cohorts. Inherit only an
  // unambiguous event explicitly observed in the same campaign/ad-set scope;
  // otherwise off-day spend would be excluded from that event's period cost.
  const events = new Map<string, Map<string, MetaObservation>>();
  const scope = (row: MetaObservation) =>
    JSON.stringify([row.campaignId || row.campaign, row.adSetId || row.adSet]);
  for (const row of observations)
    if (row.resultType) {
      const map = events.get(scope(row)) ?? new Map<string, MetaObservation>();
      map.set(row.resultType, row);
      events.set(scope(row), map);
    }
  observations.forEach((row, index) => {
    if (row.resultType) return;
    const count = number(rows[index].results, true);
    if (count !== null && count > 0)
      throw Error(
        "Positive Results need a Result type. Include the primary Result type column in the export.",
      );
    const known = events.get(scope(row));
    if (known?.size !== 1) return;
    const event = [...known.values()][0];
    row.resultType = event.resultType;
    row.resultLabel = event.resultLabel;
    row.costLabel = event.costLabel;
    row.resultAction = event.resultAction;
    row.results = count;
    const websitePurchase =
      /website.*purchase|purchase.*website/i.test(row.resultType) ||
      /offsite.*purchase/i.test(row.resultAction ?? "");
    row.purchaseValue = number(
      rawCell(rows[index], [
        "nre purchase value",
        ...(websitePurchase
          ? [
              "website purchases conversion value",
              "website purchase conversion value",
            ]
          : [
              "purchases conversion value",
              "purchase conversion value",
              "purchase value",
            ]),
      ]),
      true,
    );
  });
  if (kind !== "creative") {
    const adSets = new Map<string, Set<string>>();
    for (const row of observations) {
      const names =
        adSets.get(row.campaignId || row.campaign) ?? new Set<string>();
      if (row.adSetId || row.adSet) names.add(row.adSetId || row.adSet!);
      adSets.set(row.campaignId || row.campaign, names);
    }
    if ([...adSets.values()].some((names) => names.size > 1))
      throw Error(
        "For audience totals across multiple ad sets, export at Campaign level. Ad-set conversions can overlap; a single-ad-set export is also supported.",
      );
  }
  const attribution = new Set(
    observations.map((o) => o.attribution).filter(Boolean),
  );
  if (attribution.size > 1)
    throw Error(
      "Use one attribution setting within each breakdown or creative export.",
    );
  return {
    kind,
    locationLevel:
      kind === "location"
        ? header(["country"])
          ? "country"
          : "region"
        : undefined,
    source: "csv",
    currency,
    coverage: { startIso: coverage.minIso, endIso: coverage.maxIso },
    rows: observations,
  };
}
function sum(
  rows: MetaObservation[],
  key: "clicks" | "linkClicks" | "landingViews" | "purchaseValue" | "results",
): number | null {
  return rows.some((row) => row[key] === null)
    ? null
    : rows.reduce((n, row) => n + (row[key] ?? 0), 0);
}
function aggregate(
  rows: MetaObservation[],
  key: string,
  name: string,
  content: MetaReportContent,
): MetaPerformanceRow {
  const spend = rows.reduce((n, r) => n + r.spend, 0),
    impressions = rows.reduce((n, r) => n + r.impressions, 0);
  const clicks = sum(rows, "clicks"),
    results = ["REACH", "AD RECALL LIFT"].includes(rows[0].resultLabel)
      ? null
      : sum(rows, "results"),
    value = sum(rows, "purchaseValue"),
    landings = sum(rows, "landingViews");
  const purchase = /purchase/i.test(rows[0].resultType),
    website = /website|offsite|pixel/i.test(
      `${rows[0].resultType} ${rows[0].resultAction ?? ""}`,
    );
  const roas = purchase && value !== null && spend > 0 ? value / spend : null;
  const ctr =
    clicks !== null && impressions > 0 ? (clicks / impressions) * 100 : null;
  const metric = content.options.ranking;
  const eligible =
    spend >= content.options.minSpend &&
    (metric === "cpr"
      ? results !== null && results >= Math.max(1, content.options.minResults)
      : metric === "roas"
        ? roas !== null &&
          results !== null &&
          results >= Math.max(1, content.options.minResults)
        : metric === "ctr"
          ? ctr !== null && impressions >= 100
          : spend > 0);
  return {
    key,
    name,
    adId: rows[0].adId,
    campaign: rows[0].campaign,
    spend,
    impressions,
    results,
    ctr,
    cpr:
      results !== null
        ? objectiveRate(spend, results, rows[0].resultLabel)
        : null,
    cpc: clicks !== null && clicks > 0 ? spend / clicks : null,
    cpm: impressions > 0 ? (spend / impressions) * 1000 : null,
    roas,
    websiteCvr:
      website && results !== null && landings !== null && landings > 0
        ? (results / landings) * 100
        : null,
    eligible,
  };
}
function sourceFor(content: MetaReportContent, dimension: AudienceDimension) {
  const matches = content.sources.filter(
    (s) =>
      s.kind === dimension ||
      (["platform", "placement"].includes(dimension) &&
        s.kind === "platform-placement"),
  );
  if (matches.length > 1)
    throw Error(
      `More than one export supplies ${DIMENSION_LABELS[dimension]}. Keep one source per breakdown.`,
    );
  return matches[0];
}
export function buildMetaContentPresentation(
  content: MetaReportContent | undefined,
  ranges: DateRangeIso[],
  campaigns: string[] | null,
  currencySymbol: string,
): MetaContentPresentation | undefined {
  if (!content) return undefined;
  if (
    campaigns &&
    content.campaigns &&
    campaigns.some(
      (name) =>
        !content.campaigns!.some(
          (loaded) => loaded.trim().toLowerCase() === name.trim().toLowerCase(),
        ),
    )
  )
    throw Error(
      "Campaign selection changed. Refresh the audience/creative sections for the new selection.",
    );
  const pages: MetaContentPage[] = [];
  const selected = campaigns
    ? new Set(campaigns.map((n) => n.trim().toLowerCase()))
    : null;
  for (const range of ranges) {
    const dateLabel = getDateRangeAbbrLabel(range.startIso, range.endIso);
    const inRange = (source: MetaContentSource) => {
      if (
        source.coverage.startIso > range.startIso ||
        source.coverage.endIso < range.endIso
      )
        throw Error(
          `The ${source.kind} export does not cover ${dateLabel}. Refresh this section with a matching date range.`,
        );
      return source.rows.filter(
        (r) =>
          r.date >= range.startIso &&
          r.date <= range.endIso &&
          (!selected || selected.has(r.campaign.toLowerCase())),
      );
    };
    for (const dimension of [
      ...content.options.audience,
      ...(content.options.creatives ? ["creative" as const] : []),
    ]) {
      const source =
        dimension === "creative"
          ? content.sources.find((s) => s.kind === "creative")
          : sourceFor(content, dimension);
      if (!source)
        throw Error(
          `Add a matching ${dimension} export, or fetch this section from Meta.`,
        );
      const rows = inRange(source).filter(
        (r) =>
          dimension !== "creative" ||
          !content.options.selectedAdIds ||
          content.options.selectedAdIds.includes(r.adId!),
      );
      const objectives = [
        ...new Set(rows.map((row) => row.resultLabel)),
      ].sort();
      if (!rows.length) {
        pages.push({
          id: `${dimension}-${range.startIso}-empty`,
          kind: dimension === "creative" ? "creative-table" : "audience",
          title:
            dimension === "creative"
              ? "Creative performance"
              : `${DIMENSION_LABELS[dimension]} performance`,
          dateLabel,
          objective: "Results",
          costLabel: "Cost per result",
          rows: [],
          note: "No source observations for the selected campaigns and dates. This does not establish why delivery was absent.",
        });
        continue;
      }
      for (const objective of objectives) {
        const scoped = rows.filter((row) => row.resultLabel === objective);
        const grouped = new Map<string, MetaObservation[]>();
        for (const row of scoped) {
          const key =
            dimension === "creative"
              ? row.adId!
              : dimension === "placement"
                ? JSON.stringify([row.platform ?? "", row.placement])
                : row[dimension]!;
          const group = grouped.get(key) ?? [];
          group.push(row);
          grouped.set(key, group);
        }
        const metrics = [...grouped].map(([key, group]) =>
          aggregate(
            group,
            key,
            dimension === "creative"
              ? `${group[0].adName || key}`
              : dimension === "placement"
                ? [group[0].platform, group[0].placement]
                    .filter(Boolean)
                    .join(" · ")
                : key,
            content,
          ),
        );
        metrics.sort((a, b) => {
          if (dimension !== "creative") return b.spend - a.spend;
          if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
          const k = content.options.ranking;
          return k === "cpr"
            ? (a.cpr ?? Infinity) - (b.cpr ?? Infinity)
            : k === "roas"
              ? (b.roas ?? -Infinity) - (a.roas ?? -Infinity)
              : k === "ctr"
                ? (b.ctr ?? -Infinity) - (a.ctr ?? -Infinity)
                : b.spend - a.spend;
        });
        if (dimension === "creative") {
          let rank = 0;
          metrics.forEach((r) => {
            if (r.eligible) r.rank = ++rank;
          });
        }
        const eligible = metrics.find((row) => row.eligible),
          top = metrics[0];
        const short = (name: string) =>
          name.length > 40 ? name.slice(0, 37) + "…" : name;
        const insight =
          dimension !== "creative"
            ? `Highest spend: ${short(top.name)} · ${fmtCurrency2dp(top.spend, currencySymbol)}.`
            : eligible
              ? content.options.ranking === "cpr"
                ? `Lowest eligible cost per result: ${short(eligible.name)} · ${fmtCurrency2dp(eligible.cpr!, currencySymbol)} (${eligible.results} results).`
                : content.options.ranking === "roas"
                  ? `Highest eligible purchase ROAS: ${short(eligible.name)} · ${eligible.roas!.toFixed(2)}x.`
                  : content.options.ranking === "ctr"
                    ? `Highest eligible CTR (all): ${short(eligible.name)} · ${eligible.ctr!.toFixed(2)}%. This does not establish conversion quality.`
                    : `Highest eligible spend: ${short(eligible.name)} · ${fmtCurrency2dp(eligible.spend, currencySymbol)}.`
              : "No ads meet the ranking thresholds. Their available metrics remain below.";
        const prefix = `${dimension}-${range.startIso}-${objective}`;
        const note =
          dimension === "creative"
            ? `Ranked within this objective by ${content.options.ranking === "cpr" ? "cost per result" : content.options.ranking.toUpperCase()}. Minimum spend ${currencySymbol}${content.options.minSpend}; ${content.options.minResults} results for cost/ROAS rankings. Unranked ads remain included. CTR uses all clicks; ROAS uses purchase value / spend; CVR uses website results / landing-page views. — means unavailable. Previews are representative assets, not asset-level attribution.`
            : "";
        const narrative = metaClientNarrative({
          rows: metrics, total: aggregate(scoped, "total", "Total", content),
          objective, costLabel: scoped[0].costLabel, currency: currencySymbol,
          dimension: dimension === "creative" ? "Creative" : DIMENSION_LABELS[dimension],
          creative: dimension === "creative", options: content.options,
        });
        pages.push({id: `${prefix}-summary`, kind: "summary",
          title: `${dimension === "creative" ? "Creative" : DIMENSION_LABELS[dimension]} overview`,
          dateLabel, objective, costLabel: scoped[0].costLabel, rows: [],
          insight: narrative.summary, note: narrative.insights.join("\n"),
        });
        for (let start = 0; start < metrics.length; start += 8)
          pages.push({
            id: `${prefix}-${start}`,
            kind: dimension === "creative" ? "creative-table" : "audience",
            title:
              (dimension === "creative"
                ? "Creative performance"
                : `${DIMENSION_LABELS[dimension]} performance`) +
              (metrics.length > 8
                ? ` · ${start / 8 + 1}/${Math.ceil(metrics.length / 8)}`
                : ""),
            dateLabel,
            objective,
            costLabel: scoped[0].costLabel,
            rows: metrics.slice(start, start + 8),
            note,
            insight,
          });
        if (dimension === "creative")
          for (const r of metrics
            .filter((row) => !!content.media[row.adId ?? ""])
            .slice(0, 12))
            pages.push({
              id: `${prefix}-preview-${r.key}`,
              kind: "creative-preview",
              title: r.name,
              dateLabel,
              objective,
              costLabel: scoped[0].costLabel,
              rows: [r],
              note:
                content.media[r.adId ?? ""]?.label ??
                "Creative preview unavailable. Metrics remain included; add an image mapped to this Ad ID if desired.",
            });
      }
    }
  }
  if (!pages.length && !content.options.includeStandard)
    throw Error(
      "Include standard performance or at least one audience/creative section.",
    );
  if (pages.length > 500)
    throw Error(
      "These sections would exceed 500 pages. Select fewer campaigns or ads, or a shorter date range.",
    );
  const media = Object.fromEntries(
    pages
      .filter((page) => page.kind === "creative-preview")
      .flatMap((page) =>
        page.rows.map((row) => [row.adId!, content.media[row.adId!]]),
      ),
  );
  const result = {
    reportKind: content.selection?.kind,
    title: content.selection ? metaReportTitle(content.selection) : undefined,
    includeStandard: content.options.includeStandard,
    currencySymbol,
    pages,
    notices: content.notices,
    media,
  };
  if (JSON.stringify(result).length > 1100000)
    throw Error(
      "These sections are too large. Select fewer ads or smaller images.",
    );
  return result;
}
export function metaContentSummary(content: MetaReportContent | undefined) {
  if (!content) return null;
  const ads = new Map<
    string,
    { id: string; name: string; hasImage: boolean }
  >();
  for (const source of content.sources)
    if (source.kind === "creative")
      for (const row of source.rows)
        if (row.adId)
          ads.set(row.adId, {
            id: row.adId,
            name: row.adName || row.adId,
            hasImage: !!content.media[row.adId],
          });
  return {
    sourceOnly: content.sourceOnly,
    selection: content.selection,
    options: content.options,
    campaigns: content.campaigns,
    sources: content.sources.map((s) => ({
      kind: s.kind,
      coverage: s.coverage,
      rows: s.rows.length,
    })),
    ads: [...ads.values()],
    notices: content.notices,
  };
}
