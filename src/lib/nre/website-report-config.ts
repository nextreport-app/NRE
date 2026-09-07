/**
 * Website Traffic report wizard configuration — date range, client kind, breakdown selection.
 */

import type { Ga4DateRange } from "@/lib/ga4-api";
import type { WebsiteClientKind } from "./website-report-data";

export type WebsiteGeoDimension = "city" | "region" | "country";
export type WebsiteDatePreset = "month_to_date" | "last_30_days" | "last_7_days" | "custom";
export type WebsiteClientKindSetting = "auto" | WebsiteClientKind;

export interface WebsiteBreakdownOptions {
  device: boolean;
  geo: boolean;
  geoDimension: WebsiteGeoDimension;
  channels: boolean;
  campaigns: boolean;
  sources: boolean;
  demographics: boolean;
  operatingSystem: boolean;
  browser: boolean;
  topPages: boolean;
  newVsReturning: boolean;
  dayOfWeek: boolean;
  hourOfDay: boolean;
  conversionEvents: boolean;
}

export interface WebsiteReportConfig {
  breakdowns: WebsiteBreakdownOptions;
  clientKind: WebsiteClientKindSetting;
  comparePreviousPeriod: boolean;
  datePreset: WebsiteDatePreset;
  startIso?: string;
  endIso?: string;
}

export const DEFAULT_WEBSITE_BREAKDOWNS: WebsiteBreakdownOptions = {
  device: true,
  geo: true,
  geoDimension: "city",
  channels: true,
  campaigns: false,
  sources: false,
  demographics: false,
  operatingSystem: false,
  browser: false,
  topPages: true,
  newVsReturning: false,
  dayOfWeek: false,
  hourOfDay: false,
  conversionEvents: false,
};

export const DEFAULT_WEBSITE_REPORT_CONFIG: WebsiteReportConfig = {
  breakdowns: DEFAULT_WEBSITE_BREAKDOWNS,
  clientKind: "auto",
  comparePreviousPeriod: true,
  datePreset: "month_to_date",
};

/** Max optional breakdown slides (excludes cover, overview, conversions). */
export const MAX_WEBSITE_BREAKDOWN_SLIDES = 10;

const BREAKDOWN_TOGGLE_KEYS: Array<keyof WebsiteBreakdownOptions> = [
  "device",
  "geo",
  "channels",
  "campaigns",
  "sources",
  "demographics",
  "operatingSystem",
  "browser",
  "topPages",
  "newVsReturning",
  "dayOfWeek",
  "hourOfDay",
  "conversionEvents",
];

function flag(value: boolean | string | null | undefined, defaultOn: boolean): boolean {
  if (value === undefined || value === null) return defaultOn;
  if (typeof value === "boolean") return value;
  return value !== "0" && value !== "false";
}

function parseGeoDimension(value: unknown): WebsiteGeoDimension {
  if (value === "region" || value === "country" || value === "city") return value;
  return DEFAULT_WEBSITE_BREAKDOWNS.geoDimension;
}

function parseDatePreset(value: unknown): WebsiteDatePreset {
  if (value === "last_30_days" || value === "last_7_days" || value === "custom" || value === "month_to_date") {
    return value;
  }
  return DEFAULT_WEBSITE_REPORT_CONFIG.datePreset;
}

function parseClientKind(value: unknown): WebsiteClientKindSetting {
  if (value === "auto" || value === "lead_gen" || value === "ecommerce" || value === "content" || value === "saas") {
    return value;
  }
  return "auto";
}

export function parseWebsiteBreakdownOptions(input: Record<string, unknown>): WebsiteBreakdownOptions {
  // Legacy Phase 2: geoCities boolean maps to geo + city dimension
  const legacyGeo = input.geoCities;
  const geoDefault =
    legacyGeo !== undefined ? flag(legacyGeo as boolean | string, DEFAULT_WEBSITE_BREAKDOWNS.geo) : DEFAULT_WEBSITE_BREAKDOWNS.geo;

  return {
    device: flag(input.device as boolean | string | null | undefined, DEFAULT_WEBSITE_BREAKDOWNS.device),
    geo: flag(input.geo as boolean | string | null | undefined, geoDefault),
    geoDimension: parseGeoDimension(input.geoDimension),
    channels: flag(input.channels as boolean | string | null | undefined, DEFAULT_WEBSITE_BREAKDOWNS.channels),
    campaigns: flag(input.campaigns as boolean | string | null | undefined, DEFAULT_WEBSITE_BREAKDOWNS.campaigns),
    sources: flag(input.sources as boolean | string | null | undefined, DEFAULT_WEBSITE_BREAKDOWNS.sources),
    demographics: flag(input.demographics as boolean | string | null | undefined, DEFAULT_WEBSITE_BREAKDOWNS.demographics),
    operatingSystem: flag(input.operatingSystem as boolean | string | null | undefined, DEFAULT_WEBSITE_BREAKDOWNS.operatingSystem),
    browser: flag(input.browser as boolean | string | null | undefined, DEFAULT_WEBSITE_BREAKDOWNS.browser),
    topPages: flag(input.topPages as boolean | string | null | undefined, DEFAULT_WEBSITE_BREAKDOWNS.topPages),
    newVsReturning: flag(input.newVsReturning as boolean | string | null | undefined, DEFAULT_WEBSITE_BREAKDOWNS.newVsReturning),
    dayOfWeek: flag(input.dayOfWeek as boolean | string | null | undefined, DEFAULT_WEBSITE_BREAKDOWNS.dayOfWeek),
    hourOfDay: flag(input.hourOfDay as boolean | string | null | undefined, DEFAULT_WEBSITE_BREAKDOWNS.hourOfDay),
    conversionEvents: flag(input.conversionEvents as boolean | string | null | undefined, DEFAULT_WEBSITE_BREAKDOWNS.conversionEvents),
  };
}

