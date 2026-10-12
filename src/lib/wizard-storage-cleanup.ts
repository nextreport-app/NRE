/**
 * Best-effort cleanup of ephemeral wizard blobs in Vercel Blob storage.
 * Upload sessions (parsed CSV cache) and in-progress drafts are TTL-bound
 * but were only deleted on success paths — this reclaims orphans via daily cron.
 */

import { del, list } from "@vercel/blob";
import { WIZARD_SERVER_DRAFT_TTL_MS } from "@/lib/nre/wizard-draft";
import { WIZARD_UPLOAD_SESSION_TTL_MS } from "@/lib/nre/wizard-upload-session";

const UPLOAD_SESSION_PREFIX = "wizard-upload-sessions/";
const DRAFT_PREFIX = "wizard-drafts/";

const DEFAULT_MAX_DELETIONS = 250;

async function purgePrefixOlderThan(
  prefix: string,
  cutoff: Date,
  maxDeletions: number,
  deletedSoFar: number,
): Promise<number> {
  let removed = 0;
  let cursor: string | undefined;

  while (deletedSoFar + removed < maxDeletions) {
    const page = await list({ prefix, limit: 100, cursor });
    for (const blob of page.blobs) {
      if (deletedSoFar + removed >= maxDeletions) break;
      const uploadedAt = blob.uploadedAt instanceof Date ? blob.uploadedAt : new Date(blob.uploadedAt);
      if (uploadedAt >= cutoff) continue;
      await del(blob.url).catch(() => undefined);
      removed += 1;
    }
    if (!page.hasMore || deletedSoFar + removed >= maxDeletions) break;
    cursor = page.cursor;
  }

  return removed;
}

/** Delete wizard upload-session and draft blobs past their TTL (by blob age). */
export async function purgeStaleWizardBlobs(
  now = Date.now(),
  maxDeletions = DEFAULT_MAX_DELETIONS,
): Promise<{ uploadSessions: number; drafts: number }> {
  const uploadCutoff = new Date(now - WIZARD_UPLOAD_SESSION_TTL_MS);
  const draftCutoff = new Date(now - WIZARD_SERVER_DRAFT_TTL_MS);

  const uploadSessions = await purgePrefixOlderThan(
    UPLOAD_SESSION_PREFIX,
    uploadCutoff,
    maxDeletions,
    0,
  );
  const drafts = await purgePrefixOlderThan(
    DRAFT_PREFIX,
    draftCutoff,
    maxDeletions,
    uploadSessions,
  );

  return { uploadSessions, drafts };
}
