/**
 * When ad-platform API sync runs, auto-fetch and store Previous Month Data if the
 * client's file is missing or stale — same blob the manual upload uses.
 */

import { prisma } from "@/lib/prisma";
import { deletePreviousMonthDataFile, readPreviousMonthDataFile, savePreviousMonthDataFile } from "@/lib/storage";
import { computePreviousCalendarMonthIsoRange } from "./api-date-range";
import { extractSpendingCampaignNames } from "./campaigns";
import type { NreRow } from "./columns";
import { fetchGoogleReportCsv } from "./fetch-google-report-rows";
import { fetchMetaReportCsv } from "./fetch-meta-report-rows";
import { fetchTikTokReportCsv } from "./fetch-tiktok-report-rows";
import { mergePreviousMonthSelection } from "./merge-previous-month-selection";
import { parseUploadedFile } from "./parse-file";
import { parsePreviousMonthSelectedCampaigns } from "./previous-month-data";
import { getPreviousMonthComparisonInfo } from "./previous-month-data-status";
import { parseMtdCsvForAdPlatform } from "./tiktok-columns";

export type PreviousMonthSyncResult = {
  synced: boolean;
  reason?: string;
  campaigns?: string[];
  selectedCampaigns?: string[];
};

async function loadPreviousMonthCampaignsFromUrl(url: string | null): Promise<string[]> {
  if (!url) return [];
  try {
    const buffer = await readPreviousMonthDataFile(url);
    return extractSpendingCampaignNames(parseUploadedFile(buffer, "Previous Month Data").rows);
  } catch {
    return [];
  }
}

async function maybeSyncPreviousMonthDataFromFetch(input: {
  clientId: string;
  timezone: string;
  previousMonthDataUrl: string | null;
  previousMonthDataUpdatedAt: Date | null;
  previousMonthSelectedCampaigns: string | null;
  now?: Date;
  fileNamePrefix: string;
  fetchCsv: (sinceIso: string, untilIso: string) => Promise<{ csvText: string; rowCount: number }>;
  extractCampaigns: (buffer: Buffer) => string[];
}): Promise<PreviousMonthSyncResult> {
  const info = getPreviousMonthComparisonInfo(
    !!input.previousMonthDataUrl,
    input.previousMonthDataUpdatedAt?.toISOString() ?? null,
    input.timezone,
    input.now,
  );
  if (info.status === "current") {
    const campaigns = await loadPreviousMonthCampaignsFromUrl(input.previousMonthDataUrl);
    const selected =
      parsePreviousMonthSelectedCampaigns(input.previousMonthSelectedCampaigns) ?? campaigns;
    return { synced: false, reason: "already current", campaigns, selectedCampaigns: selected };
  }

  const { sinceIso, untilIso } = computePreviousCalendarMonthIsoRange(input.now ?? new Date(), input.timezone);
  const result = await input.fetchCsv(sinceIso, untilIso);

  if (result.rowCount === 0) {
    return { synced: false, reason: "no rows returned" };
  }

  const buffer = Buffer.from(result.csvText, "utf-8");
  const campaigns = input.extractCampaigns(buffer);
  const previousSelected = parsePreviousMonthSelectedCampaigns(input.previousMonthSelectedCampaigns);
  const previousAllCampaigns = await loadPreviousMonthCampaignsFromUrl(input.previousMonthDataUrl);
  const selectedCampaigns = mergePreviousMonthSelection(campaigns, previousSelected, previousAllCampaigns);

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
      previousMonthSelectedCampaigns: JSON.stringify(selectedCampaigns),
    },
  });

  if (previousUrl && previousUrl !== previousMonthDataUrl) {
    await deletePreviousMonthDataFile(previousUrl);
  }

  return { synced: true, campaigns, selectedCampaigns };
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
  previousMonthSelectedCampaigns: string | null;
  now?: Date;
}): Promise<PreviousMonthSyncResult> {
  return maybeSyncPreviousMonthDataFromFetch({
    clientId: input.clientId,
    timezone: input.timezone,
    previousMonthDataUrl: input.previousMonthDataUrl,
    previousMonthDataUpdatedAt: input.previousMonthDataUpdatedAt,
    previousMonthSelectedCampaigns: input.previousMonthSelectedCampaigns,
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
  previousMonthSelectedCampaigns: string | null;
  now?: Date;
}): Promise<PreviousMonthSyncResult> {
  return maybeSyncPreviousMonthDataFromFetch({
    clientId: input.clientId,
    timezone: input.timezone,
    previousMonthDataUrl: input.previousMonthDataUrl,
    previousMonthDataUpdatedAt: input.previousMonthDataUpdatedAt,
    previousMonthSelectedCampaigns: input.previousMonthSelectedCampaigns,
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
  previousMonthSelectedCampaigns: string | null;
  now?: Date;
  loginCustomerId?: string;
}): Promise<PreviousMonthSyncResult> {
  return maybeSyncPreviousMonthDataFromFetch({
    clientId: input.clientId,
    timezone: input.timezone,
    previousMonthDataUrl: input.previousMonthDataUrl,
    previousMonthDataUpdatedAt: input.previousMonthDataUpdatedAt,
    previousMonthSelectedCampaigns: input.previousMonthSelectedCampaigns,
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
