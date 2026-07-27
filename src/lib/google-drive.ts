/**
 * Minimal Google Drive REST client — no `googleapis` dependency, just the
 * OAuth code exchange + token refresh + folder lookup/create + multipart
 * upload + sharing calls this app's two Drive features need, over plain
 * fetch:
 *  - The manual "Get Google Slides Link" button (report-upload-wizard.tsx),
 *    using the Google account NextAuth's own sign-in already linked.
 *  - Account settings' Google Drive auto-save, using a SEPARATE, dedicated
 *    OAuth connection (see /api/google-drive/connect + /callback) — a
 *    deliberately different Google account is allowed here, so its tokens
 *    live on User.google* columns, not NextAuth's Account table.
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
const GOOGLE_DRIVE_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";

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
 * step needed. `parentId` places it inside a folder instead of Drive's root
 * (used by the auto-save feature's [Root] -> [Client] folder structure; the
 * manual "Get Google Slides Link" button omits it and uploads to root,
 * unchanged from before this feature existed).
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

// Drive's query language treats \ and ' as needing escaping inside a
// quoted string literal (e.g. a client named "O'Brien Roofing") — otherwise
// a literal apostrophe in a folder name would break the `name='...'` clause.
function escapeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/**
 * Finds a folder by exact name under `parentId` (Drive's root if omitted),
 * creating it if it doesn't exist yet — the auto-save feature's
 * [Root folder] -> [Client Name] structure needs this at both levels, and
 * re-running it on every report generation must not create duplicate
 * folders for the same client each week.
 */
export async function findOrCreateDriveFolder(
  accessToken: string,
  name: string,
  parentId?: string,
): Promise<string> {
  const parentClause = parentId ? `'${escapeDriveQueryValue(parentId)}'` : "'root'";
  const q = `mimeType='${GOOGLE_DRIVE_FOLDER_MIME_TYPE}' and name='${escapeDriveQueryValue(name)}' and ${parentClause} in parents and trashed=false`;
  const searchUrl = `${GOOGLE_DRIVE_FILES_URL}?q=${encodeURIComponent(q)}&fields=files(id)&spaces=drive`;

  const searchRes = await fetch(searchUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!searchRes.ok) {
    throw new Error(`Failed to search Google Drive for a folder (${searchRes.status}): ${await searchRes.text()}`);
  }
  const searchData = (await searchRes.json()) as { files: { id: string }[] };
  if (searchData.files.length > 0) return searchData.files[0].id;

  const createRes = await fetch(`${GOOGLE_DRIVE_FILES_URL}?fields=id`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      mimeType: GOOGLE_DRIVE_FOLDER_MIME_TYPE,
      parents: parentId ? [parentId] : undefined,
    }),
  });
  if (!createRes.ok) {
    throw new Error(`Failed to create a Google Drive folder (${createRes.status}): ${await createRes.text()}`);
  }
  const createData = (await createRes.json()) as { id: string };
  return createData.id;
}

export interface AutoSaveReportToDriveInput {
  refreshToken: string;
  rootFolderName: string;
  clientName: string;
  fileName: string;
  pptxBuffer: Buffer;
}

/**
 * The full auto-save pipeline: mint a fresh access token, find-or-create
 * the [Root folder] -> [Client Name] structure, upload the .pptx converted
 * to Google Slides inside it, then share it publicly. One call for
 * report-generation to invoke — see the report generate route.
 */
export async function autoSaveReportToDrive(
  input: AutoSaveReportToDriveInput,
): Promise<{ webViewLink: string }> {
  const accessToken = await getFreshGoogleAccessToken(input.refreshToken);
  const rootFolderId = await findOrCreateDriveFolder(accessToken, input.rootFolderName);
  const clientFolderId = await findOrCreateDriveFolder(accessToken, input.clientName, rootFolderId);
  const { id: fileId, webViewLink } = await uploadPptxAsGoogleSlides(
    accessToken,
    input.pptxBuffer,
    input.fileName,
    clientFolderId,
  );
  await shareFilePublicly(accessToken, fileId);
  return { webViewLink: webViewLink || `https://docs.google.com/presentation/d/${fileId}/edit` };
}
