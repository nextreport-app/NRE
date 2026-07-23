/**
 * File storage abstraction for generated report .pptx files.
 *
 * Always uses Vercel Blob — no local-disk fallback. Vercel's serverless
 * functions have an ephemeral, per-invocation filesystem: there is no
 * writable directory that survives from the "generate" request to a later
 * "download" request. Requires BLOB_READ_WRITE_TOKEN — set this locally too
 * (e.g. `vercel env pull .env` after connecting Blob storage to the project)
 * if running report generation outside Vercel.
 *
 * Stored with `access: 'private'` (this project's Blob store is configured
 * private-only — `access: 'public'` is rejected outright). Reads go through
 * the SDK's `get()`, which authenticates with BLOB_READ_WRITE_TOKEN
 * server-side and returns the content directly — no signed/presigned URL is
 * generated or handed to the browser at any point. That's a deliberately
 * tighter fit than presigned URLs here: the download route
 * (/api/reports/[id]/download) is already the sole authenticated entry
 * point and streams the file itself, so there's no untrusted client that
 * would ever need a presigned URL to fetch directly from Blob's CDN.
 */

import { put, del, get } from "@vercel/blob";

export async function saveReportFile(reportId: string, buffer: Buffer): Promise<string> {
  const blob = await put(`reports/${reportId}.pptx`, buffer, {
    access: "private",
    addRandomSuffix: false,
    contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  });
  return blob.url;
}

export async function readReportFile(url: string): Promise<Buffer> {
  const result = await get(url, { access: "private" });
  if (!result || result.statusCode !== 200) {
    throw new Error("Report file not found in storage.");
  }
  return Buffer.from(await new Response(result.stream).arrayBuffer());
}

export async function deleteReportFile(url: string): Promise<void> {
  await del(url).catch(() => {});
}
