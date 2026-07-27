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

/**
 * The entire Google Drive account settings section: connect, or connected +
 * disconnect. No folder configuration lives here at all — where a report
 * gets saved is chosen per report, on the download screen's "Save to Google
 * Drive" button (see report-upload-wizard.tsx).
 */
export function GoogleDriveSettings({
  initialConnectedEmail,
  justConnected,
  connectError,
}: {
  initialConnectedEmail: string | null;
  /** True immediately after a successful OAuth round trip (query param on this exact page load, not client state) — a fresh page load, so no stale-props risk. */
  justConnected: boolean;
  /** Error code from a failed OAuth round trip, same one-time-query-param basis as justConnected. */
  connectError: string | null;
}) {
  const router = useRouter();
  const [connectedEmail, setConnectedEmail] = useState(initialConnectedEmail);
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

  async function handleDisconnect() {
    setDisconnecting(true);
    await fetch("/api/google-drive/disconnect", { method: "POST" }).catch(() => {});
    setDisconnecting(false);
    setConnectedEmail(null);
  }

  return (
    <div className="space-y-4 rounded-lg border border-navy-border bg-navy-panel p-5">
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
            NextReport. A Google account picker will appear so you can select whichever Google Drive you want your
            reports saved to.
          </p>
          <a
            href="/api/google-drive/connect"
            className="inline-block rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover"
          >
            Connect Google Drive
          </a>
        </div>
      )}

      {justConnected && !connectError && <p className="text-sm text-green-400">Google Drive connected.</p>}
      {connectError && (
        <p className="text-sm text-red-400">
          {CONNECT_ERROR_MESSAGES[connectError] ?? "Something went wrong connecting Google Drive. Please try again."}
        </p>
      )}
    </div>
  );
}
