/**
 * Stable hash of wizard inputs that affect buildStandardReportForWizard output.
 */

import { createHash } from "node:crypto";
import type { Client } from "@/generated/prisma/client";
import type { Platform } from "./google-columns";
import {
  campaignMetricOverridesSchema,
  campaignObjectivesSchema,
  dateSelectionSchema,
  parseJsonFormField,
  reportTypeSchema,
  resolveCsvAlignResults,
  resolveIncludePreviousMonthComparison,
  resolveShowBudgetPacingOnCover,
  selectedAdSetsSchema,
  selectedCampaignsSchema,
  selectedMetricsSchema,
} from "@/lib/validators/report-wizard";

function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, v) => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return Object.keys(v as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, k) => {
          acc[k] = (v as Record<string, unknown>)[k];
          return acc;
        }, {});
    }
    return v;
  });
}

export function computeWizardStandardReportFingerprint(input: {
  fileHash: string;
  client: Pick<Client, "id" | "monthlyBudget" | "timezone" | "showBudgetPacingOnCover" | "campaignObjectiveCache">;
  platform: Platform;
  formData: FormData | null;
}): string {
  const { formData, client, platform, fileHash } = input;
  const payload = {
    fileHash,
    clientId: client.id,
    platform,
    monthlyBudget: client.monthlyBudget,
    timezone: client.timezone,
    showBudgetPacingOnCoverDefault: client.showBudgetPacingOnCover,
    campaignObjectiveCache: client.campaignObjectiveCache ?? "",
    selectedCampaigns: formData ? parseJsonFormField(formData, "selectedCampaigns", selectedCampaignsSchema) : undefined,
    selectedAdSets: formData ? parseJsonFormField(formData, "selectedAdSets", selectedAdSetsSchema) : undefined,
    selectedMetrics: formData ? parseJsonFormField(formData, "selectedMetrics", selectedMetricsSchema) : undefined,
    campaignObjectives: formData ? parseJsonFormField(formData, "campaignObjectives", campaignObjectivesSchema) : undefined,
    campaignMetricOverrides: formData
      ? parseJsonFormField(formData, "campaignMetricOverrides", campaignMetricOverridesSchema)
      : undefined,
    reportType: formData ? parseJsonFormField(formData, "reportType", reportTypeSchema) : undefined,
    dateSelection: formData ? parseJsonFormField(formData, "dateSelection", dateSelectionSchema) : undefined,
    includePreviousMonthComparison: resolveIncludePreviousMonthComparison(formData),
    showBudgetPacingOnCover: resolveShowBudgetPacingOnCover(formData, client.showBudgetPacingOnCover),
    csvAlignResults: resolveCsvAlignResults(formData),
  };
  return createHash("sha256").update(stableJson(payload)).digest("hex");
}
