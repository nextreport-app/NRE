"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { GoogleDriveMode } from "@/lib/google-drive";
import { GoogleDriveFolderPicker, type DriveFolder } from "./google-drive-folder-picker";

const CONNECT_ERROR_MESSAGES: Record<string, string> = {
  access_denied: "Google sign-in was cancelled — Drive was not connected.",
  invalid_state: "That connection attempt expired or was invalid. Please try again.",
  missing_code: "Google didn't return an authorization code. Please try again.",
  no_refresh_token: "Google didn't grant long-lived access. Please try connecting again.",
  connection_failed: "Something went wrong connecting to Google Drive. Please try again.",
};

interface AccountSettingsPatch {
  googleDriveEnabled?: boolean;
  googleDriveFolderName?: string;
  googleDriveMode?: GoogleDriveMode;
  googleDriveRootFolderId?: string | null;
  googleDriveRootFolderName?: string | null;
}

export function GoogleDriveSettings({
  initialEnabled,
  initialFolderName,
  initialMode,
  initialRootFolderId,
  initialRootFolderName,
  initialConnectedEmail,
  justConnected,
  connectError,
}: {
  initialEnabled: boolean;
  initialFolderName: string;
  initialMode: GoogleDriveMode;
  initialRootFolderId: string | null;
  initialRootFolderName: string | null;
  initialConnectedEmail: string | null;
  /** True immediately after a successful OAuth round trip (query param on this exact page load, not client state) — a fresh page load, so no stale-props risk. */
  justConnected: boolean;
  /** Error code from a failed OAuth round trip, same one-time-query-param basis as justConnected. */
  connectError: string | null;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [folderName, setFolderName] = useState(initialFolderName);
  const [mode, setMode] = useState<GoogleDriveMode>(initialMode);
  const [rootFolderId, setRootFolderId] = useState(initialRootFolderId);
  const [rootFolderName, setRootFolderName] = useState(initialRootFolderName);
  const [showRootFolderPicker, setShowRootFolderPicker] = useState(false);
  const [connectedEmail, setConnectedEmail] = useState(initialConnectedEmail);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  // Drop ?google_drive_connected=1 / ?google_drive_error=... from the URL
  // once shown, so a later manual refresh of this page doesn't re-show a
  // one-time connection result as if it just happened again.
  useEffect(() => {
    if (justConnected || connectError) {
      router.replace("/account", { scroll: false });
    }
    // Only ever needs to run once, right after this page loads with those params set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveSettings(patch: AccountSettingsPatch): Promise<boolean> {
    setSaving(true);
    setSaveError(null);
    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setSaveError(data.error || "Something went wrong saving Google Drive settings.");
      return false;
    }
    return true;
  }

  async function handleToggle(next: boolean) {
    setEnabled(next);
    const ok = await saveSettings({ googleDriveEnabled: next });
    if (!ok) setEnabled(!next);
  }

  async function handleFolderNameBlur() {
    const trimmed = folderName.trim();
    if (!trimmed) {
      setFolderName(initialFolderName);
      return;
    }
    if (trimmed === initialFolderName) return;
    await saveSettings({ googleDriveFolderName: trimmed });
  }

  async function handleModeChange(nextMode: GoogleDriveMode) {
    const prevMode = mode;
    setMode(nextMode);
    setShowRootFolderPicker(false);
    const ok = await saveSettings({ googleDriveMode: nextMode });
    if (!ok) setMode(prevMode);
  }

  async function handleRootFolderSelect(folder: DriveFolder) {
    setShowRootFolderPicker(false);
    setRootFolderId(folder.id);
    setRootFolderName(folder.name);
    await saveSettings({ googleDriveRootFolderId: folder.id, googleDriveRootFolderName: folder.name });
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    await fetch("/api/google-drive/disconnect", { method: "POST" }).catch(() => {});
    setDisconnecting(false);
    setConnectedEmail(null);
  }

  return (
    <div className="space-y-4 rounded-lg border border-navy-border bg-navy-panel p-5">
      <label className="flex items-center justify-between gap-3">
        <span className="text-sm text-white">Auto-save reports to Google Drive</span>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => handleToggle(e.target.checked)}
          className="h-4 w-4 accent-accent"
        />
      </label>
      <p className="text-xs text-ink-muted">
        When enabled, every report you generate is automatically saved to Google Drive as a Google Slides file
        (shared as &quot;anyone with the link can view&quot;) — the shareable link shows up right on the download
        screen alongside the PPTX download, no extra click needed.
      </p>

      {enabled && (
        <div className="space-y-4 border-t border-navy-border pt-4">
          {connectedEmail ? (
            <div className="rounded-md border border-emerald-800 bg-emerald-950/30 p-3">
              <p className="text-sm text-emerald-300">
                Connected: {connectedEmail} <span aria-hidden="true">✓</span>
              </p>
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="mt-2 rounded-md border border-navy-border px-3 py-1.5 text-xs text-ink-secondary hover:bg-navy-border disabled:opacity-50"
              >
                {disconnecting ? "Disconnecting…" : "Disconnect"}
              </button>
            </div>
          ) : (
            <div className="space-y-2 rounded-md border border-navy-border bg-navy p-3">
              <p className="text-xs text-ink-muted">
                You can connect any Google account — it does not have to be the same account you use to log into
                NextReport. A Google account picker will appear so you can select whichever Google Drive contains
                your client report folders.
              </p>
              <a
                href="/api/google-drive/connect"
                className="inline-block rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover"
              >
                Connect Google Drive
              </a>
            </div>
          )}

          {connectedEmail && (
            <div className="space-y-3 border-t border-navy-border pt-4">
              <h3 className="text-sm font-medium text-white">Drive Destination</h3>
              <p className="text-xs text-ink-muted">Where reports get saved in Google Drive.</p>

              <div className="space-y-3">
                <label className="flex cursor-pointer items-start gap-3 rounded-md border border-navy-border p-3 hover:bg-navy-border/40">
                  <input
                    type="radio"
                    name="googleDriveMode"
                    checked={mode === "auto"}
                    onChange={() => handleModeChange("auto")}
                    className="mt-0.5 h-4 w-4 accent-accent"
                  />
                  <div className="flex-1">
                    <span className="block text-sm text-white">Let NextReport create and manage folders automatically</span>
                    <span className="block text-xs text-ink-muted">
                      Creates the folder below at the root of your Drive, with one subfolder per client. Default for
                      new users.
                    </span>
                    {mode === "auto" && (
                      <div className="mt-2 max-w-sm">
                        <input
                          value={folderName}
                          onChange={(e) => setFolderName(e.target.value)}
                          onBlur={handleFolderNameBlur}
                          placeholder="NextReport Reports"
                          maxLength={200}
                          className="w-full rounded-md border border-navy-border bg-navy px-3 py-2 text-sm text-white outline-none focus:border-accent"
                        />
                        <p className="mt-1 text-xs text-ink-muted">
                          {folderName.trim() || "NextReport Reports"} → [Client Name] → [Report filename]
                        </p>
                      </div>
                    )}
                  </div>
                </label>

                <label className="flex cursor-pointer items-start gap-3 rounded-md border border-navy-border p-3 hover:bg-navy-border/40">
                  <input
                    type="radio"
                    name="googleDriveMode"
                    checked={mode === "root-folder"}
                    onChange={() => handleModeChange("root-folder")}
                    className="mt-0.5 h-4 w-4 accent-accent"
                  />
                  <div className="flex-1">
                    <span className="block text-sm text-white">Select an existing root folder</span>
                    <span className="block text-xs text-ink-muted">
                      NextReport creates a subfolder per client inside the folder you choose — e.g. &quot;Meta Ads
                      Department&quot;.
                    </span>
                    {mode === "root-folder" && (
                      <div className="mt-2 space-y-2">
                        {rootFolderId ? (
                          <p className="text-xs text-ink-secondary">
                            Selected: <span className="text-white">{rootFolderName}</span>
                          </p>
                        ) : (
                          <p className="text-xs text-amber-300">No folder selected yet.</p>
                        )}
                        {showRootFolderPicker ? (
                          <GoogleDriveFolderPicker
                            onSelect={handleRootFolderSelect}
                            onCancel={() => setShowRootFolderPicker(false)}
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => setShowRootFolderPicker(true)}
                            className="rounded-md border border-navy-border px-3 py-1.5 text-xs text-ink-secondary hover:bg-navy-border"
                          >
                            {rootFolderId ? "Change Folder" : "Choose Folder"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </label>

                {/* Not a selectable radio — this option's state lives per-client
                    (Client.googleDriveFolderId, set on each client's profile
                    page), not as an account-wide value, so there's nothing
                    here to persist or highlight as "selected." A per-client
                    override still applies no matter which real mode above is
                    chosen. */}
                <div className="rounded-md border border-navy-border p-3">
                  <span className="block text-sm text-white">Select an existing folder per client</span>
                  <span className="block text-xs text-ink-muted">
                    Set this individually on each client&apos;s profile page (Drive Folder field) — it overrides
                    whichever option is selected here, for that client only. Nothing to configure account-wide.
                  </span>
                </div>

                <label className="flex cursor-pointer items-start gap-3 rounded-md border border-navy-border p-3 hover:bg-navy-border/40">
                  <input
                    type="radio"
                    name="googleDriveMode"
                    checked={mode === "ask"}
                    onChange={() => handleModeChange("ask")}
                    className="mt-0.5 h-4 w-4 accent-accent"
                  />
                  <div className="flex-1">
                    <span className="block text-sm text-white">Always ask at report generation time</span>
                    <span className="block text-xs text-ink-muted">
                      Choose a folder for each report individually on the download screen. No default folder is
                      saved.
                    </span>
                  </div>
                </label>
              </div>
            </div>
          )}
        </div>
      )}

      {justConnected && !connectError && <p className="text-sm text-green-400">Google Drive connected.</p>}
      {connectError && (
        <p className="text-sm text-red-400">
          {CONNECT_ERROR_MESSAGES[connectError] ?? "Something went wrong connecting Google Drive. Please try again."}
        </p>
      )}
      {saveError && <p className="text-sm text-red-400">{saveError}</p>}
      {saving && <p className="text-xs text-ink-muted">Saving…</p>}
    </div>
  );
}
