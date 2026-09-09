/**
 * When Meta API sync runs, auto-fetch and store Previous Month Data if the
 * client's file is missing or stale — same blob the manual upload uses.
 */

import { prisma } from "@/lib/prisma";
import { deletePreviousMonthDataFile, savePreviousMonthDataFile } from "@/lib/storage";
import { computePreviousCalendarMonthIsoRange } from "./api-date-range";
import { extractSpendingCampaignNames } from "./campaigns";
import { fetchMetaReportCsv } from "./fetch-meta-report-rows";
import { parseUploadedFile } from "./parse-file";
import { getPreviousMonthComparisonInfo } from "./previous-month-data-status";

export async function maybeSyncPreviousMonthDataFromMetaApi(input: {
  clientId: string;
  accessToken: string;
  adAccountId: string;
  timezone: string;
  previousMonthDataUrl: string | null;
  previousMonthDataUpdatedAt: Date | null;
  now?: Date;
}): Promise<{ synced: boolean; reason?: string }> {
  const info = getPreviousMonthComparisonInfo(
    !!input.previousMonthDataUrl,
    input.previousMonthDataUpdatedAt?.toISOString() ?? null,
    input.timezone,
    input.now,
  );
  if (info.status === "current") {
    return { synced: false, reason: "already current" };
  }

  const { sinceIso, untilIso } = computePreviousCalendarMonthIsoRange(input.now ?? new Date(), input.timezone);
  const result = await fetchMetaReportCsv({
    accessToken: input.accessToken,
    adAccountId: input.adAccountId,
    timezone: input.timezone,
    sinceIso,
    untilIso,
    now: input.now,
  });

  if (result.rowCount === 0) {
    return { synced: false, reason: "no rows returned" };
  }

  const buffer = Buffer.from(result.csvText, "utf-8");
  const rows = parseUploadedFile(buffer, "Previous Month Data").rows;
  const campaigns = extractSpendingCampaignNames(rows);

  const previousUrl = input.previousMonthDataUrl;
  const previousMonthDataUrl = await savePreviousMonthDataFile(
    input.clientId,
    buffer,
    `meta-api-prev-month-${untilIso}.csv`,
    "text/csv",
  );

  await prisma.client.update({
    where: { id: input.clientId },
    data: {
      previousMonthDataUrl,
      previousMonthDataUpdatedAt: new Date(),
      previousMonthSelectedCampaigns: JSON.stringify(campaigns),
    },
  });

  if (previousUrl && previousUrl !== previousMonthDataUrl) {
    await deletePreviousMonthDataFile(previousUrl);
  }

  return { synced: true };
}
