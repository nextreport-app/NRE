import { ServiceError } from "../service-error";
import { buildDayBreakdownReportData } from "../nre/day-breakdown-report-data";
import { reconcileDayBreakdownReportWithCsv } from "../nre/csv-report-reconciliation";
import { filterNreRowsByDateRange } from "../nre/date-range";
import { resolveReportCurrencySymbol } from "../nre/csv-currency";
import { CURRENCY_SYMBOLS } from "../nre/format";
import type { NreRow } from "../nre/columns";
import type { ScheduleSettings } from "./calendar";
export function buildScheduledTableDraft(input: {
  accountName: string;
  currency: string;
  rows: NreRow[];
  headers: string[];
  period: { startIso: string; endIso: string };
  settings: ScheduleSettings;
  dueAt: Date;
}) {
  const { rows, headers, period, settings } = input;
  if (filterNreRowsByDateRange(rows, period).length !== rows.length)
    throw new ServiceError(
      "Meta returned invalid dates or rows outside the scheduled reporting period.",
    );
  const currencySymbol = resolveReportCurrencySymbol(
    headers,
    rows,
    CURRENCY_SYMBOLS[input.currency as keyof typeof CURRENCY_SYMBOLS] ??
      input.currency,
  );
  const selectedCampaigns = settings.campaignNames.length
    ? settings.campaignNames
    : null;
  const data = buildDayBreakdownReportData({
    accountName: input.accountName,
    currencySymbol,
    timezone: settings.timezone,
    mtdDailyRows: rows,
    dateRange: period,
    selectedCampaigns,
    csvHeaders: headers,
    platform: "META",
    now: input.dueAt,
  });
  if (data.isPaused)
    throw new ServiceError(
      "No delivery was available for the selected campaigns and reporting period.",
    );
  const verification = reconcileDayBreakdownReportWithCsv({
    report: data,
    mtdDailyRows: rows,
    selectedCampaigns,
    currencySymbol,
    platform: "META",
  });
  if (verification.status !== "ok")
    throw new ServiceError(
      "Source verification did not pass for the scheduled daily table. No report credit was used.",
    );
  return { data, verification };
}
