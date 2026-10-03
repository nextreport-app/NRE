import type { MetaInsightRow } from "@/lib/meta-api";
import { manualExportPrimaryResult } from "./manual-export-mapper";

function actionSum(row: MetaInsightRow, actionType: string): number {
  for (const a of row.actions ?? []) {
    if (a.action_type === actionType) {
      const n = parseFloat(a.value ?? "");
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return 0;
}

export type MetaSyncDiagnostics = {
  /** Sum of mapped Results column (what the downloaded CSV should show). */
  mappedResultsSum: number;
  rowCount: number;
  rowsWithResultsField: number;
  rowsWithObjectiveResultsField: number;
  rowsWithPixelInActions: number;
  rowsWithOnsiteWebLeadInActions: number;
  rowsWithCostedLeadInResults: number;
  rowsWithMappedResults: number;
  /** action_type values on the first spend row (confirms delivery-only vs conversion payload). */
  sampleActionTypes: string[];
  usedCampaignLevelConversionFallback: boolean;
  /** First rows where Meta sent conversion fields but mapper output blank. */
  blankMapperSamples: Array<{
    day: string;
    campaign: string;
    adset: string;
    optimization_goal: string | undefined;
    resultIndicators: string[];
    objectiveIndicators: string[];
    pixelInActions: number;
  }>;
  deployCommit: string | null;
};

function rowHasCostedLeadInResults(row: MetaInsightRow): boolean {
  for (const entry of row.results ?? []) {
    const ind = (entry.indicator ?? "").trim();
    if (ind !== "actions:lead" && ind !== "lead") continue;
    const nested = entry.values?.[0]?.value;
    const count = nested != null ? parseFloat(nested) : 0;
    if (count <= 0) continue;
    for (const c of row.cost_per_result ?? []) {
      const cInd = (c.indicator ?? "").trim();
      if (cInd !== ind && cInd !== "actions:lead" && cInd !== "lead") continue;
      const cost = parseFloat(c.values?.[0]?.value ?? "0");
      if (cost > 0) return true;
    }
  }
  return false;
}

export function buildMetaSyncDiagnostics(
  rows: MetaInsightRow[],
  options?: { usedCampaignLevelConversionFallback?: boolean },
): MetaSyncDiagnostics {
  let mappedResultsSum = 0;
  let rowsWithResultsField = 0;
  let rowsWithObjectiveResultsField = 0;
  let rowsWithPixelInActions = 0;
  let rowsWithOnsiteWebLeadInActions = 0;
  let rowsWithCostedLeadInResults = 0;
  let rowsWithMappedResults = 0;
  const blankMapperSamples: MetaSyncDiagnostics["blankMapperSamples"] = [];
  const sampleRow = rows.find((r) => parseFloat(r.spend ?? "0") > 0);
  const sampleActionTypes = (sampleRow?.actions ?? []).map((a) => a.action_type).slice(0, 12);

  for (const row of rows) {
    if ((row.results?.length ?? 0) > 0) rowsWithResultsField++;
    if ((row.objective_results?.length ?? 0) > 0) rowsWithObjectiveResultsField++;
    const pixel = actionSum(row, "offsite_conversion.fb_pixel_lead");
    if (pixel > 0) rowsWithPixelInActions++;
    if (actionSum(row, "onsite_web_lead") > 0) rowsWithOnsiteWebLeadInActions++;
    if (rowHasCostedLeadInResults(row)) rowsWithCostedLeadInResults++;

    const primary = manualExportPrimaryResult(row);
    const mapped = primary ? parseFloat(primary.value) : 0;
    if (mapped > 0) {
      rowsWithMappedResults++;
      mappedResultsSum += mapped;
    } else if (
      blankMapperSamples.length < 5 &&
      ((row.results?.length ?? 0) > 0 ||
        (row.objective_results?.length ?? 0) > 0 ||
        pixel > 0)
    ) {
      blankMapperSamples.push({
        day: row.date_start ?? "",
        campaign: row.campaign_name ?? "",
        adset: row.adset_name ?? "",
        optimization_goal: row.optimization_goal,
        resultIndicators: (row.results ?? []).map((r) => r.indicator ?? ""),
        objectiveIndicators: (row.objective_results ?? []).map((r) => r.indicator ?? ""),
        pixelInActions: pixel,
      });
    }
  }

  return {
    mappedResultsSum,
    rowCount: rows.length,
    rowsWithResultsField,
    rowsWithObjectiveResultsField,
    rowsWithPixelInActions,
    rowsWithOnsiteWebLeadInActions,
    rowsWithCostedLeadInResults,
    rowsWithMappedResults,
    sampleActionTypes,
    usedCampaignLevelConversionFallback: options?.usedCampaignLevelConversionFallback ?? false,
    blankMapperSamples,
    deployCommit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
  };
}
