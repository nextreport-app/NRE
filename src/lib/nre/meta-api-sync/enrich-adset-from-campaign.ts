import type { MetaInsightRow } from "@/lib/meta-api";
import {
  campaignNameHaystack,
  isWebsiteLeadsCampaignHaystack,
} from "../campaign-name-heuristics";
import {
  hasMeaningfulConversionFields,
  hasMeaningfulWebsiteConversionFields,
} from "./conversion-field-signals";
import { isWebsiteSubmissionResultAction } from "./website-submission-actions";

const CUSTOM_CONVERSION = /offsite_conversion\.custom\./i;

function parseIndicator(indicator: string): string | null {
  const trimmed = indicator.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("actions:")) return trimmed.slice("actions:".length);
  if (trimmed.includes(".")) return trimmed;
  if (/^[a-z][a-z0-9_]*$/i.test(trimmed)) return trimmed;
  return null;
}

function metricValue(entry: { values?: Array<{ value?: string }>; value?: string }): number {
  const nested = entry.values?.[0]?.value;
  if (nested != null && nested !== "") {
    const n = parseFloat(nested);
    if (Number.isFinite(n)) return n;
  }
  const direct = entry.value;
  if (direct != null && direct !== "") {
    const n = parseFloat(direct);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function costForIndicatorOnList(
  entries: MetaInsightRow["cost_per_result"] | undefined,
  indicator: string,
): number {
  const want = indicator.trim();
  const wantAction = parseIndicator(want);
  for (const entry of entries ?? []) {
    const ind = (entry.indicator ?? "").trim();
    if (ind !== want && !(wantAction && parseIndicator(ind) === wantAction)) continue;
    const n = metricValue(entry);
    if (n > 0) return n;
  }
  return 0;
}

/** Campaign-level costed custom only — Ads Manager ad-set export stays blank (Credit Firm +4). */
export function campaignCostedWebsiteIsCustomOnly(row: MetaInsightRow): boolean {
  let costedWebsite = 0;
  let costedCustom = 0;
  for (const entry of row.results ?? []) {
    const actionType = parseIndicator(entry.indicator ?? "");
    if (!actionType || !isWebsiteSubmissionResultAction(actionType)) continue;
    const count = metricValue(entry);
    if (count <= 0) continue;
    const cost = costForIndicatorOnList(row.cost_per_result, entry.indicator ?? "");
    if (cost <= 0) continue;
    costedWebsite++;
    if (CUSTOM_CONVERSION.test(actionType)) costedCustom++;
  }
  return costedWebsite > 0 && costedWebsite === costedCustom;
}

function skipCampaignCustomOntoBlankAdset(adset: MetaInsightRow, campaign: MetaInsightRow): boolean {
  if (!hasMeaningfulWebsiteConversionFields(adset) && campaignCostedWebsiteIsCustomOnly(campaign)) {
    return true;
  }
  return false;
}

function campaignDayKey(row: MetaInsightRow): string | null {
  if (!row.campaign_name?.trim() || !row.date_start?.trim()) return null;
  return `${row.campaign_name.trim()}\0${row.date_start.trim()}`;
}

function adsetDayKey(row: MetaInsightRow): string | null {
  if (!row.campaign_name?.trim() || !row.date_start?.trim()) return null;
  const adset = (row.adset_name ?? "").trim();
  return `${row.campaign_name.trim()}\0${adset}\0${row.date_start.trim()}`;
}

function rowHasConversionFields(row: MetaInsightRow): boolean {
  return hasMeaningfulConversionFields(row);
}

/**
 * When ad-set insights omit results[] (common live bug) but campaign-level includes them,
 * copy conversion fields onto ad-set rows only if that campaign+day has a single ad set
 * in this fetch (avoids duplicating campaign totals across multiple ad sets).
 */
export function enrichAdSetInsightsFromCampaignLevel(
  adsetRows: MetaInsightRow[],
  campaignRows: MetaInsightRow[],
): MetaInsightRow[] {
  const adsetsPerCampaignDay = new Map<string, number>();
  for (const row of adsetRows) {
    const key = campaignDayKey(row);
    if (!key) continue;
    adsetsPerCampaignDay.set(key, (adsetsPerCampaignDay.get(key) ?? 0) + 1);
  }

  const campaignByDay = new Map<string, MetaInsightRow>();
  const campaignWebsiteByDay = new Map<string, MetaInsightRow>();
  for (const row of campaignRows) {
    const key = campaignDayKey(row);
    if (!key) continue;
    if (hasMeaningfulConversionFields(row)) {
      campaignByDay.set(key, row);
    }
    if (hasMeaningfulWebsiteConversionFields(row)) {
      campaignWebsiteByDay.set(key, row);
    }
  }

  function isWebsiteLeadRow(row: MetaInsightRow): boolean {
    return isWebsiteLeadsCampaignHaystack(
      campaignNameHaystack(row.campaign_name, row.adset_name),
    );
  }

  function mergeConversionFromCampaign(
    row: MetaInsightRow,
    campaign: MetaInsightRow,
  ): MetaInsightRow {
    return {
      ...row,
      results: campaign.results,
      cost_per_result: campaign.cost_per_result,
      objective_results: campaign.objective_results,
      cost_per_objective_result: campaign.cost_per_objective_result,
    };
  }

  return adsetRows.map((row) => {
    const campKey = campaignDayKey(row);
    if (!campKey || (adsetsPerCampaignDay.get(campKey) ?? 0) !== 1) return row;

    const campaignWebsite = campaignWebsiteByDay.get(campKey);
    if (
      isWebsiteLeadRow(row) &&
      campaignWebsite &&
      !hasMeaningfulWebsiteConversionFields(row) &&
      !skipCampaignCustomOntoBlankAdset(row, campaignWebsite)
    ) {
      return mergeConversionFromCampaign(row, campaignWebsite);
    }

    if (hasMeaningfulConversionFields(row)) return row;

    const campaign = campaignByDay.get(campKey);
    if (!campaign) return row;
    // Campaign often sends costed LPV/link_click only — do not overwrite website ad-set rows.
    if (isWebsiteLeadRow(row) && !hasMeaningfulWebsiteConversionFields(campaign)) {
      return row;
    }
    if (isWebsiteLeadRow(row) && skipCampaignCustomOntoBlankAdset(row, campaign)) {
      return row;
    }
    return mergeConversionFromCampaign(row, campaign);
  });
}

export function countRowsWithConversionFields(rows: MetaInsightRow[]): number {
  return rows.filter((r) => hasMeaningfulConversionFields(r)).length;
}

export { adsetDayKey, campaignDayKey };
