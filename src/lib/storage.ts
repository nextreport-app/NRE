/**
 * File storage abstraction for generated report .pptx files.
 *
 * Production (Vercel): uses Vercel Blob when BLOB_READ_WRITE_TOKEN is set
 * (auto-injected once Blob storage is enabled on the Vercel project — see
 * Storage tab → Create Database → Blob). Vercel's serverless functions have
 * an ephemeral, per-invocation filesystem, so local disk cannot be used to
 * hand a file from the "generate" request to a later "download" request.
 *
 * Local dev: falls back to local disk under STORAGE_DIR when no Blob token
 * is configured, so `npm run dev` works without any Blob setup.
 *
 * Blob objects are stored with public access (Vercel Blob's only access
 * mode) but their URL is never exposed to the browser — the download route
 * stays the sole authenticated entry point and fetches+streams server-side,
 * so reaching a report still requires being logged in as its owner.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { put, del } from "@vercel/blob";

const STORAGE_DIR = process.env.STORAGE_DIR || "./storage";
const REPORTS_DIR = path.join(STORAGE_DIR, "reports");
const USE_BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;

export async function saveReportFile(reportId: string, buffer: Buffer): Promise<string> {
  if (USE_BLOB) {
    const blob = await put(`reports/${reportId}.pptx`, buffer, {
      access: "public",
      addRandomSuffix: false,
      contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    });
    return blob.url;
  }

  await fs.mkdir(REPORTS_DIR, { recursive: true });
  const filePath = path.join(REPORTS_DIR, `${reportId}.pptx`);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

export async function readReportFile(filePathOrUrl: string): Promise<Buffer> {
  if (/^https?:\/\//.test(filePathOrUrl)) {
    const res = await fetch(filePathOrUrl);
    if (!res.ok) throw new Error(`Failed to fetch stored report (${res.status})`);
    return Buffer.from(await res.arrayBuffer());
  }
  return fs.readFile(filePathOrUrl);
}

export async function deleteReportFile(filePathOrUrl: string): Promise<void> {
  if (/^https?:\/\//.test(filePathOrUrl)) {
    await del(filePathOrUrl).catch(() => {});
    return;
  }
  await fs.unlink(filePathOrUrl).catch(() => {});
}
