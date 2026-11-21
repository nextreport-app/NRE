import {
  metaGraphBase,
  fetchMetaAdSetReportingConfigs,
  fetchMetaCustomConversions,
  type MetaInsightRow,
  formatMetaInsightsErrorMessage,
} from "@/lib/meta-api";
import {
  configuredResultAction,
  configuredCustomEventName,
} from "../meta-api-sync/configured-result-event";
import { directlyEvidencedResult,configuredResultCountSource } from "../meta-api-sync/direct-result-evidence";
import {
  META_CSV_HEADERS,
  insightToManualCsvRowWithResult,
} from "../meta-api-sync/insight-engine";
import { buildMetaCustomConversionResultTypeMap } from "../meta-custom-conversion-labels";
import { parseCsvText } from "../parse-csv";
import { rowsToCsv } from "../rows-to-csv";
import { parseMetaContentSource } from "./data";
import type { DateRangeIso } from "../date-range";
import type {
  MetaContentOptions,
  MetaContentSource,
  CreativeMediaSnapshot,
} from "./types";
import sharp from "sharp";
import { splitIsoDateRangeIntoChunks } from "../api-date-range";

/** Never follow Graph's absolute paging URLs or expose tokens through URLs/errors. */
export async function metaContentGraph<T>(
  token: string,
  path: string,
  params: Record<string, string> = {},
  timeoutMs = 45000,
): Promise<T> {
  const url = new URL(`${metaGraphBase()}/${path.replace(/^\//, "")}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    const json = await response.json();
    if (response.ok && !json.error) return json as T;
    const transient =
      response.status === 429 ||
      response.status >= 500 ||
      [1, 2, 4, 17, 32, 613].includes(json.error?.code);
    if (transient && attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
      continue;
    }
    throw Error(
      json.error
        ? formatMetaInsightsErrorMessage(json.error)
        : "Meta could not provide this section. Retry or use its CSV export.",
    );
  }
  throw Error("Meta did not complete this section. Retry sync.");
}
async function insightsChunk(
  token: string,
  account: string,
  range: DateRangeIso,
  kind: string,
  campaignIds: string[],
  locationLevel = "region",
  periodTotals = false,
): Promise<Record<string, unknown>[]> {
  const result: Record<string, unknown>[] = [];
  let after: string | undefined;
  const breakdowns =
    kind === "age"
      ? "age"
      : kind === "location"
        ? locationLevel
        : kind === "platform"
          ? "publisher_platform"
          : kind === "placement" || kind === "platform-placement"
            ? "publisher_platform,platform_position"
            : "";
  const fields = [
    "campaign_id",
    "campaign_name",
    ...(kind === "creative"
      ? ["adset_id", "adset_name", "ad_id", "ad_name"]
      : []),
    "date_start",
    "date_stop",
    "spend",
    "impressions",
    "clicks",
    "inline_link_clicks",
    "reach",
    "frequency",
    "ctr",
    "cpc",
    "actions",
    "action_values",
    "conversions",
  ];
  for (let page = 0; page < 200; page++) {
    const json = await metaContentGraph<{
      data: Record<string, unknown>[];
      paging?: { cursors?: { after?: string }; next?: string };
    }>(token, `act_${account.replace(/^act_/, "")}/insights`, {
      fields: fields.join(","),
      level: kind === "creative" ? "ad" : "campaign",
      filtering: JSON.stringify([
        { field: "campaign.id", operator: "IN", value: campaignIds },
      ]),
      time_increment: periodTotals ? "all_days" : "1",
      time_range: JSON.stringify({
        since: range.startIso,
        until: range.endIso,
      }),
      use_unified_attribution_setting: "true",
      limit: "500",
      ...(breakdowns ? { breakdowns } : {}),
      ...(after ? { after } : {}),
    });
    if (!Array.isArray(json.data))
      throw Error(
        "Meta returned an incomplete breakdown response. Retry this section.",
      );
    result.push(...json.data);
    if (result.length > 100000)
      throw Error(
        "This section is too large. Select fewer campaigns or a shorter date range.",
      );
    if (!json.paging?.next) return result;
    const next = json.paging.cursors?.after;
    if (!next || next === after)
      throw Error("Meta pagination did not advance. Retry this section.");
    after = next;
  }
  throw Error("This section needs too many pages. Choose a shorter period.");
}
async function insights(
  token: string,
  account: string,
  range: DateRangeIso,
  kind: string,
  campaignIds: string[],
  locationLevel = "region",
  periodTotals = false,
): Promise<Record<string, unknown>[]> {
  // Whole-period results must come from Meta, not sums of privacy-limited days.
  if (periodTotals)
    return insightsChunk(token, account, range, kind, campaignIds, locationLevel, true);
  const rows: Record<string, unknown>[] = [];
  for (const chunk of splitIsoDateRangeIntoChunks(
    range.startIso,
    range.endIso,
    28,
  )) {
    rows.push(
      ...(await insightsChunk(
        token,
        account,
        { startIso: chunk.sinceIso, endIso: chunk.untilIso },
        kind,
        campaignIds,
        locationLevel,
      )),
    );
    if (rows.length > 100000)
      throw Error(
        "This section is too large. Select fewer campaigns or a shorter date range.",
      );
  }
  return rows;
}
export async function fetchMetaContentSources(input: {
  token: string;
  account: string;
  currency: string;
  range: DateRangeIso;
  options: MetaContentOptions;
  primaryRows: import("../columns").NreRow[];
  /** Standalone reports consume exactly one selected period. */
  periodTotals?: boolean;
}): Promise<MetaContentSource[]> {
  const kinds: string[] = [];
  if (input.options.audience.includes("age")) kinds.push("age");
  if (input.options.audience.includes("location")) kinds.push("location");
  if (input.options.audience.includes("placement"))
    kinds.push("platform-placement");
  else if (input.options.audience.includes("platform")) kinds.push("platform");
  if (input.options.creatives) kinds.push("creative");
  const campaignAdSets = new Map<string, Set<string>>();
  for (const row of input.primaryRows) {
    const raw = row._raw ?? {};
    const keys = Object.keys(raw);
    const campaign = raw[keys.find((k) => /^campaign[ _]id$/i.test(k)) ?? ""],
      adset = raw[keys.find((k) => /^ad[ _]set[ _]id$/i.test(k)) ?? ""];
    if (campaign && adset) {
      const ids = campaignAdSets.get(campaign) ?? new Set<string>();
      ids.add(adset);
      campaignAdSets.set(campaign, ids);
    }
  }
  const campaignIds = [...campaignAdSets.keys()].filter((id) =>
    /^\d+$/.test(id),
  );
  if (!campaignIds.length)
    throw Error(
      "The API import has no stable campaign/ad-set IDs. Return to Import and sync again.",
    );
  const configs = await fetchMetaAdSetReportingConfigs(
    input.token,
    [...new Set([...campaignAdSets.values()].flatMap((ids) => [...ids]))],
    true,
  );
  const byId = new Map(configs.map((c) => [c.id, c]));
  const customCatalog = await fetchMetaCustomConversions(
    input.token,
    input.account,
  )
    .then(buildMetaCustomConversionResultTypeMap)
    .catch(() => ({}) as Record<string, string>);
  const datasets: MetaContentSource[] = [];
  for (const kind of kinds) {
    const raw = await insights(
      input.token,
      input.account,
      input.range,
      kind,
      campaignIds,
      input.options.locationLevel,
      input.periodTotals,
    );
    if (!raw.length) {
      datasets.push({
        kind: kind as MetaContentSource["kind"],
        source: "api",
        currency: input.currency,
        coverage: input.range,
        granularity: input.periodTotals ? "period" : "daily",
        rows: [],
      });
      continue;
    }
    const extraHeaders = [
      "Ad ID",
      "Ad name",
      "Age",
      input.options.locationLevel === "country" ? "Country" : "Region",
      "Platform",
      "Placement",
      "NRE purchase value",
      "Attribution setting",
    ];
    const wanted =
      kind === "creative"
        ? [0, 1]
        : kind === "age"
          ? [2]
          : kind === "location"
            ? [3]
            : kind === "platform"
              ? [4]
              : [4, 5];
    const rows = raw.map((raw) => {
      const row = raw as unknown as MetaInsightRow;
      if (input.periodTotals && (row.date_start !== input.range.startIso || row.date_stop !== input.range.endIso))
        throw Error("Meta returned totals for different dates. Refresh this section before generating the report.");
      const candidates =
        kind === "creative"
          ? [byId.get(row.adset_id ?? "")]
          : [...(campaignAdSets.get(row.campaign_id ?? "") ?? [])].map((id) =>
              byId.get(id),
            );
      const signatures = new Set(
        candidates
          .filter(Boolean)
          .map(
            (config) =>
              `${config!.optimization_goal}:${configuredResultAction(config!) ?? ""}:${configuredCustomEventName(config!) ?? ""}`,
          ),
      );
      if (signatures.size > 1)
        throw Error(
          "A campaign uses multiple result events across its ad sets. Use a campaign-level CSV breakdown with its chosen Result type for this report.",
        );
      const config = candidates[0];
      if (!config)
        throw Error(
          "Meta did not return the ad-set event configuration. Retry before reporting its results.",
        );
      const attributions = new Set(
        candidates
          .filter(Boolean)
          .map((config) =>
            JSON.stringify(
              (config!.attribution_spec ?? [])
                .map((rule) => `${rule.event_type}:${rule.window_days}`)
                .sort(),
            ),
          ),
      );
      if (attributions.size > 1)
        throw Error(
          "A campaign uses different attribution windows across its ad sets. Use a campaign-level CSV with one consistent attribution setting.",
        );
      const attribution = [...attributions][0];
      row.optimization_goal = config.optimization_goal;
      row.configured_result_action = configuredResultAction(config);
      row.configured_custom_event_name = configuredCustomEventName(config);
      const customId = row.configured_result_action?.match(
        /offsite_conversion\.custom\.(\d+)/,
      )?.[1];
      if (customId && customCatalog[customId])
        row.configured_result_type = customCatalog[customId];
      const primary = directlyEvidencedResult(row);
      const base = insightToManualCsvRowWithResult(row, primary);
      if (row.clicks === undefined)
        base[META_CSV_HEADERS.indexOf("Clicks (all)")] = "—";
      // An absent attributed-action field is not evidence of zero conversions for
      // a delivery slice: Meta can omit privacy-limited breakdown metrics.
      if (
        primary &&
        /conversion|lead|purchase|complete_registration/.test(
          primary.action_type ?? "",
        ) &&
        Number(row.impressions) > 0 &&
        !configuredResultCountSource(row).startsWith("conversions.") &&
        !(row.actions ?? []).some(
          (action) => action.action_type === primary.action_type,
        )
      )
        base[META_CSV_HEADERS.indexOf("Results")] = "—";
      if (!primary) {
        base[META_CSV_HEADERS.indexOf("Results")] = "—";
        base[META_CSV_HEADERS.indexOf("Result type")] = "";
      }
      const actionValues = (raw.action_values ?? []) as Array<{
        action_type: string;
        value: string;
      }>;
      const matching = actionValues.filter(
        (value) => value.action_type === primary?.action_type,
      );
      if (
        matching.some(
          (value) =>
            !Number.isFinite(Number(value.value)) || Number(value.value) < 0,
        ) ||
        new Set(matching.map((value) => Number(value.value))).size > 1
      )
        throw Error(
          "Meta returned conflicting purchase values. Retry before reporting ROAS.",
        );
      const purchase =
        primary?.action_type && /purchase/.test(primary.action_type)
          ? actionValues.find(
              (value) => value.action_type === primary.action_type,
            )
          : undefined;
      const extras = [
        String(raw.ad_id ?? ""),
        String(raw.ad_name ?? ""),
        String(raw.age ?? "Unknown"),
        String(raw[input.options.locationLevel ?? "region"] ?? "Unknown"),
        String(raw.publisher_platform ?? "Unknown"),
        String(raw.platform_position ?? "Unknown"),
        purchase?.value ?? "—",
      ];
      return [...base, ...wanted.map((i) => extras[i]), extras[6], attribution];
    });
    const headers = [
      ...META_CSV_HEADERS,
      ...wanted.map((i) => extraHeaders[i]),
      extraHeaders[6],
      extraHeaders[7],
    ].map((h) =>
      h === "Amount spent (USD)" ? `Amount spent (${input.currency})` : h,
    );
    const parsed = parseCsvText(rowsToCsv(headers, rows));
    const source = parseMetaContentSource(parsed, input.currency);
    datasets.push({ ...source, source: "api", coverage: input.range,
      granularity: input.periodTotals ? "period" : "daily" });
  }
  return datasets;
}
export async function snapshotCreativeImage(
  buffer: Buffer,
  label = "Uploaded creative image",
): Promise<CreativeMediaSnapshot> {
  if (buffer.length > 2 * 1024 * 1024)
    throw Error("Use images smaller than 2MB.");
  const image = sharp(buffer, { limitInputPixels: 20000000 });
  const metadata = await image.metadata();
  if (!["jpeg", "png", "webp"].includes(metadata.format ?? ""))
    throw Error("Use a PNG, JPEG or WebP image.");
  const result = await image
    .rotate()
    .resize({
      width: 480,
      height: 360,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 60 })
    .toBuffer({ resolveWithObject: true });
  if (result.data.length > 42000)
    throw Error("This image is too detailed. Use a smaller preview.");
  return {
    data: `data:image/jpeg;base64,${result.data.toString("base64")}`,
    width: result.info.width,
    height: result.info.height,
    label,
  };
}
function safeMediaUrl(raw: string): URL {
  const url = new URL(raw);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    !/(^|\.)(fbcdn\.net|cdninstagram\.com)$/.test(url.hostname)
  )
    throw Error("This creative image host is not supported.");
  return url;
}
async function downloadImage(raw: string): Promise<Buffer> {
  let url = safeMediaUrl(raw);
  for (let hop = 0; hop < 3; hop++) {
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(12000),
    });
    if (response.status >= 300 && response.status < 400) {
      url = safeMediaUrl(
        new URL(response.headers.get("location") ?? "", url).href,
      );
      continue;
    }
    if (
      !response.ok ||
      Number(response.headers.get("content-length")) > 2 * 1024 * 1024
    )
      throw Error("Creative image unavailable.");
    const reader = response.body?.getReader();
    if (!reader) throw Error("Creative image unavailable.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 2 * 1024 * 1024) throw Error("Creative image is too large.");
        chunks.push(value);
      }
    } finally {
      await reader.cancel();
    }
    return Buffer.concat(chunks);
  }
  throw Error("Creative image redirect limit exceeded.");
}
export async function fetchCreativeSnapshots(
  token: string,
  ids: string[],
): Promise<{ media: Record<string, CreativeMediaSnapshot>; missing: number }> {
  const media: Record<string, CreativeMediaSnapshot> = {};
  let missing = 0;
  // Bounded thumbnails; all ads still remain in the performance tables.
  const readOne = async (id: string) => {
    try {
      if (!/^\d+$/.test(id)) return;
      const ad = await metaContentGraph<{
        creative?: {
          image_url?: string;
          thumbnail_url?: string;
          video_id?: string;
          asset_feed_spec?: unknown;
          object_story_spec?: { link_data?: { child_attachments?: unknown[] } };
        };
      }>(
        token,
        id,
        {
          fields:
            "id,creative{image_url,thumbnail_url,video_id,asset_feed_spec,object_story_spec}",
        },
        12000,
      );
      const creative = ad.creative;
      const url = creative?.image_url || creative?.thumbnail_url;
      if (!url) throw Error("No preview");
      const label = creative?.asset_feed_spec
        ? "Representative preview · dynamic/catalog creative; metrics describe the ad, not each asset."
        : creative?.video_id
          ? "Video poster · video playback is not embedded in the report."
          : creative?.object_story_spec?.link_data?.child_attachments?.length
            ? "Representative carousel card · metrics describe the whole ad."
            : "Creative image snapshot";
      media[id] = await snapshotCreativeImage(await downloadImage(url), label);
    } catch {
      missing++;
    }
  };
  for (let offset = 0; offset < Math.min(ids.length, 12); offset += 3) {
    await Promise.all(ids.slice(offset, Math.min(offset + 3, 12)).map(readOne));
  }
  return { media, missing };
}
