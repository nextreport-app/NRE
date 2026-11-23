import { customWebsitePeriods, type WebsiteRange } from "./range";
import {
  runGa4Report,
  type RunReportResponse,
  fetchGa4PropertyMetadata,
} from "../ga4-api";
import {
  WEBSITE_METRICS,
  websitePeriods,
  type WebsiteMetrics,
  type WebsiteSnapshot,
} from "./model";
export function ga4Number(value: unknown): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
export function ga4DashboardRows(
  response: RunReportResponse,
  metricNames: readonly string[],
  dimensionNames: string[] = [],
) {
  // A successful GA4 empty report may omit headers. Require explicit zero rows;
  // a malformed response without rowCount must still fail closed.
  if (response.rowCount === 0 && !response.rows?.length) return [];
  const metrics = response.metricHeaders?.map((h) => h.name ?? "") ?? [],
    dimensions = response.dimensionHeaders?.map((h) => h.name ?? "") ?? [];
  if (
    metricNames.some((name) => !metrics.includes(name)) ||
    dimensionNames.some((name) => !dimensions.includes(name))
  )
    throw Error("GA4 returned incomplete report headers.");
  return (response.rows ?? []).map((row) => ({
    dimensions: Object.fromEntries(
      dimensionNames.map((name) => [
        name,
        row.dimensionValues?.[dimensions.indexOf(name)]?.value ?? "(not set)",
      ]),
    ),
    metrics: Object.fromEntries(
      metricNames.map((name) => [
        name,
        name.endsWith("Rate") &&
        Number(row.metricValues?.[metrics.indexOf(name)]?.value) > 1
          ? (() => {
              throw Error("Invalid GA4 rate.");
            })()
          : ga4Number(row.metricValues?.[metrics.indexOf(name)]?.value),
      ]),
    ),
  }));
}
export async function fetchWebsiteSnapshot(
  accessToken: string,
  propertyId: string,
  selection: WebsiteRange,
  now = new Date(),
): Promise<WebsiteSnapshot> {
  const property = await fetchGa4PropertyMetadata(accessToken, propertyId),
    periods = typeof selection === "number" ? websitePeriods(selection, property.timezone, now) : customWebsitePeriods(selection, property.timezone, now);
  const days = typeof selection === "number" ? selection : customWebsitePeriods(selection, property.timezone, now).days;
  const warnings = new Set<string>();
  async function request(
    range: typeof periods.currentPeriod,
    metricNames: readonly string[],
    dimensionNames: string[] = [],
    limit?: number,
    offset?: number,
  ) {
    const response = await runGa4Report(accessToken, propertyId, {
      dateRanges: [{ startDate: range.startIso, endDate: range.endIso }],
      metrics: metricNames.map((name) => ({ name })),
      dimensions: dimensionNames.map((name) => ({ name })),
      limit,
      offset,
      ...(dimensionNames.length
        ? {
            orderBys: [
              dimensionNames[0] === "date"
                ? { dimension: { dimensionName: "date" }, desc: false }
                : { metric: { metricName: "sessions" }, desc: true },
            ],
          }
        : {}),
    });
    const metadata = response.metadata;
    if (metadata?.timeZone && metadata.timeZone !== property.timezone)
      throw Error("GA4 property timezone changed during refresh.");
    if (metadata?.schemaRestrictionResponse?.activeMetricRestrictions?.length)
      warnings.add("GA4 restricts some metrics for this connection.");
    if (metadata?.subjectToThresholding)
      warnings.add("GA4 privacy thresholds may limit reported data.");
    if (metadata?.dataLossFromOtherRow)
      warnings.add(
        "GA4 grouped some low-volume dimension values into (other).",
      );
    if (
      metadata?.samplingMetadatas?.some(
        (s) => Number(s.samplesReadCount) < Number(s.samplingSpaceSize),
      )
    )
      warnings.add("GA4 reports sampled data for this snapshot.");
    return response;
  }
  async function overview(range: typeof periods.currentPeriod) {
    const response = await request(range, WEBSITE_METRICS);
    const parsed = ga4DashboardRows(response, WEBSITE_METRICS);
    if (
      parsed.length > 1 ||
      (response.rowCount ?? 0) > 1 ||
      (!parsed.length && (response.rowCount ?? 0) > 0)
    )
      throw Error("Unexpected GA4 overview rows.");
    const result = Object.fromEntries(
      WEBSITE_METRICS.map((name) => [name, parsed[0]?.metrics[name] ?? null]),
    ) as unknown as WebsiteMetrics;
    for (const key of [
      "engagementRate",
      "bounceRate",
      "sessionKeyEventRate",
    ] as const)
      if (result[key] !== null && result[key]! > 1)
        throw Error("Invalid GA4 rate.");
    return { metrics: result, empty: parsed.length === 0 };
  }
  const channelMetrics = WEBSITE_METRICS;
  async function channels(range: typeof periods.currentPeriod) {
    const out: WebsiteSnapshot["channels"] = [];
    for (let offset = 0; offset < 1000; offset += 100) {
      const response = await request(
          range,
          channelMetrics,
          ["sessionDefaultChannelGroup"],
          100,
          offset,
        ),
        parsed = ga4DashboardRows(response, channelMetrics, [
          "sessionDefaultChannelGroup",
        ]);
      out.push(
        ...(parsed.map((r) => ({
          name: r.dimensions.sessionDefaultChannelGroup,
          ...r.metrics,
        })) as WebsiteSnapshot["channels"]),
      );
      if (
        response.rowCount !== undefined
          ? offset + parsed.length >= response.rowCount
          : parsed.length < 100
      )
        return out;
      if (!parsed.length) throw Error("GA4 channel pagination did not finish.");
    }
    throw Error("GA4 channel report is too large to display completely.");
  }
  const [current, previous, channelRows, pageResponse, trendResponse] =
    await Promise.all([
      overview(periods.currentPeriod),
      overview(periods.previousPeriod),
      channels(periods.currentPeriod),
      request(
        periods.currentPeriod,
        WEBSITE_METRICS,
        ["landingPage"],
        10,
      ),
      request(periods.currentPeriod, WEBSITE_METRICS, ["date"], 100),
    ]);
  // Keep each snapshot at the existing five concurrent GA4 requests; the two window caches may refresh together.
  const previousChannels = await channels(periods.previousPeriod);
  const pages = ga4DashboardRows(
    pageResponse,
    WEBSITE_METRICS,
    ["landingPage"],
  ).map((r) => ({
    name: r.dimensions.landingPage,
    ...r.metrics,
  })) as WebsiteSnapshot["pages"];
  const trend = ga4DashboardRows(
    trendResponse,
    WEBSITE_METRICS,
    ["date"],
  ).map((r) => ({
    date: r.dimensions.date,
    ...r.metrics,
  })) as WebsiteSnapshot["trend"];
  if (
    trendResponse.rowCount !== undefined &&
    trendResponse.rowCount > trend.length
  )
    throw Error("GA4 daily trend is incomplete.");
  for (const list of [channelRows, previousChannels])
    if (new Set(list.map((c) => c.name)).size !== list.length)
      throw Error("GA4 returned duplicate channel rows.");
  if (new Set(trend.map((d) => d.date)).size !== trend.length)
    throw Error("GA4 returned duplicate daily rows.");
  for (const row of trend) {
    const iso = row.date.replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3");
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(iso) ||
      iso < periods.currentPeriod.startIso ||
      iso > periods.currentPeriod.endIso ||
      new Date(iso + "T12:00:00Z").toISOString().slice(0, 10) !== iso
    )
      throw Error("GA4 returned a daily row outside the requested period.");
  }
  return {
    version: 1,
    days,
    ...(typeof selection === "object" ? { rangeMode: "custom" as const } : {}),
    property,
    checkedAt: new Date().toISOString(),
    ...periods,
    current: current.metrics,
    previous: previous.metrics,
    channels: channelRows,
    previousChannels,
    pages,
    trend,
    warnings: [...warnings],
    empty: current.empty,
  };
}
