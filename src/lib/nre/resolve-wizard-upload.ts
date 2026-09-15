/**
 * Shared MTD CSV resolution for wizard routes — file upload or cached session.
 */

import { fileFromFormData } from "@/lib/http-file";
import { detectPlatform, type Platform } from "./google-columns";
import { parseUploadedFileHeadersAndRows } from "./parse-file";
import { parseMtdCsvForAdPlatform } from "./tiktok-columns";
import { validateMtdDailyCsv } from "./validate";
import {
  hashUploadBuffer,
  loadWizardUploadSession,
  type WizardParsedMtd,
} from "./wizard-upload-session";
import { parseJsonFormField, platformSchema, uploadSessionIdSchema } from "@/lib/validators/report-wizard";

export interface WizardUploadContext {
  userId: string;
  clientId: string;
}

export interface ResolvedWizardMtd {
  parsed: WizardParsedMtd;
  uploadSessionId?: string;
  fromCache: boolean;
  /** Present when the request included a fresh file upload (analyze save path). */
  fileHash?: string;
}

type ResolveFailure = {
  ok: false;
  status: number;
  body: Record<string, unknown>;
};

type ResolveSuccess = { ok: true; data: ResolvedWizardMtd };

export async function resolveWizardMtdFromFormData(
  formData: FormData | null,
  ctx: WizardUploadContext,
): Promise<ResolveSuccess | ResolveFailure> {
  if (!formData) {
    return {
      ok: false,
      status: 400,
      body: { error: "Request body is required." },
    };
  }

  const uploadSessionId = parseJsonFormField(formData, "uploadSessionId", uploadSessionIdSchema);
  if (uploadSessionId) {
    const session = await loadWizardUploadSession(ctx.userId, ctx.clientId, uploadSessionId);
    if (!session) {
      return {
        ok: false,
        status: 400,
        body: {
          error: "Upload session expired or not found. Please re-analyze your file.",
          uploadSessionExpired: true,
        },
      };
    }
    return {
      ok: true,
      data: {
        parsed: {
          colMap: session.colMap,
          rows: session.rows,
          headers: session.headers,
          platform: session.platform,
        },
        uploadSessionId,
        fromCache: true,
      },
    };
  }

  const mtdDailyBuffer = await fileFromFormData(formData, "mtdDailyCsv");
  if (!mtdDailyBuffer || mtdDailyBuffer.length === 0) {
    return {
      ok: false,
      status: 400,
      body: { error: "MTD Daily CSV or uploadSessionId is required." },
    };
  }

  const { headers } = parseUploadedFileHeadersAndRows(mtdDailyBuffer, "MTD Daily CSV");
  const platformOverride = parseJsonFormField(formData, "platform", platformSchema);
  const platform: Platform = platformOverride ?? detectPlatform(headers);
  const mtdParsed = parseMtdCsvForAdPlatform(mtdDailyBuffer, platform);
  const validation = validateMtdDailyCsv(mtdParsed.colMap, mtdParsed.rows, undefined, mtdParsed.headers, platform);
  if (!validation.valid) {
    return {
      ok: false,
      status: 200,
      body: {
        valid: false,
        errors: validation.errors,
        warnings: validation.warnings,
        noCampaignData: validation.noCampaignData,
      },
    };
  }

  return {
    ok: true,
    data: {
      parsed: {
        colMap: mtdParsed.colMap,
        rows: mtdParsed.rows,
        headers: mtdParsed.headers,
        platform,
      },
      fromCache: false,
      fileHash: hashUploadBuffer(mtdDailyBuffer),
    },
  };
}

/** Analyze-only — always parses the uploaded file and returns buffer hash for session save. */
export async function parseWizardMtdUpload(
  formData: FormData,
  platform: Platform,
  buffer: Buffer,
): Promise<WizardParsedMtd> {
  const mtdParsed = parseMtdCsvForAdPlatform(buffer, platform);
  return {
    colMap: mtdParsed.colMap,
    rows: mtdParsed.rows,
    headers: mtdParsed.headers,
    platform,
  };
}
