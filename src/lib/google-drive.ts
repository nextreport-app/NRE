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

/**
 * Lists the immediate subfolders of `parentId` (Drive's root if omitted) —
 * the folder browser's one data source, both for account settings' "select
 * an existing root folder" (Option 2) and the client profile page's
 * per-client override (Option 3). Deliberately shallow (one level per
 * call): the browser UI fetches a fresh level only as the user navigates
 * into it, rather than walking the whole tree up front.
 */
export async function listDriveFolders(
  accessToken: string,
  parentId?: string,
): Promise<{ id: string; name: string }[]> {
  const parentClause = parentId && parentId !== "root" ? `'${escapeDriveQueryValue(parentId)}'` : "'root'";
  const q = `mimeType='${GOOGLE_DRIVE_FOLDER_MIME_TYPE}' and ${parentClause} in parents and trashed=false`;
  const url = `${GOOGLE_DRIVE_FILES_URL}?q=${encodeURIComponent(q)}&fields=files(id,name)&orderBy=name&spaces=drive&pageSize=1000`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    throw new Error(`Failed to list Google Drive folders (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { files: { id: string; name: string }[] };
  return data.files;
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
 * Uploads a report into an ALREADY-CHOSEN folder (no resolution logic) —
 * used by the "ask" Drive Destination mode's post-hoc save, once the user
 * has picked a folder on the download screen for this one report (see
 * /api/reports/[id]/save-to-drive), and reusable anywhere else a caller
 * already has a concrete folder id in hand.
 */
export async function saveReportToDriveFolder(params: {
  refreshToken: string;
  folderId: string;
  fileName: string;
  pptxBuffer: Buffer;
}): Promise<{ webViewLink: string }> {
  const accessToken = await getFreshGoogleAccessToken(params.refreshToken);
  return uploadAndShareInFolder(accessToken, params.pptxBuffer, params.fileName, params.folderId);
}

/** Account-level Drive Destination modes — see User.googleDriveMode's schema comment for what each one means. */
export type GoogleDriveMode = "auto" | "root-folder" | "ask";
const GOOGLE_DRIVE_MODES: readonly GoogleDriveMode[] = ["auto", "root-folder", "ask"];

/** User.googleDriveMode is a plain TEXT column (no DB-level enum/check constraint) — normalizes any unexpected stored value back to the "auto" default rather than letting it silently reach the resolution logic below untyped. */
export function normalizeDriveMode(value: string | null | undefined): GoogleDriveMode {
  return (GOOGLE_DRIVE_MODES as readonly string[]).includes(value ?? "") ? (value as GoogleDriveMode) : "auto";
}

export interface AutoSaveReportToDriveInput {
  /** null means Drive was never connected — always an error, even for "ask" mode (there's no account to browse folders in). */
  refreshToken: string | null;
  mode: GoogleDriveMode;
  /** User.googleDriveFolderName — the root folder name for "auto" mode. */
  autoRootFolderName: string;
  /** User.googleDriveRootFolderId — the user-picked root for "root-folder" mode; null if never picked. */
  rootFolderId: string | null;
  /** Client.googleDriveFolderId — Option 3's per-client override. Takes priority over `mode` entirely when set. */
  clientOverrideFolderId: string | null;
  clientName: string;
  fileName: string;
  pptxBuffer: Buffer;
}

export type AutoSaveResult =
  | { status: "success"; url: string }
  | { status: "error"; message: string }
  /** "ask" mode with no per-client override — no folder to resolve automatically; the wizard must show a folder picker and call saveReportToDriveFolder itself once the user chooses one. */
  | { status: "deferred" };

const NOT_CONNECTED_MESSAGE =
  "Google Drive auto-save is enabled, but no Google account is connected. Connect one in Account Settings.";

/**
 * Resolves this report's Drive destination and, unless it's deferred to the
 * user, uploads it there and shares it — the single entry point the report
 * generate route calls. Resolution order (see Client.googleDriveFolderId's
 * schema comment): a per-client override always wins; otherwise the
 * account's googleDriveMode decides between the "auto" (find/create a
 * managed root + client subfolder), "root-folder" (find/create just the
 * client subfolder, under an already-user-chosen root), and "ask" (defer)
 * behaviors.
 */
export async function autoSaveReportToDrive(input: AutoSaveReportToDriveInput): Promise<AutoSaveResult> {
  if (!input.refreshToken) {
    return { status: "error", message: NOT_CONNECTED_MESSAGE };
  }
  if (!input.clientOverrideFolderId && input.mode === "ask") {
    return { status: "deferred" };
  }

  try {
    const accessToken = await getFreshGoogleAccessToken(input.refreshToken);

    let folderId: string;
    if (input.clientOverrideFolderId) {
      folderId = input.clientOverrideFolderId;
    } else if (input.mode === "root-folder" && input.rootFolderId) {
      folderId = await findOrCreateDriveFolder(accessToken, input.clientName, input.rootFolderId);
    } else {
      const rootFolderId = await findOrCreateDriveFolder(accessToken, input.autoRootFolderName);
      folderId = await findOrCreateDriveFolder(accessToken, input.clientName, rootFolderId);
    }

    const { webViewLink } = await uploadAndShareInFolder(accessToken, input.pptxBuffer, input.fileName, folderId);
    return { status: "success", url: webViewLink };
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "Google Drive upload failed." };
  }
}
