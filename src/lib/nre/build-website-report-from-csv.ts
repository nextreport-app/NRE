/**
 * Builds WebsiteReportData from a GA4 CSV export.
 */

import type { Ga4ColumnMap, Ga4Row } from "./ga4-columns";
import { detectGa4CsvDimensions } from "./ga4-columns";
import { parseDate } from "./dates";
import { formatDateUS } from "./dates";
import { getGa4RowDate, parseGa4CsvNum, parseGa4CsvRate } from "./validate-ga4";
import type { Ga4DateRange } from "@/lib/ga4-api";
import type { WebsiteReportConfig } from "./website-report-config";
import {
  buildWebsiteReportData,
  type WebsiteClientKind,
  type WebsiteReportData,
} from "./website-report-data";

function rowInRange(row: Ga4Row, range: Ga4DateRange): boolean {
  const d = parseDate(getGa4RowDate(row));
  if (!d) return true; // aggregate CSV — no date filter
  const iso = `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
  return iso >= range.startIso && iso <= range.endIso;
}

function dimValue(row: Ga4Row, key: keyof Ga4ColumnMap): string {
  const v = row[key as keyof Ga4Row];
  const s = String(v ?? "").trim();
  return s || "(not set)";
}

interface AggBucket {
  sessions: number;
  conversions: number;
  engagedWeight: number;
  engagementRateSum: number;
  bounceRateSum: number;
  pageViews: number;
}

function addToBucket(bucket: AggBucket, row: Ga4Row) {
  const sessions = parseGa4CsvNum(row.sessions);
  bucket.sessions += sessions;
  bucket.conversions += parseGa4CsvNum(row.conversions);
  bucket.pageViews += parseGa4CsvNum(row.screen_page_views);
  const engRate = parseGa4CsvRate(row.engagement_rate);
  bucket.engagementRateSum += engRate * sessions;
  bucket.engagedWeight += sessions;
  const bounce = parseGa4CsvRate(row.bounce_rate);
  bucket.bounceRateSum += bounce * sessions;
}

function bucketToMetrics(bucket: AggBucket) {
  const sessions = bucket.sessions;
  return {
    sessions,
    engagementRate: bucket.engagedWeight > 0 ? bucket.engagementRateSum / bucket.engagedWeight : 0,
    conversions: bucket.conversions,
    bounceRate: bucket.engagedWeight > 0 ? bucket.bounceRateSum / bucket.engagedWeight : 0,
  };
}

function groupRows(rows: Ga4Row[], dimKey: keyof Ga4ColumnMap): Map<string, AggBucket> {
  const map = new Map<string, AggBucket>();
  for (const row of rows) {
    const key = dimValue(row, dimKey);
    const bucket = map.get(key) ?? { sessions: 0, conversions: 0, engagedWeight: 0, engagementRateSum: 0, bounceRateSum: 0, pageViews: 0 };
    addToBucket(bucket, row);
    map.set(key, bucket);
  }
  return map;
}

function topFromGroup(
  map: Map<string, AggBucket>,
  limit = 10,
): Array<{ label: string; sessions: number; engagementRate: number; conversions: number }> {
  return [...map.entries()]
    .map(([label, b]) => ({ label, ...bucketToMetrics(b) }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, limit);
}

function sumOverview(rows: Ga4Row[]) {
  const bucket: AggBucket = { sessions: 0, conversions: 0, engagedWeight: 0, engagementRateSum: 0, bounceRateSum: 0, pageViews: 0 };
  let totalUsers = 0;
  let newUsers = 0;
  let engagedSessions = 0;
  let revenue = 0;
  let transactions = 0;
  let durationSum = 0;
  let durationWeight = 0;

  for (const row of rows) {
    addToBucket(bucket, row);
    totalUsers += parseGa4CsvNum(row.total_users);
    newUsers += parseGa4CsvNum(row.new_users);
    engagedSessions += parseGa4CsvNum(row.engaged_sessions);
    revenue += parseGa4CsvNum(row.purchase_revenue);
    transactions += parseGa4CsvNum(row.transactions);
    const sessions = parseGa4CsvNum(row.sessions);
    durationSum += parseGa4CsvNum(row.avg_session_duration) * sessions;
    durationWeight += sessions;
  }

  const m = bucketToMetrics(bucket);
  return {
    sessions: m.sessions,
    totalUsers: totalUsers || m.sessions,
    newUsers,
    engagedSessions: engagedSessions || Math.round(m.sessions * m.engagementRate),
    engagementRate: m.engagementRate,
    bounceRate: m.bounceRate,
    averageSessionDuration: durationWeight > 0 ? durationSum / durationWeight : 0,
    userEngagementDuration: 0,
    screenPageViews: bucket.pageViews,
    conversions: m.conversions,
    purchaseRevenue: revenue,
    transactions,
  };
}

function dateRangeLabel(range: Ga4DateRange): string {
  return `${formatDateUS(range.startIso)} – ${formatDateUS(range.endIso)}`;
}

export function buildWebsiteReportFromCsv(input: {
  rows: Ga4Row[];
  colMap: Ga4ColumnMap;
  config: WebsiteReportConfig;
  currentRange: Ga4DateRange;
  comparisonRange?: Ga4DateRange;
  propertyId?: string;
  propertyName?: string;
  accountName?: string;
  currencySymbol: string;
}): WebsiteReportData {
  const { colMap, config, currentRange, comparisonRange } = input;
  const hasDate = !!colMap.date;

  const currentRows = hasDate ? input.rows.filter((r) => rowInRange(r, currentRange)) : input.rows;
  const previousRows =
    hasDate && comparisonRange ? input.rows.filter((r) => rowInRange(r, comparisonRange)) : [];

  const current = sumOverview(currentRows);
  const previous = previousRows.length > 0 ? sumOverview(previousRows) : undefined;

  let clientKindOverride: WebsiteClientKind | undefined;
  if (config.clientKind !== "auto") {
    clientKindOverride = config.clientKind;
  }

  const breakdowns = config.breakdowns;
  const dims = detectGa4CsvDimensions(colMap);

  const channels =
    breakdowns.channels && colMap.channel
      ? topFromGroup(groupRows(currentRows, "channel")).map((r) => ({
          channel: r.label,
          sessions: r.sessions,
          engagementRate: r.engagementRate,
          conversions: r.conversions,
        }))
      : [];

  const devices =
    breakdowns.device && colMap.device
      ? topFromGroup(groupRows(currentRows, "device")).map((r) => ({
          device: r.label,
          sessions: r.sessions,
          engagementRate: r.engagementRate,
          conversions: r.conversions,
        }))
      : [];

  let geoLocations: Array<{ location: string; sessions: number; conversions: number }> = [];
  if (breakdowns.geo) {
    const geoKey =
      breakdowns.geoDimension === "country" && colMap.country
        ? "country"
        : breakdowns.geoDimension === "region" && colMap.region
          ? "region"
          : colMap.city
            ? "city"
            : colMap.region
              ? "region"
              : colMap.country
                ? "country"
                : null;
    if (geoKey && dims.includes(geoKey)) {
      geoLocations = topFromGroup(groupRows(currentRows, geoKey)).map((r) => ({
        location: r.label,
        sessions: r.sessions,
        conversions: r.conversions,
      }));
    }
  }

  const campaigns =
    breakdowns.campaigns && colMap.campaign
      ? topFromGroup(groupRows(currentRows, "campaign")).map((r) => ({
          campaign: r.label,
          sessions: r.sessions,
          engagementRate: r.engagementRate,
          conversions: r.conversions,
        }))
      : [];

  const sources =
    breakdowns.sources && colMap.source
      ? topFromGroup(
          (() => {
            const map = new Map<string, AggBucket>();
            for (const row of currentRows) {
              const label = `${dimValue(row, "source")} / ${colMap.medium ? dimValue(row, "medium") : "(not set)"}`;
              const bucket = map.get(label) ?? { sessions: 0, conversions: 0, engagedWeight: 0, engagementRateSum: 0, bounceRateSum: 0, pageViews: 0 };
              addToBucket(bucket, row);
              map.set(label, bucket);
            }
            return map;
          })(),
        ).map((r) => {
          const [source, medium] = r.label.split(" / ");
          return {
            source: source ?? r.label,
            medium: medium ?? "(not set)",
            sessions: r.sessions,
            engagementRate: r.engagementRate,
            conversions: r.conversions,
          };
        })
      : [];

  const ageGroups =
    breakdowns.demographics && colMap.age
      ? topFromGroup(groupRows(currentRows, "age")).map((r) => ({
          segment: r.label,
          sessions: r.sessions,
          conversions: r.conversions,
        }))
      : [];

  const genders =
    breakdowns.demographics && colMap.gender
      ? topFromGroup(groupRows(currentRows, "gender")).map((r) => ({
          segment: r.label,
          sessions: r.sessions,
          conversions: r.conversions,
        }))
      : [];

  const audience =
    breakdowns.newVsReturning && colMap.new_vs_returning
      ? topFromGroup(groupRows(currentRows, "new_vs_returning")).map((r) => ({
          segment: r.label,
          sessions: r.sessions,
          engagementRate: r.engagementRate,
          conversions: r.conversions,
        }))
      : [];

  const operatingSystems =
    breakdowns.operatingSystem && colMap.operating_system
      ? topFromGroup(groupRows(currentRows, "operating_system")).map((r) => ({
          name: r.label,
          sessions: r.sessions,
          engagementRate: r.engagementRate,
          conversions: r.conversions,
        }))
      : [];

  const browsers =
    breakdowns.browser && colMap.browser
      ? topFromGroup(groupRows(currentRows, "browser")).map((r) => ({
          name: r.label,
          sessions: r.sessions,
          engagementRate: r.engagementRate,
          conversions: r.conversions,
        }))
      : [];

  const topPages =
    breakdowns.topPages && colMap.landing_page
      ? topFromGroup(groupRows(currentRows, "landing_page")).map((r) => ({
          page: r.label,
          sessions: r.sessions,
          engagementRate: r.engagementRate,
        }))
      : [];

  const dayOfWeek =
    breakdowns.dayOfWeek && colMap.day_of_week
      ? topFromGroup(groupRows(currentRows, "day_of_week"), 7).map((r) => ({
          label: r.label,
          sessions: r.sessions,
          engagementRate: r.engagementRate,
          conversions: r.conversions,
        }))
      : [];

  const hourOfDay =
    breakdowns.hourOfDay && colMap.hour
      ? topFromGroup(groupRows(currentRows, "hour"), 24).map((r) => ({
          label: r.label,
          sessions: r.sessions,
          engagementRate: r.engagementRate,
          conversions: r.conversions,
        }))
      : [];

  const conversionEvents =
    breakdowns.conversionEvents && colMap.event_name
      ? topFromGroup(groupRows(currentRows, "event_name")).map((r) => ({
          event: r.label,
          count: r.conversions || r.sessions,
          sessions: r.sessions,
          conversionRate: r.sessions > 0 ? r.conversions / r.sessions : 0,
        }))
      : [];

  return buildWebsiteReportData({
    propertyId: input.propertyId ?? "csv",
    propertyName: input.propertyName ?? "GA4 CSV Export",
    accountName: input.accountName,
    dateRangeLabel: dateRangeLabel(currentRange),
    comparisonRangeLabel: comparisonRange ? dateRangeLabel(comparisonRange) : undefined,
    currencySymbol: input.currencySymbol,
    current,
    previous,
    clientKindOverride,
    channels,
    devices,
    geoLocations,
    geoDimension: breakdowns.geoDimension,
    campaigns,
    sources,
    ageGroups,
    genders,
    audience,
    operatingSystems,
    browsers,
    topPages,
    dayOfWeek,
    hourOfDay,
    conversionEvents,
    breakdowns,
  });
}

export function computeGa4CsvDateBounds(rows: Ga4Row[]): { startIso: string; endIso: string } | null {
  const isos: string[] = [];
  for (const row of rows) {
    const d = parseDate(getGa4RowDate(row));
    if (!d) continue;
    isos.push(`${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`);
  }
  if (isos.length === 0) return null;
  isos.sort();
  return { startIso: isos[0]!, endIso: isos[isos.length - 1]! };
}