export function parseWebsiteReportConfig(input: unknown): WebsiteReportConfig {
  if (!input || typeof input !== "object") return DEFAULT_WEBSITE_REPORT_CONFIG;
  const body = input as Record<string, unknown>;
  const breakdownsRaw =
    body.breakdowns && typeof body.breakdowns === "object"
      ? (body.breakdowns as Record<string, unknown>)
      : body;

  return {
    breakdowns: parseWebsiteBreakdownOptions(breakdownsRaw),
    clientKind: parseClientKind(body.clientKind),
    comparePreviousPeriod: flag(
      body.comparePreviousPeriod as boolean | string | null | undefined,
      DEFAULT_WEBSITE_REPORT_CONFIG.comparePreviousPeriod,
    ),
    datePreset: parseDatePreset(body.datePreset),
    startIso: typeof body.startIso === "string" ? body.startIso.slice(0, 10) : undefined,
    endIso: typeof body.endIso === "string" ? body.endIso.slice(0, 10) : undefined,
  };
}

export function countSelectedBreakdowns(options: WebsiteBreakdownOptions): number {
  return BREAKDOWN_TOGGLE_KEYS.filter((key) => {
    if (key === "geoDimension") return false;
    return Boolean(options[key]);
  }).length;
}

export function estimateWebsiteSlideCount(
  breakdowns: WebsiteBreakdownOptions,
  opts?: { hasConversionSlide?: boolean; hasTopPagesData?: boolean },
): number {
  let slides = 2; // cover + traffic overview
  if (opts?.hasConversionSlide !== false) slides += 1;
  if (breakdowns.device) slides += 1;
  if (breakdowns.channels) slides += 1;
  if (breakdowns.geo) slides += 1;
  if (breakdowns.campaigns) slides += 1;
  if (breakdowns.sources) slides += 1;
  if (breakdowns.demographics) slides += 1;
  if (breakdowns.operatingSystem) slides += 1;
  if (breakdowns.browser) slides += 1;
  if (breakdowns.topPages && opts?.hasTopPagesData !== false) slides += 1;
  if (breakdowns.newVsReturning) slides += 1;
  if (breakdowns.dayOfWeek) slides += 1;
  if (breakdowns.hourOfDay) slides += 1;
  if (breakdowns.conversionEvents) slides += 1;
  return slides;
}

export function geoSlideTitle(dimension: WebsiteGeoDimension): string {
  switch (dimension) {
    case "country":
      return "Top Countries";
    case "region":
      return "Top States / Regions";
    default:
      return "Top Cities";
  }
}

export function geoColumnHeader(dimension: WebsiteGeoDimension): string {
  switch (dimension) {
    case "country":
      return "Country";
    case "region":
      return "Region";
    default:
      return "City";
  }
}

function isoDateInTimezone(timezone: string, now = new Date()): { y: number; m: number; d: number } {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(now);
  return {
    y: Number(parts.find((p) => p.type === "year")?.value),
    m: Number(parts.find((p) => p.type === "month")?.value),
    d: Number(parts.find((p) => p.type === "day")?.value),
  };
}

function addDaysUtc(y: number, m: number, d: number, delta: number): string {
  const date = new Date(Date.UTC(y, m - 1, d + delta));
  return date.toISOString().slice(0, 10);
}

function daysBetweenInclusive(startIso: string, endIso: string): number {
  const start = Date.parse(`${startIso}T00:00:00Z`);
  const end = Date.parse(`${endIso}T00:00:00Z`);
  return Math.max(1, Math.round((end - start) / 86_400_000) + 1);
}

