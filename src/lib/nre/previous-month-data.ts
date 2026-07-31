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
import type { NreRow } from "./columns";

export async function loadPreviousMonthDataRows(client: {
  previousMonthDataUrl: string | null;
}): Promise<NreRow[] | undefined> {
  if (!client.previousMonthDataUrl) return undefined;
  const buffer = await readPreviousMonthDataFile(client.previousMonthDataUrl);
  return parseUploadedFile(buffer, "Previous Month Data").rows;
}
