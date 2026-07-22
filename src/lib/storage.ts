/**
 * File storage abstraction for generated report .pptx files.
 *
 * Dev/v1 implementation: local disk under STORAGE_DIR. The spec's tech
 * stack calls for Supabase Storage or S3 in production (local disk doesn't
 * persist across serverless invocations/deployments) — swap this module's
 * implementation when deploying, the call sites (report routes) don't need
 * to change since they only depend on this interface.
 */

import fs from "node:fs/promises";
import path from "node:path";

const STORAGE_DIR = process.env.STORAGE_DIR || "./storage";
const REPORTS_DIR = path.join(STORAGE_DIR, "reports");

export async function saveReportFile(reportId: string, buffer: Buffer): Promise<string> {
  await fs.mkdir(REPORTS_DIR, { recursive: true });
  const filePath = path.join(REPORTS_DIR, `${reportId}.pptx`);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

export async function readReportFile(filePath: string): Promise<Buffer> {
  return fs.readFile(filePath);
}