/** Previous period of equal length ending the day before current start. */
export function previousPeriodRange(current: Ga4DateRange): Ga4DateRange {
  const len = daysBetweenInclusive(current.startIso, current.endIso);
  const prevEnd = addDaysUtc(
    Number(current.startIso.slice(0, 4)),
    Number(current.startIso.slice(5, 7)),
    Number(current.startIso.slice(8, 10)),
    -1,
  );
  const [y, m, d] = prevEnd.split("-").map(Number);
  const prevStart = addDaysUtc(y, m, d, -(len - 1));
  return { startIso: prevStart, endIso: prevEnd };
}

export function monthToDateRange(timezone: string, now = new Date()): Ga4DateRange {
  const { y, m, d } = isoDateInTimezone(timezone, now);
  const endIso = addDaysUtc(y, m, d, -1);
  const endParts = endIso.split("-").map(Number);
  const startIso = new Date(Date.UTC(endParts[0]!, endParts[1]! - 1, 1)).toISOString().slice(0, 10);
  return { startIso, endIso };
}

export function lastNDaysRange(timezone: string, n: number, now = new Date()): Ga4DateRange {
  const { y, m, d } = isoDateInTimezone(timezone, now);
  const endIso = addDaysUtc(y, m, d, -1);
  const endParts = endIso.split("-").map(Number);
  const startIso = addDaysUtc(endParts[0]!, endParts[1]!, endParts[2]!, -(n - 1));
  return { startIso, endIso };
}

export function resolveWebsiteReportRanges(
  config: WebsiteReportConfig,
  timezone: string,
  now = new Date(),
): { current: Ga4DateRange; previous?: Ga4DateRange } {
  let current: Ga4DateRange;

  switch (config.datePreset) {
    case "last_7_days":
      current = lastNDaysRange(timezone, 7, now);
      break;
    case "last_30_days":
      current = lastNDaysRange(timezone, 30, now);
      break;
    case "custom":
      if (config.startIso && config.endIso && config.startIso <= config.endIso) {
        current = { startIso: config.startIso, endIso: config.endIso };
      } else {
        current = monthToDateRange(timezone, now);
      }
      break;
    case "month_to_date":
    default:
      current = monthToDateRange(timezone, now);
      break;
  }

  const previous = config.comparePreviousPeriod ? previousPeriodRange(current) : undefined;
  return { current, previous };
}

/** Build query string for preview API from full config. */
export function websiteConfigToQueryString(config: WebsiteReportConfig): string {
  const params = new URLSearchParams();
  const b = config.breakdowns;
  if (!b.device) params.set("device", "0");
  if (!b.geo) params.set("geo", "0");
  params.set("geoDimension", b.geoDimension);
  if (!b.channels) params.set("channels", "0");
  if (b.campaigns) params.set("campaigns", "1");
  if (b.sources) params.set("sources", "1");
  if (b.demographics) params.set("demographics", "1");
  if (b.operatingSystem) params.set("operatingSystem", "1");
  if (b.browser) params.set("browser", "1");
  if (!b.topPages) params.set("topPages", "0");
  if (b.newVsReturning) params.set("newVsReturning", "1");
  if (b.dayOfWeek) params.set("dayOfWeek", "1");
  if (b.hourOfDay) params.set("hourOfDay", "1");
  if (b.conversionEvents) params.set("conversionEvents", "1");
  if (config.clientKind !== "auto") params.set("clientKind", config.clientKind);
  if (!config.comparePreviousPeriod) params.set("compare", "0");
  params.set("datePreset", config.datePreset);
  if (config.datePreset === "custom" && config.startIso && config.endIso) {
    params.set("startIso", config.startIso);
    params.set("endIso", config.endIso);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function normalizeBreakdowns(raw: Partial<WebsiteBreakdownOptions> & { geoCities?: boolean }): WebsiteBreakdownOptions {
  return parseWebsiteBreakdownOptions(raw as Record<string, unknown>);
}

export function parseWebsiteReportConfigFromSearchParams(searchParams: URLSearchParams): WebsiteReportConfig {
  const raw: Record<string, unknown> = {};
  for (const key of [
    "device",
    "geo",
    "geoCities",
    "geoDimension",
    "channels",
    "campaigns",
    "sources",
    "demographics",
    "operatingSystem",
    "browser",
    "topPages",
    "newVsReturning",
    "dayOfWeek",
    "hourOfDay",
    "conversionEvents",
    "clientKind",
    "comparePreviousPeriod",
    "compare",
    "datePreset",
    "startIso",
    "endIso",
  ]) {
    const v = searchParams.get(key);
    if (v !== null) raw[key] = v;
  }
  if (raw.compare !== undefined && raw.comparePreviousPeriod === undefined) {
    raw.comparePreviousPeriod = raw.compare;
  }
  return parseWebsiteReportConfig(raw);
}
