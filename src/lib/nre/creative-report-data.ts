/**
 * Creative (ad-level) report data — groups daily CSV rows by campaign + ad
 * name, assigns performance badges, and builds slide payloads for overview,
 * top creative, video, and fatigue slides.
 */

import { parseCellNum } from "./format";
import { fmtCurrency, fmtCurrency2dp, fmtNumber, fmtPercent } from "./format";
import { getRowDate, type NreRow } from "./columns";
import { parseDate } from "./dates";
import { getAdName } from "./ad-level";
import { sumRawColumnByKeywords } from "./objective";

export type CreativeStatus = "winner" | "average" | "fatigue" | "low_spend";

export interface CreativeAdMetrics {
  adName: string;
  spend: number;
  spendFormatted: string;
  results: number;
  resultsFormatted: string;
  cpr: string;
  ctr: string;
  ctrNum: number;
  cprNum: number;
  frequency: string;
  frequencyNum: number;
  impressions: number;
  status: CreativeStatus;
  statusLabel: string;
  hookRate?: string;
  hookRateNum?: number;
  holdRate?: string;
  holdRateNum?: number;
}

export interface CreativeOverviewSlideData {
  kind: "creative_overview";
  campaignName: string;
  ads: CreativeAdMetrics[];
  dateRangeLine: string;
}

export interface CreativeTopSlideData {
  kind: "creative_top";
  campaignName: string;
  adName: string;
  spend: string;
  results: string;
  cpr: string;
  ctr: string;
  frequency: string;
  impressions: string;
  cpm: string;
  statusLabel: string;
  dateRangeLine: string;
}

export interface CreativeVideoAdRow {
  campaignName: string;
  adName: string;
  hookRate: string;
  hookRateNum: number;
  holdRate: string;
  holdRateNum: number;
  spend: string;
}

export interface CreativeVideoSlideData {
  kind: "creative_video";
  ads: CreativeVideoAdRow[];
  dateRangeLine: string;
}

export interface CreativeFatigueRow {
  campaignName: string;
  adName: string;
  frequency: string;
  ctr: string;
  recommendation: string;
}

export interface CreativeFatigueSlideData {
  kind: "creative_fatigue";
  ads: CreativeFatigueRow[];
  dateRangeLine: string;
}

export interface CreativeReportSections {
  overviewSlides: CreativeOverviewSlideData[];
  topSlides: CreativeTopSlideData[];
  videoSlide: CreativeVideoSlideData | null;
  fatigueSlide: CreativeFatigueSlideData | null;
}

interface AdAgg {
  campaignName: string;
  adName: string;
  spend: number;
  results: number;
  impressions: number;
  reach: number;
  linkClicks: number;
  ctrs: number[];
  freqs: number[];
  threeSecondPlays: number;
  thruplays: number;
}

const STATUS_LABELS: Record<CreativeStatus, string> = {
  winner: "Winner",
  average: "Average",
  fatigue: "Fatigue",
  low_spend: "Low Spend",
};

