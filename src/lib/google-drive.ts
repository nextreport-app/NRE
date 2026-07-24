/**
 * Minimal Google Drive REST client for the "Get Google Slides Link" feature —
 * no `googleapis` dependency, just the token refresh + multipart upload +
 * sharing calls this one feature needs, over plain fetch.
 */

import { randomUUID } from "node:crypto";

export const GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";
const GOOGLE_DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";
const PPTX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const GOOGLE_SLIDES_MIME_TYPE = "application/vnd.google-apps.presentation";

/** Exchanges a stored refresh_token for a short-lived access_token. */
export async function getFreshGoogleAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.AUTH_GOOGLE_ID ?? "",
      client_secret: process.env.AUTH_GOOGLE_SECRET ?? "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to refresh Google access token (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

function buildMultipartBody(metadata: object, fileBuffer: Buffer, boundary: string): Buffer {
  const metadataPart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`;
  const mediaHeader = `--${boundary}\r\nContent-Type: ${PPTX_MIME_TYPE}\r\n\r\n`;
  const closing = `\r\n--${boundary}--`;
  return Buffer.concat([
    Buffer.from(metadataPart, "utf-8"),
    Buffer.from(mediaHeader, "utf-8"),
    fileBuffer,
    Buffer.from(closing, "utf-8"),
  ]);
}

/**
 * Uploads a .pptx buffer to Drive with mimeType set to the Google Slides
 * type — Drive converts it automatically on upload, no separate conversion
 * step needed.
 */
export async function uploadPptxAsGoogleSlides(
  accessToken: string,
  pptxBuffer: Buffer,
  fileName: string,
): Promise<{ id: string; webViewLink: string }> {
  const boundary = `nre-${randomUUID()}`;
  const body = buildMultipartBody({ name: fileName, mimeType: GOOGLE_SLIDES_MIME_TYPE }, pptxBuffer, boundary);

  const res = await fetch(`${GOOGLE_DRIVE_UPLOAD_URL}?uploadType=multipart&fields=id,webViewLink`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body: new Uint8Array(body),
  });
  if (!res.ok) {
    throw new Error(`Failed to upload file to Google Drive (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

/** Sets the file to "Anyone with the link can view". */
export async function shareFilePublicly(accessToken: string, fileId: string): Promise<void> {
  const res = await fetch(`${GOOGLE_DRIVE_FILES_URL}/${fileId}/permissions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ role: "reader", type: "anyone" }),
  });
  if (!res.ok) {
    throw new Error(`Failed to set Drive sharing permissions (${res.status}): ${await res.text()}`);
  }
}
