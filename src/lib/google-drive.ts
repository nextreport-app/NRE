/**
 * Minimal Google Drive REST client — no `googleapis` dependency, just the
 * OAuth code exchange + token refresh + multipart upload + sharing calls
 * this app's one Drive feature needs, over plain fetch: the download
 * screen's "Save to Google Drive" button (report-upload-wizard.tsx), which
 * uploads the just-generated report into a folder the user pastes a Drive
 * link for, converts it to Google Slides, and shares it. It uses a
 * SEPARATE, dedicated OAuth connection (see /api/google-drive/connect +
 * /callback) — a deliberately different Google account than the one used to
 * log into NextReport is allowed here, so its tokens live on User.google*
 * columns, not NextAuth's own Account table.
 *
 * Deliberately drive.file only, not drive.readonly or the broad "drive"
 * scope: the user pastes the destination folder's link themselves (see
 * extractDriveFolderIdFromLink in lib/drive-link.ts), so this app never
 * needs to LIST or BROWSE the user's existing Drive contents — only create
 * a new file with that folder as its parent, which drive.file permits for
 * any folder the authenticated user has edit access to, not just folders
 * this app created itself.
 */

import { randomUUID } from "node:crypto";

export const GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
export const GOOGLE_DRIVE_CONNECT_SCOPES = `openid email ${GOOGLE_DRIVE_SCOPE}`;
// CSRF-protection cookie shared between /api/google-drive/connect (sets it)
// and /api/google-drive/callback (verifies it) — lives here rather than
// being imported from one route file into the other.
export const GOOGLE_DRIVE_OAUTH_STATE_COOKIE = "google_drive_oauth_state";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
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

/**
 * Builds the URL that starts the Google Drive "connect" flow (account
 * settings) — a hand-rolled OAuth 2.0 authorization-code redirect, entirely
 * separate from NextAuth's own Google sign-in provider (see this file's
 * header). `access_type=offline` + `prompt=consent select_account` together
 * guarantee both a refresh_token AND the Google account picker on every
 * connect, even for a Google account that has consented before — critical
 * here since a user might reconnect the same or a different account later
 * to switch which Drive gets used.
 */
export function buildGoogleDriveConnectUrl(redirectUri: string, state: string): string {
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", process.env.AUTH_GOOGLE_ID ?? "");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_DRIVE_CONNECT_SCOPES);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent select_account");
  url.searchParams.set("state", state);
  return url.toString();
}

export interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

/** Exchanges the connect flow's authorization code for tokens — the one-time step right after the user approves on Google's consent screen. */
export async function exchangeGoogleAuthCode(code: string, redirectUri: string): Promise<GoogleTokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.AUTH_GOOGLE_ID ?? "",
      client_secret: process.env.AUTH_GOOGLE_SECRET ?? "",
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to exchange Google authorization code (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

/** The connected Google account's own email — shown back to the user so they can confirm they picked the Drive account they meant to (see User.googleConnectedEmail's schema comment). */
export async function fetchGoogleAccountEmail(accessToken: string): Promise<string | null> {
  const res = await fetch(GOOGLE_USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return null;
  const data = (await res.json()) as { email?: string };
  return data.email ?? null;
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
 * step needed. `parentId` places it inside the folder the user pasted a
 * link for (see saveReportToDriveFolder) instead of Drive's root.
 * `supportsAllDrives` is always sent — harmless for a normal My Drive
 * folder, but required by the Drive API to create a file inside a folder
 * that lives in a Shared Drive, which a pasted link can still point to.
 */
export async function uploadPptxAsGoogleSlides(
  accessToken: string,
  pptxBuffer: Buffer,
  fileName: string,
  parentId?: string,
): Promise<{ id: string; webViewLink: string }> {
  const boundary = `nre-${randomUUID()}`;
  const metadata: { name: string; mimeType: string; parents?: string[] } = {
    name: fileName,
    mimeType: GOOGLE_SLIDES_MIME_TYPE,
  };
  if (parentId) metadata.parents = [parentId];
  const body = buildMultipartBody(metadata, pptxBuffer, boundary);

  const res = await fetch(
    `${GOOGLE_DRIVE_UPLOAD_URL}?uploadType=multipart&fields=id,webViewLink&supportsAllDrives=true`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: new Uint8Array(body),
    },
  );
  if (!res.ok) {
    throw new Error(`Failed to upload file to Google Drive (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

/** Sets the file to "Anyone with the link can view". `supportsAllDrives` — see uploadPptxAsGoogleSlides. */
export async function shareFilePublicly(accessToken: string, fileId: string): Promise<void> {
  const res = await fetch(`${GOOGLE_DRIVE_FILES_URL}/${fileId}/permissions?supportsAllDrives=true`, {
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

/**
 * Best-effort display name for a pasted folder id — purely cosmetic (used
 * for the "Saving to: [name]" line), so failures here are swallowed rather
 * than thrown. Under drive.file scope, a `files.get` on a folder the app
 * never created often 404s even when the folder is perfectly writable
 * (create-with-parent is allowed for any folder the user can edit; reading
 * metadata for a folder the app never touched is more restricted) — when
 * that happens, the caller falls back to showing the raw folder id instead.
 */
export async function getDriveFolderName(accessToken: string, folderId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${GOOGLE_DRIVE_FILES_URL}/${encodeURIComponent(folderId)}?fields=name&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { name?: string };
    return data.name ?? null;
  } catch {
    return null;
  }
}

async function uploadAndShareInFolder(
  accessToken: string,
  pptxBuffer: Buffer,
  fileName: string,
  folderId: string,
): Promise<{ webViewLink: string }> {
  const { id: fileId, webViewLink } = await uploadPptxAsGoogleSlides(accessToken, pptxBuffer, fileName, folderId);
  await shareFilePublicly(accessToken, fileId);
  return { webViewLink: webViewLink || `https://docs.google.com/presentation/d/${fileId}/edit` };
}

/**
 * Uploads a report into a folder the user identified by pasting a Drive
 * link (see /api/reports/[id]/save-to-drive) — no folder resolution logic,
 * `folderId` is already the extracted id. `folderName` is a best-effort
 * display label (see getDriveFolderName) — null when it couldn't be
 * resolved, in which case the caller shows the folder id itself instead.
 * A genuinely bad/inaccessible folderId surfaces here as a thrown error
 * from the upload call, not from the (non-throwing) name lookup.
 */
export async function saveReportToDriveFolder(params: {
  refreshToken: string;
  folderId: string;
  fileName: string;
  pptxBuffer: Buffer;
}): Promise<{ webViewLink: string; folderName: string | null }> {
  const accessToken = await getFreshGoogleAccessToken(params.refreshToken);
  const [uploadResult, folderName] = await Promise.all([
    uploadAndShareInFolder(accessToken, params.pptxBuffer, params.fileName, params.folderId),
    getDriveFolderName(accessToken, params.folderId),
  ]);
  return { webViewLink: uploadResult.webViewLink, folderName };
}
