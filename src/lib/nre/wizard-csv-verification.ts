/**
 * Shared CSV verification inputs for preview + generate (must stay in sync).
 */

import type { Client } from "@/generated/prisma/client";
import type { Platform } from "./google-columns";
import type { NreRow } from "./columns";
import type { ReportData } from "./report-data";
import { CURRENCY_SYMBOLS } from "./format";
import { computeDailyRangeIso } from "./date-range";
import { resolveDateSelection } from "./resolve-date-selection";
import { resolveCsvAlignResults } from "@/lib/validators/report-wizard";
import {
  campaignObjectivesSchema,
  dateSelectionSchema,
  parseJsonFormField,
  selectedCampaignsSchema,
} from "@/lib/validators/report-wizard";
import { reconcileStandardReportWithCsv, type CsvVerificationResult } from "./csv-report-reconciliation";
export function verifyStandardWizardReportAgainstCsv(input: {
  client: Pick<Client, "timezone" | "currency">;
  mtdRows: NreRow[];
  report: ReportData;
  reportType: ReportData["reportType"];
  formData: FormData | null;
  platform: Platform;
  now?: Date;
  periodRows?: NreRow[] | null;
}): Promise<CsvVerificationResult> {
  const { client, mtdRows, report, reportType, formData, platform } = input;
  const now = input.now ?? new Date();
  const csvAlign = resolveCsvAlignResults(formData);
  const selectedCampaigns = formData ? parseJsonFormField(formData, "selectedCampaigns", selectedCampaignsSchema) : undefined;
  const campaignObjectives = formData ? parseJsonFormField(formData, "campaignObjectives", campaignObjectivesSchema) : undefined;
  const dateSelection = formData ? parseJsonFormField(formData, "dateSelection", dateSelectionSchema) : undefined;

  let weeklyRange: { startIso: string; endIso: string } | undefined;
  if (reportType === "DAILY") {
    weeklyRange = computeDailyRangeIso(mtdRows, now, client.timezone) ?? undefined;
  } else if (reportType === "WEEKLY") {
    const dateResolution = resolveDateSelection(mtdRows, dateSelection, now, client.timezone);
    weeklyRange = dateResolution.ok ? dateResolution.weeklyRange : undefined;
  }

  return reconcileStandardReportWithCsv({
    report,
    mtdDailyRows: mtdRows,
    selectedCampaigns: selectedCampaigns ?? null,
    weeklyRange,
    reportType,
    timezone: client.timezone,
    currencySymbol: CURRENCY_SYMBOLS[client.currency],
    now,
    resultCountingMode: csvAlign ? "meta-csv-export" : "standard",
    periodRows: input.periodRows,
    campaignObjectives: campaignObjectives ?? null,
    platform,
  });
}
