/**
 * Shared standard-report input assembly for generate + preview routes.
 */

import type { Client } from "@/generated/prisma/client";
import type { Platform } from "../google-columns";
import type { ColumnMap, NreRow } from "../columns";
import type { ReportData, ReportType } from "../report-data";
import { CURRENCY_SYMBOLS } from "../format";
import { adsManagerName } from "../platform-reporting";
import { resolveDateSelection } from "../resolve-date-selection";
import { loadPreviousMonthDataRows } from "../previous-month-data";
import { detectAdNameColumn, hasAdLevelData } from "../ad-level";
import { computeDailyRangeIso } from "../date-range";
import { parseObjectiveCache } from "../objective-cache";
import {
  campaignMetricOverridesSchema,
  campaignObjectivesSchema,
  dateSelectionSchema,
  parseJsonFormField,
  reportTypeSchema,
  selectedAdSetsSchema,
  selectedCampaignsSchema,
  selectedMetricsSchema,
  resolveIncludePreviousMonthComparison,
  resolveShowBudgetPacingOnCover,
  resolveCsvAlignResults,
} from "@/lib/validators/report-wizard";
import { createReportEngine } from "./report-engine-impl";
import { prisma } from "@/lib/prisma";
import { ensureFreshMetaAccessToken } from "@/lib/meta-api";
import {
  parseMetaAdAccountIdFromForm,
  resolveMetaCampaignPeriodReachForWizard,
} from "../resolve-meta-campaign-reach-for-wizard";
import type { MetaCampaignPeriodReachMaps } from "../campaign-period-reach-maps";
import type { AiCopy } from "@/lib/pptx/fill-tags";
import { computeWizardStandardReportFingerprint } from "../wizard-report-config-fingerprint";
import { loadWizardPreviewReportCache } from "../wizard-preview-cache";

export interface BuildStandardReportWizardInput {
  client: Client;
  mtdParsed: { colMap: ColumnMap; rows: NreRow[]; headers: string[] };
  formData: FormData | null;
  platform: Platform;
  metaCampaignPeriodReachFromSession?: MetaCampaignPeriodReachMaps;
  metaAdAccountIdFromSession?: string;
}

export type BuildStandardReportWizardResult = { data: ReportData } | { error: string };

export type ResolveStandardReportForGenerateResult =
  | { data: ReportData; fromPreviewCache: boolean; aiCopyPrecalc?: Record<string, AiCopy> }
  | { error: string };

/** Generate route — reuse preview-built report (and warmed AI) when config matches. */
export async function resolveStandardReportForGenerate(
  input: BuildStandardReportWizardInput & {
    userId: string;
    uploadSessionId?: string;
    fileHash?: string;
  },
): Promise<ResolveStandardReportForGenerateResult> {
  const fileHash = input.fileHash ?? "";
  if (input.uploadSessionId && fileHash) {
    const fingerprint = computeWizardStandardReportFingerprint({
      fileHash,
      client: input.client,
      platform: input.platform,
      formData: input.formData,
    });
    const cached = await loadWizardPreviewReportCache(
      input.userId,
      input.client.id,
      input.uploadSessionId,
      fingerprint,
    );
    if (cached) {
      return {
        data: cached.reportData,
        fromPreviewCache: true,
        aiCopyPrecalc: cached.aiCopy,
      };
    }
  }

  const built = await buildStandardReportForWizard(input);
  if ("error" in built) return built;
  return { data: built.data, fromPreviewCache: false };
}