function average(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

function aggregateAdRows(rows: NreRow[], adNameColumn: string): AdAgg[] {
  const groups = new Map<string, AdAgg>();

  rows.forEach((row) => {
    const campaignName = String(row.campaign_name || "").trim() || "Campaign";
    const adName = getAdName(row, adNameColumn);
    if (!adName) return;

    const key = `${campaignName}|||${adName}`;
    if (!groups.has(key)) {
      groups.set(key, {
        campaignName,
        adName,
        spend: 0,
        results: 0,
        impressions: 0,
        reach: 0,
        linkClicks: 0,
        ctrs: [],
        freqs: [],
        threeSecondPlays: 0,
        thruplays: 0,
      });
    }
    const g = groups.get(key)!;
    g.spend += parseCellNum(row.spend);
    g.results += parseCellNum(row.results);
    g.impressions += parseCellNum(row.impressions);
    g.reach += parseCellNum(row.reach);
    g.linkClicks += parseCellNum(row.link_clicks);
    const ctr = parseCellNum(row.ctr);
    const frq = parseCellNum(row.frequency);
    if (ctr > 0) g.ctrs.push(ctr);
    if (frq > 0) g.freqs.push(frq);

    const raw = row._raw || {};
    g.threeSecondPlays += sumRawColumnByKeywords(raw, ["3-second video play", "3 second video play"]);
    g.thruplays += sumRawColumnByKeywords(raw, ["thruplay", "video thruplay"]);
  });

  return Array.from(groups.values());
}

function assignStatus(
  ad: AdAgg,
  campaignSpend: number,
  campaignAvgCtr: number,
  campaignAvgCpr: number,
): CreativeStatus {
  if (campaignSpend > 0 && ad.spend < campaignSpend * 0.1) return "low_spend";
  const ctr = average(ad.ctrs);
  const cpr = ad.results > 0 ? ad.spend / ad.results : Infinity;
  const freq = average(ad.freqs);
  if (freq > 3 && ctr > 0 && ctr < 1) return "fatigue";
  const ctrGood = campaignAvgCtr > 0 ? ctr >= campaignAvgCtr : ctr >= 1;
  const cprGood = campaignAvgCpr > 0 && cpr < Infinity ? cpr <= campaignAvgCpr : ad.results > 0;
  if (ctrGood && cprGood && ad.spend >= campaignSpend * 0.1) return "winner";
  return "average";
}

function toCreativeAdMetrics(
  ad: AdAgg,
  status: CreativeStatus,
  currencySymbol: string,
): CreativeAdMetrics {
  const ctrNum = average(ad.ctrs);
  const cprNum = ad.results > 0 ? ad.spend / ad.results : 0;
  const freqNum = average(ad.freqs);
  const hookRateNum = ad.impressions > 0 ? (ad.threeSecondPlays / ad.impressions) * 100 : 0;
  const holdRateNum = ad.threeSecondPlays > 0 ? (ad.thruplays / ad.threeSecondPlays) * 100 : 0;

  return {
    adName: ad.adName,
    spend: ad.spend,
    spendFormatted: fmtCurrency(ad.spend, currencySymbol),
    results: ad.results,
    resultsFormatted: fmtNumber(ad.results),
    cpr: cprNum > 0 ? fmtCurrency2dp(cprNum, currencySymbol) : "—",
    ctr: ctrNum > 0 ? fmtPercent(ctrNum) : "—",
    ctrNum,
    cprNum,
    frequency: freqNum > 0 ? `${freqNum.toFixed(1)}x` : "—",
    frequencyNum: freqNum,
    impressions: ad.impressions,
    status,
    statusLabel: STATUS_LABELS[status],
    hookRate: hookRateNum > 0 ? fmtPercent(hookRateNum) : undefined,
    hookRateNum: hookRateNum > 0 ? hookRateNum : undefined,
    holdRate: holdRateNum > 0 ? fmtPercent(holdRateNum) : undefined,
    holdRateNum: holdRateNum > 0 ? holdRateNum : undefined,
  };
}

export function buildCreativeReportSections(input: {
  rawRows: NreRow[];
  adNameColumn: string;
  currencySymbol: string;
  dateRangeLine: string;
  keptCampaignNames: Set<string>;
  maxAdsPerOverview?: number;
}): CreativeReportSections {
  const { rawRows, adNameColumn, currencySymbol, dateRangeLine, keptCampaignNames } = input;
  const maxAds = input.maxAdsPerOverview ?? 12;

  const adAggs = aggregateAdRows(rawRows, adNameColumn).filter((a) => keptCampaignNames.has(a.campaignName));
  if (adAggs.length === 0) {
    return { overviewSlides: [], topSlides: [], videoSlide: null, fatigueSlide: null };
  }

  const byCampaign = new Map<string, AdAgg[]>();
  adAggs.forEach((ad) => {
    const list = byCampaign.get(ad.campaignName) ?? [];
    list.push(ad);
    byCampaign.set(ad.campaignName, list);
  });

  const overviewSlides: CreativeOverviewSlideData[] = [];
  const topSlides: CreativeTopSlideData[] = [];
  const videoAds: CreativeVideoAdRow[] = [];
  const fatigueRows: CreativeFatigueRow[] = [];

  const sortedCampaigns = Array.from(byCampaign.keys()).sort();

  sortedCampaigns.forEach((campaignName) => {
    const ads = byCampaign.get(campaignName)!;
    const campaignSpend = ads.reduce((s, a) => s + a.spend, 0);
    const ctrs = ads.flatMap((a) => a.ctrs);
    const cprs = ads.filter((a) => a.results > 0).map((a) => a.spend / a.results);
    const campaignAvgCtr = average(ctrs);
    const campaignAvgCpr = average(cprs);

    const metrics = ads
      .map((ad) => {
        const status = assignStatus(ad, campaignSpend, campaignAvgCtr, campaignAvgCpr);
        return toCreativeAdMetrics(ad, status, currencySymbol);
      })
      .sort((a, b) => b.spend - a.spend)
      .slice(0, maxAds);

    if (metrics.length === 0) return;

    overviewSlides.push({
      kind: "creative_overview",
      campaignName,
      ads: metrics,
      dateRangeLine,
    });

    const top = metrics.find((m) => m.status === "winner") ?? metrics[0];
    const cpm =
      top.impressions > 0 ? fmtCurrency2dp((top.spend / top.impressions) * 1000, currencySymbol) : "—";
    topSlides.push({
      kind: "creative_top",
      campaignName,
      adName: top.adName,
      spend: top.spendFormatted,
      results: top.resultsFormatted,
      cpr: top.cpr,
      ctr: top.ctr,
      frequency: top.frequency,
      impressions: fmtNumber(top.impressions),
      cpm,
      statusLabel: top.statusLabel,
      dateRangeLine,
    });

    metrics.forEach((m) => {
      if (m.hookRateNum != null && m.hookRateNum > 0) {
        videoAds.push({
          campaignName,
          adName: m.adName,
          hookRate: m.hookRate!,
          hookRateNum: m.hookRateNum,
          holdRate: m.holdRate ?? "—",
          holdRateNum: m.holdRateNum ?? 0,
          spend: m.spendFormatted,
        });
      }
      if (m.status === "fatigue") {
        fatigueRows.push({
          campaignName,
          adName: m.adName,
          frequency: m.frequency,
          ctr: m.ctr,
          recommendation: "Consider refreshing creative or excluding recent converters from the audience.",
        });
      }
    });
  });

  return {
    overviewSlides,
    topSlides,
    videoSlide:
      videoAds.length > 0
        ? { kind: "creative_video", ads: videoAds.sort((a, b) => b.hookRateNum - a.hookRateNum), dateRangeLine }
        : null,
    fatigueSlide:
      fatigueRows.length > 0
        ? { kind: "creative_fatigue", ads: fatigueRows, dateRangeLine }
        : null,
  };
}

/** Filters raw rows to an inclusive ISO date range (YYYY-MM-DD). */
export function filterRawRowsToRange(rows: NreRow[], startIso: string, endIso: string): NreRow[] {
  const startTs = Date.parse(startIso + "T00:00:00Z");
  const endTs = Date.parse(endIso + "T00:00:00Z");
  return rows.filter((row) => {
    const d = parseDate(getRowDate(row));
    if (!d) return false;
    const ts = Date.UTC(d.year, d.month - 1, d.day);
    return ts >= startTs && ts <= endTs;
  });
}
