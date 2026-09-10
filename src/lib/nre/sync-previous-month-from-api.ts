/**
 * When ad-platform API sync runs, auto-fetch and store Previous Month Data if the
 * client's file is missing or stale — same blob the manual upload uses.
 */

import { prisma } from "@/lib/prisma";
import { deletePreviousMonthDataFile, savePreviousMonthDataFile } from "@/lib/storage";
import { computePreviousCalendarMonthIsoRange } from "./api-date-range";
import { extractSpendingCampaignNames } from "./campaigns";
import type { NreRow } from "./columns";
import { fetchGoogleReportCsv } from "./fetch-google-report-rows";
import { fetchMetaReportCsv } from "./fetch-meta-report-rows";
import { fetchTikTokReportCsv } from "./fetch-tiktok-report-rows";
import { parseMtdCsvForAdPlatform } from "./tiktok-columns";
import { parseUploadedFile } from "./parse-file";
import { getPreviousMonthComparisonInfo } from "./previous-month-data-status";

async function maybeSyncPreviousMonthDataFromFetch(input: {
  clientId: string;
  timezone: string;
  previousMonthDataUrl: string | null;
  previousMonthDataUpdatedAt: Date | null;
  now?: Date;
  fileNamePrefix: string;
  fetchCsv: (sinceIso: string, untilIso: string) => Promise<{ csvText: string; rowCount: number }>;
  extractCampaigns: (buffer: Buffer) => string[];
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
  const result = await input.fetchCsv(sinceIso, untilIso);

  if (result.rowCount === 0) {
    return { synced: false, reason: "no rows returned" };
  }

  const buffer = Buffer.from(result.csvText, "utf-8");
  const campaigns = input.extractCampaigns(buffer);

  const previousUrl = input.previousMonthDataUrl;
  const previousMonthDataUrl = await savePreviousMonthDataFile(
    input.clientId,
    buffer,
    `${input.fileNamePrefix}-${untilIso}.csv`,
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

function metaCampaignsFromBuffer(buffer: Buffer): string[] {
  return extractSpendingCampaignNames(parseUploadedFile(buffer, "Previous Month Data").rows);
}

function googleCampaignsFromBuffer(buffer: Buffer): string[] {
  const parsed = parseMtdCsvForAdPlatform(buffer, "GOOGLE");
  return extractSpendingCampaignNames(parsed.rows as NreRow[]);
}

function tiktokCampaignsFromBuffer(buffer: Buffer): string[] {
  const parsed = parseMtdCsvForAdPlatform(buffer, "TIKTOK");
  return extractSpendingCampaignNames(parsed.rows);
}

export async function maybeSyncPreviousMonthDataFromMetaApi(input: {
  clientId: string;
  accessToken: string;
  adAccountId: string;
  timezone: string;
  previousMonthDataUrl: string | null;
  previousMonthDataUpdatedAt: Date | null;
  now?: Date;
}): Promise<{ synced: boolean; reason?: string }> {
  return maybeSyncPreviousMonthDataFromFetch({
    clientId: input.clientId,
    timezone: input.timezone,
    previousMonthDataUrl: input.previousMonthDataUrl,
    previousMonthDataUpdatedAt: input.previousMonthDataUpdatedAt,
    now: input.now,
    fileNamePrefix: "meta-api-prev-month",
    fetchCsv: async (sinceIso, untilIso) =>
      fetchMetaReportCsv({
        accessToken: input.accessToken,
        adAccountId: input.adAccountId,
        timezone: input.timezone,
        sinceIso,
        untilIso,
        now: input.now,
      }),
    extractCampaigns: metaCampaignsFromBuffer,
  });
}

export async function maybeSyncPreviousMonthDataFromTikTokApi(input: {
  clientId: string;
  accessToken: string;
  advertiserId: string;
  timezone: string;
  previousMonthDataUrl: string | null;
  previousMonthDataUpdatedAt: Date | null;
  now?: Date;
}): Promise<{ synced: boolean; reason?: string }> {
  return maybeSyncPreviousMonthDataFromFetch({
    clientId: input.clientId,
    timezone: input.timezone,
    previousMonthDataUrl: input.previousMonthDataUrl,
    previousMonthDataUpdatedAt: input.previousMonthDataUpdatedAt,
    now: input.now,
    fileNamePrefix: "tiktok-api-prev-month",
    fetchCsv: async (sinceIso, untilIso) =>
      fetchTikTokReportCsv({
        accessToken: input.accessToken,
        advertiserId: input.advertiserId,
        timezone: input.timezone,
        sinceIso,
        untilIso,
        now: input.now,
      }),
    extractCampaigns: tiktokCampaignsFromBuffer,
  });
}

export async function maybeSyncPreviousMonthDataFromGoogleApi(input: {
  clientId: string;
  accessToken: string;
  customerId: string;
  timezone: string;
  previousMonthDataUrl: string | null;
  previousMonthDataUpdatedAt: Date | null;
  now?: Date;
  loginCustomerId?: string;
}): Promise<{ synced: boolean; reason?: string }> {
  return maybeSyncPreviousMonthDataFromFetch({
    clientId: input.clientId,
    timezone: input.timezone,
    previousMonthDataUrl: input.previousMonthDataUrl,
    previousMonthDataUpdatedAt: input.previousMonthDataUpdatedAt,
    now: input.now,
    fileNamePrefix: "google-api-prev-month",
    fetchCsv: async (sinceIso, untilIso) =>
      fetchGoogleReportCsv({
        accessToken: input.accessToken,
        customerId: input.customerId,
        timezone: input.timezone,
        sinceIso,
        untilIso,
        now: input.now,
        loginCustomerId: input.loginCustomerId,
      }),
    extractCampaigns: googleCampaignsFromBuffer,
  });
}
