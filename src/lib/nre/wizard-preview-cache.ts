/**
 * Preview-built report + optional pre-warmed AI copy — reused on generate to
 * skip duplicate buildReportData / generateInsights when config unchanged.
 */

import type { AiCopy } from "@/lib/pptx/fill-tags";
import type { ReportData } from "./report-data";
import type { WizardUploadSessionPayload } from "./wizard-upload-session";
import {
  deleteWizardUploadSessionBlob,
  readWizardUploadSessionBlob,
  saveWizardUploadSessionBlob,
} from "@/lib/storage";
import { assertWizardUploadSessionOwnership, isWizardUploadSessionExpired } from "./wizard-upload-session";
import { aiKeysFromEnv } from "@/lib/ai/client";
import { generateInsights } from "@/lib/ai/generate-insights";

export interface WizardPreviewCache {
  fingerprint: string;
  reportData: ReportData;
  /** Serialized Map entries when AI warm finished. */
  aiCopy?: Record<string, AiCopy>;
  aiWarmStartedAt?: string;
  aiWarmCompletedAt?: string;
}

export type WizardUploadSessionWithPreview = WizardUploadSessionPayload & {
  previewCache?: WizardPreviewCache;
};

async function readSessionPayload(
  userId: string,
  clientId: string,
  sessionId: string,
): Promise<WizardUploadSessionWithPreview | null> {
  const raw = await readWizardUploadSessionBlob(userId, clientId, sessionId);
  if (!raw) return null;
  try {
    const payload = JSON.parse(raw) as WizardUploadSessionWithPreview;
    assertWizardUploadSessionOwnership(payload, userId, clientId);
    if (isWizardUploadSessionExpired(payload)) {
      await deleteWizardUploadSessionBlob(userId, clientId, sessionId).catch(() => {});
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

async function writeSessionPayload(
  userId: string,
  clientId: string,
  sessionId: string,
  payload: WizardUploadSessionWithPreview,
): Promise<void> {
  await saveWizardUploadSessionBlob(userId, clientId, sessionId, JSON.stringify(payload));
}

export async function saveWizardPreviewReportCache(input: {
  userId: string;
  clientId: string;
  sessionId: string;
  fingerprint: string;
  reportData: ReportData;
}): Promise<void> {
  const payload = await readSessionPayload(input.userId, input.clientId, input.sessionId);
  if (!payload) return;
  payload.previewCache = {
    fingerprint: input.fingerprint,
    reportData: input.reportData,
    aiWarmStartedAt: new Date().toISOString(),
  };
  await writeSessionPayload(input.userId, input.clientId, input.sessionId, payload);
}

export async function loadWizardPreviewReportCache(
  userId: string,
  clientId: string,
  sessionId: string,
  fingerprint: string,
): Promise<{ reportData: ReportData; aiCopy?: Record<string, AiCopy> } | null> {
  const payload = await readSessionPayload(userId, clientId, sessionId);
  const cache = payload?.previewCache;
  if (!cache || cache.fingerprint !== fingerprint) return null;
  return { reportData: cache.reportData, aiCopy: cache.aiCopy };
}

/** Fire-and-forget after preview — fills aiCopy on the upload session when done. */
export function scheduleWizardPreviewAiWarm(input: {
  userId: string;
  clientId: string;
  sessionId: string;
  fingerprint: string;
  reportData: ReportData;
}): void {
  void (async () => {
    const keys = aiKeysFromEnv();
    if (!keys.apiKey) return;

    const copyMap = await generateInsights(input.reportData, keys);
    const payload = await readSessionPayload(input.userId, input.clientId, input.sessionId);
    const cache = payload?.previewCache;
    if (!cache || cache.fingerprint !== input.fingerprint) return;

    cache.aiCopy = Object.fromEntries(copyMap.entries());
    cache.aiWarmCompletedAt = new Date().toISOString();
    await writeSessionPayload(input.userId, input.clientId, input.sessionId, payload);
  })().catch((err) => {
    console.error("[wizard-preview-cache] AI warm failed:", err);
  });
}
