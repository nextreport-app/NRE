"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const CONNECT_ERROR_MESSAGES: Record<string, string> = {
  access_denied: "Google sign-in was cancelled — Drive was not connected.",
  invalid_state: "That connection attempt expired or was invalid. Please try again.",
  missing_code: "Google didn't return an authorization code. Please try again.",
  no_refresh_token: "Google didn't grant long-lived access. Please try connecting again.",
  connection_failed: "Something went wrong connecting to Google Drive. Please try again.",
};

export function GoogleDriveSettings({
  initialEnabled,
  initialFolderName,
  initialConnectedEmail,
  justConnected,
  connectError,
}: {
  initialEnabled: boolean;
  initialFolderName: string;
  initialConnectedEmail: string | null;
  /** True immediately after a successful OAuth round trip (query param on this exact page load, not client state) — a fresh page load, so no stale-props risk. */
  justConnected: boolean;
  /** Error code from a failed OAuth round trip, same one-time-query-param basis as justConnected. */
  connectError: string | null;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [folderName, setFolderName] = useState(initialFolderName);
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

  async function saveSettings(patch: { googleDriveEnabled?: boolean; googleDriveFolderName?: string }): Promise<boolean> {
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
          <div>
            <label className="mb-1 block text-sm text-ink-secondary">Google Drive folder name</label>
            <input
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              onBlur={handleFolderNameBlur}
              placeholder="NextReport Reports"
              maxLength={200}
              className="w-full max-w-sm rounded-md border border-navy-border bg-navy px-3 py-2 text-sm text-white outline-none focus:border-accent"
            />
            <p className="mt-1 text-xs text-ink-muted">
              Reports are saved as {folderName.trim() || "NextReport Reports"} → [Client Name] → [Report filename].
            </p>
          </div>

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