export async function buildStandardReportForWizard(
  input: BuildStandardReportWizardInput,
): Promise<BuildStandardReportWizardResult> {
  const { client, mtdParsed, formData, platform, metaCampaignPeriodReachFromSession, metaAdAccountIdFromSession } =
    input;
  const engine = createReportEngine(platform);

  const selectedCampaigns = formData ? parseJsonFormField(formData, "selectedCampaigns", selectedCampaignsSchema) : undefined;
  const selectedAdSets = formData ? parseJsonFormField(formData, "selectedAdSets", selectedAdSetsSchema) : undefined;
  const selectedMetrics = formData ? parseJsonFormField(formData, "selectedMetrics", selectedMetricsSchema) : undefined;
  const campaignObjectives = formData ? parseJsonFormField(formData, "campaignObjectives", campaignObjectivesSchema) : undefined;
  const campaignMetricOverrides = formData
    ? parseJsonFormField(formData, "campaignMetricOverrides", campaignMetricOverridesSchema)
    : undefined;
  const dateSelection = formData ? parseJsonFormField(formData, "dateSelection", dateSelectionSchema) : undefined;

  const parsedReportType = formData ? parseJsonFormField(formData, "reportType", reportTypeSchema) : undefined;
  const adNameColumn = detectAdNameColumn(mtdParsed.headers);

  let reportType: ReportType = "WEEKLY";
  if (parsedReportType === "MONTHLY") reportType = "MONTHLY";
  else if (parsedReportType === "DAILY") reportType = "DAILY";
  else if (parsedReportType === "CREATIVE") reportType = "CREATIVE";
  else if (parsedReportType === "QUARTER") reportType = "QUARTER";
  else if (parsedReportType === "YTD") reportType = "YTD";

  if (parsedReportType === "CREATIVE" && !hasAdLevelData(mtdParsed.headers)) {
    return {
      error: `Creative reporting requires an Ad-level CSV with an Ad Name column. Export from ${adsManagerName(platform)} → Ads tab with daily breakdown.`,
    };
  }

  let weeklyRange: { startIso: string; endIso: string } | undefined;
  if (reportType === "DAILY") {
    const daily = computeDailyRangeIso(mtdParsed.rows, new Date(), client.timezone);
    if (!daily) return { error: "Could not determine yesterday's date from the CSV." };
    weeklyRange = daily;
  } else if (reportType !== "CREATIVE" && reportType !== "MONTHLY" && reportType !== "QUARTER" && reportType !== "YTD") {
    const dateResolution = resolveDateSelection(mtdParsed.rows, dateSelection, new Date(), client.timezone);
    if (!dateResolution.ok) {
      return { error: dateResolution.error || "Invalid date selection." };
    }
    weeklyRange = dateResolution.weeklyRange;
  }

  const includePreviousMonthComparison = resolveIncludePreviousMonthComparison(formData);
  const periodRows = includePreviousMonthComparison ? await loadPreviousMonthDataRows(client) : undefined;

  let metaAccessToken: string | null = null;
  if (platform === "META") {
    const user = await prisma.user.findUnique({
      where: { id: client.userId },
      select: { metaAccessToken: true, metaTokenExpiresAt: true, metaAdsEnabled: true },
    });
    if (user?.metaAdsEnabled && user.metaAccessToken) {
      const fresh = await ensureFreshMetaAccessToken({
        accessToken: user.metaAccessToken,
        tokenExpiresAt: user.metaTokenExpiresAt,
      });
      metaAccessToken = fresh.accessToken;
    }
  }

  const metaAdAccountId = parseMetaAdAccountIdFromForm(formData) ?? metaAdAccountIdFromSession;
  const metaCampaignPeriodReach = await resolveMetaCampaignPeriodReachForWizard({
    platform,
    mtdDailyRows: mtdParsed.rows,
    timezone: client.timezone,
    dateSelection,
    sessionMaps: metaCampaignPeriodReachFromSession,
    metaAdAccountId,
    metaAccessToken,
  });

  const data = engine.buildStandard({
    accountName: client.accountName,
    currencySymbol: CURRENCY_SYMBOLS[client.currency],
    timezone: client.timezone,
    monthlyBudget: client.monthlyBudget,
    showBudgetPacingOnCover: resolveShowBudgetPacingOnCover(formData, client.showBudgetPacingOnCover),
    alignResultsWithCsvExport: resolveCsvAlignResults(formData),
    mtdDailyRows: mtdParsed.rows,
    periodRows,
    selectedCampaigns: selectedCampaigns ?? null,
    selectedAdSets: selectedAdSets ?? null,
    weeklyRange,
    reportType,
    selectedMetrics,
    campaignObjectives,
    campaignMetricOverrides,
    objectiveCache: parseObjectiveCache(client.campaignObjectiveCache),
    adNameColumn,
    creativeOnly: reportType === "CREATIVE",
    platform,
    metaCampaignPeriodReach,
  });

  return { data };
}
