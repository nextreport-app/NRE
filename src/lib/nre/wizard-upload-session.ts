/**
 * Parsed CSV cache for the report upload wizard — avoids re-parsing the same
 * file on metrics, preview (N×), and generate after analyze succeeds.
 */

import { createHash, randomUUID } from "node:crypto";
import type { Platform } from "./google-columns";
import type { ColumnMap, NreRow } from "./columns";
import {
  deleteWizardUploadSessionBlob,
  readWizardUploadSessionBlob,
  saveWizardUploadSessionBlob,
} from "@/lib/storage";

export const WIZARD_UPLOAD_SESSION_VERSION = 1 as const;
export const WIZARD_UPLOAD_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export interface WizardUploadSessionPayload {
  version: typeof WIZARD_UPLOAD_SESSION_VERSION;
  userId: string;
  clientId: string;
  platform: Platform;
  colMap: ColumnMap;
  rows: NreRow[];
  headers: string[];
  fileHash: string;
  createdAt: string;
  expiresAt: string;
}

export interface WizardParsedMtd {
  colMap: ColumnMap;
  rows: NreRow[];
  headers: string[];
  platform: Platform;
}

export function hashUploadBuffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export function isWizardUploadSessionExpired(payload: WizardUploadSessionPayload, now = Date.now()): boolean {
  const expires = Date.parse(payload.expiresAt);
  return !Number.isFinite(expires) || expires <= now;
}

export function assertWizardUploadSessionOwnership(
  payload: WizardUploadSessionPayload,
  userId: string,
  clientId: string,
): void {
  if (payload.userId !== userId || payload.clientId !== clientId) {
    throw new Error("Upload session does not belong to this client.");
  }
  if (payload.version !== WIZARD_UPLOAD_SESSION_VERSION) {
    throw new Error("Unsupported upload session version.");
  }
}

export async function saveWizardUploadSession(input: {
  userId: string;
  clientId: string;
  platform: Platform;
  colMap: ColumnMap;
  rows: NreRow[];
  headers: string[];
  fileHash: string;
}): Promise<string> {
  const sessionId = randomUUID();
  const now = Date.now();
  const payload: WizardUploadSessionPayload = {
    version: WIZARD_UPLOAD_SESSION_VERSION,
    userId: input.userId,
    clientId: input.clientId,
    platform: input.platform,
    colMap: input.colMap,
    rows: input.rows,
    headers: input.headers,
    fileHash: input.fileHash,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + WIZARD_UPLOAD_SESSION_TTL_MS).toISOString(),
  };
  await saveWizardUploadSessionBlob(input.userId, input.clientId, sessionId, JSON.stringify(payload));
  return sessionId;
}

export async function loadWizardUploadSession(
  userId: string,
  clientId: string,
  sessionId: string,
): Promise<WizardUploadSessionPayload | null> {
  const raw = await readWizardUploadSessionBlob(userId, clientId, sessionId);
  if (!raw) return null;
  let payload: WizardUploadSessionPayload;
  try {
    payload = JSON.parse(raw) as WizardUploadSessionPayload;
  } catch {
    return null;
  }
  assertWizardUploadSessionOwnership(payload, userId, clientId);
  if (isWizardUploadSessionExpired(payload)) {
    await deleteWizardUploadSessionBlob(userId, clientId, sessionId).catch(() => {});
    return null;
  }
  return payload;
}

export async function deleteWizardUploadSession(userId: string, clientId: string, sessionId: string): Promise<void> {
  await deleteWizardUploadSessionBlob(userId, clientId, sessionId);
}
