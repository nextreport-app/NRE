/**
 * Loads a client's persisted Previous Month Data upload (see
 * prisma/schema.prisma's Client.previousMonthDataUrl and
 * components/previous-month-data-upload.tsx) for use as the Combined
 * Total table's Period row — the replacement for the old per-report
 * "Period CSV" upload, which had to be re-attached to every single report
 * request instead of being remembered per client. Shared by both the
 * report-preview and report-generate routes so the two can never parse it
 * differently.
 */

import { readPreviousMonthDataFile } from "@/lib/storage";
import { parseUploadedFile } from "./parse-file";
import { extractSpendingCampaignNames, filterRowsByCampaigns } from "./campaigns";
import type { NreRow } from "./columns";

/**
 * Part 1 — filters the Period row's own rows down to
 * Client.previousMonthSelectedCampaigns before report-data.ts ever
 * aggregates them, the same never-reaches-the-engine guarantee
 * filterRowsByCampaigns already gives the MTD Daily CSV's own campaign
 * selection. `null` (unset — a client that predates this column, or whose
 * selection was cleared) means "include everything," matching the column's
 * own schema comment.
 */
export async function loadPreviousMonthDataRows(client: {
  previousMonthDataUrl: string | null;
  previousMonthSelectedCampaigns?: string | null;
}): Promise<NreRow[] | undefined> {
  if (!client.previousMonthDataUrl) return undefined;
  const buffer = await readPreviousMonthDataFile(client.previousMonthDataUrl);
  const rows = parseUploadedFile(buffer, "Previous Month Data").rows;
  const selectedCampaigns = parseSelectedCampaigns(client.previousMonthSelectedCampaigns);
  return filterRowsByCampaigns(rows, selectedCampaigns);
}

function parseSelectedCampaigns(raw: string | null | undefined): string[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((c): c is string => typeof c === "string") : null;
  } catch {
    return null;
  }
}

/** Part 1 — the client page's own server-side re-parse of the stored file, to render the campaign checkbox list's full universe (not just what's currently selected) on every page load, without a second upload. */
export async function loadPreviousMonthDataCampaigns(previousMonthDataUrl: string): Promise<string[]> {
  const buffer = await readPreviousMonthDataFile(previousMonthDataUrl);
  const rows = parseUploadedFile(buffer, "Previous Month Data").rows;
  return extractSpendingCampaignNames(rows);
}
