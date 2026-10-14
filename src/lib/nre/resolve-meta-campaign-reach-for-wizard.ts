/**
 * Loads Meta campaign-level period reach for report windows (Ads Manager parity).
 */

import { ensureFreshMetaAccessToken } from "@/lib/meta-api";
import type { Platform } from "./google-columns";
import type { DateRangeIso } from "./date-range";
import { computeCreativeRangeIso, computeMtdRangeIso } from "./date-range";
import { resolveDateSelection } from "./resolve-date-selection";
import type { NreRow } from "./columns";
import {
  fetchMetaCampaignPeriodReachMaps,
  mergeMetaCampaignPeriodReachMaps,
  type MetaCampaignPeriodReachMaps,
} from "./meta-api-sync/fetch-campaign-period-reach";
import { metaCampaignPeriodReachRangeKey } from "./campaign-period-reach-maps";
import { metaAdAccountIdSchema, parseJsonFormField } from "@/lib/validators/report-wizard";
import type { DateSelection } from "@/lib/validators/report-wizard";

function dedupeRanges(ranges: DateRangeIso[]): DateRangeIso[] {
  const seen = new Set<string>();
  const out: DateRangeIso[] = [];
  for (const r of ranges) {
    if (!r.startIso || !r.endIso) continue;
    const key = `${r.startIso}:${r.endIso}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

export function collectReportReachDateRanges(input: {
  mtdDailyRows: NreRow[];
  timezone: string;
  dateSelection?: DateSelection;
  now?: Date;
}): DateRangeIso[] {
  const now = input.now ?? new Date();
  const ranges: DateRangeIso[] = [];
  const mtd = computeMtdRangeIso(input.mtdDailyRows, now, input.timezone);
  if (mtd) ranges.push(mtd);

  const dateResolution = resolveDateSelection(input.mtdDailyRows, input.dateSelection, now, input.timezone);
  if (dateResolution.ok && dateResolution.weeklyRange) {
    ranges.push(dateResolution.weeklyRange);
  }

  ranges.push(computeCreativeRangeIso(input.mtdDailyRows, now, 30, input.timezone));

  return dedupeRanges(ranges);
}

/** Session snapshot from analyze/API sync already includes these windows — skip live Meta fetch. */
export function sessionMapsCoverReachRanges(
  sessionMaps: MetaCampaignPeriodReachMaps | undefined,
  ranges: DateRangeIso[],
): boolean {
  if (!sessionMaps?.byRangeKey || ranges.length === 0) return false;
  for (const range of ranges) {
    const key = metaCampaignPeriodReachRangeKey(range.startIso, range.endIso);
    if (!(key in sessionMaps.byRangeKey)) return false;
  }
  return true;
}

export async function resolveMetaCampaignPeriodReachForWizard(input: {
  platform: Platform;
  mtdDailyRows: NreRow[];
  timezone: string;
  dateSelection?: DateSelection;
  sessionMaps?: MetaCampaignPeriodReachMaps;
  metaAdAccountId?: string;
  metaAccessToken?: string | null;
  now?: Date;
}): Promise<MetaCampaignPeriodReachMaps | undefined> {
  if (input.platform !== "META") return input.sessionMaps;

  const ranges = collectReportReachDateRanges({
    mtdDailyRows: input.mtdDailyRows,
    timezone: input.timezone,
    dateSelection: input.dateSelection,
    now: input.now,
  });

  let fetched: MetaCampaignPeriodReachMaps | undefined;
  const skipLiveFetch = sessionMapsCoverReachRanges(input.sessionMaps, ranges);
  if (input.metaAccessToken && input.metaAdAccountId && !skipLiveFetch) {
    try {
      fetched = await fetchMetaCampaignPeriodReachMaps({
        accessToken: input.metaAccessToken,
        adAccountId: input.metaAdAccountId,
        ranges,
      });
    } catch (err) {
      console.error("[resolveMetaCampaignPeriodReachForWizard] Meta reach fetch failed:", err);
    }
  }

  return mergeMetaCampaignPeriodReachMaps(fetched, input.sessionMaps);
}

export function parseMetaAdAccountIdFromForm(formData: FormData | null): string | undefined {
  if (!formData) return undefined;
  return parseJsonFormField(formData, "metaAdAccountId", metaAdAccountIdSchema);
}
