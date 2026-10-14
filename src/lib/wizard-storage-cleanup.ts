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

/** Per cron run — chew through dev/test backlog without one giant request. */
const DEFAULT_MAX_DELETIONS = 800;
const DELETE_BATCH_SIZE = 50;

async function purgePrefixOlderThan(
  prefix: string,
  cutoff: Date,
  maxDeletions: number,
  deletedSoFar: number,
): Promise<number> {
  let removed = 0;
  let cursor: string | undefined;
  let pendingUrls: string[] = [];

  async function flushBatch() {
    if (pendingUrls.length === 0) return;
    const batch = pendingUrls.splice(0, DELETE_BATCH_SIZE);
    await del(batch).catch(() => undefined);
  }

  while (deletedSoFar + removed < maxDeletions) {
    const page = await list({ prefix, limit: 100, cursor });
    for (const blob of page.blobs) {
      if (deletedSoFar + removed >= maxDeletions) break;
      const uploadedAt = blob.uploadedAt instanceof Date ? blob.uploadedAt : new Date(blob.uploadedAt);
      if (uploadedAt >= cutoff) continue;
      pendingUrls.push(blob.url);
      removed += 1;
      if (pendingUrls.length >= DELETE_BATCH_SIZE) {
        await flushBatch();
      }
    }
    if (!page.hasMore || deletedSoFar + removed >= maxDeletions) break;
    cursor = page.cursor;
  }

  await flushBatch();
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

/**
 * Pre-launch / maintenance: delete ephemeral wizard blobs regardless of TTL.
 * Does not touch reports/, logos/, previous-month-data/, or support-tickets/.
 */
export async function purgeAllEphemeralWizardBlobs(
  maxDeletions = 5000,
): Promise<{ uploadSessions: number; drafts: number }> {
  const cutoff = new Date();
  const uploadSessions = await purgePrefixOlderThan(UPLOAD_SESSION_PREFIX, cutoff, maxDeletions, 0);
  const drafts = await purgePrefixOlderThan(DRAFT_PREFIX, cutoff, maxDeletions, uploadSessions);
  return { uploadSessions, drafts };
}
