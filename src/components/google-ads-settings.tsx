"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const CONNECT_ERROR_MESSAGES: Record<string, string> = {
  access_denied: "Google authorisation was cancelled — your Google Ads account was not connected.",
  invalid_state: "That connection attempt expired or was invalid. Please try again.",
  missing_code: "Google did not return an authorisation code. Please try again.",
  connection_failed: "Something went wrong connecting to Google Ads. Please try again.",
  not_configured: "Google Ads API credentials are not configured on this server yet.",
  no_refresh_token: "Google did not return a refresh token. Try again and choose Allow on the consent screen.",
};

interface CustomerRow {
  id: string;
  resourceName: string;
}

/**
 * Account settings — Connect Google Ads (read-only adwords scope).
 * Reviewers can verify API access via ListAccessibleCustomers.
 */
export function GoogleAdsSettings({
  initialConnectedEmail,
  justConnected,
  connectError,
  googleAdsConfigured,
}: {
  initialConnectedEmail: string | null;
  justConnected: boolean;
  connectError: string | null;
  googleAdsConfigured: boolean;
}) {
  const router = useRouter();
  const [connectedEmail, setConnectedEmail] = useState(initialConnectedEmail);
  const [disconnecting, setDisconnecting] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [customers, setCustomers] = useState<CustomerRow[] | null>(null);
  const [customersError, setCustomersError] = useState<string | null>(null);

  useEffect(() => {
    if (justConnected || connectError) {
      router.replace("/account#google-ads", { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDisconnect() {
    setDisconnecting(true);
    await fetch("/api/google-ads/disconnect", { method: "POST" }).catch(() => {});
    setDisconnecting(false);
    setConnectedEmail(null);
    setCustomers(null);
    setCustomersError(null);
  }

  async function handleVerifyAccess() {
    setLoadingCustomers(true);
    setCustomersError(null);
    try {
      const res = await fetch("/api/google-ads/customers");
      const data = (await res.json()) as { customers?: CustomerRow[]; error?: string };
      if (!res.ok) {
        setCustomersError(data.error ?? "Could not load Google Ads accounts");
        setCustomers(null);
        return;
      }
      setCustomers(data.customers ?? []);
    } catch {
      setCustomersError("Could not load Google Ads accounts");
      setCustomers(null);
    } finally {
      setLoadingCustomers(false);
    }
  }

  return (
    <div id="google-ads" className="scroll-mt-6 space-y-4 rounded-lg border border-dash-border bg-dash-card p-5">
      {!googleAdsConfigured && (
        <p className="text-[13px] text-amber-300">
          Google Ads API credentials are not configured on this server yet. Add GOOGLE_ADS_CLIENT_ID,
          GOOGLE_ADS_CLIENT_SECRET, and GOOGLE_ADS_DEVELOPER_TOKEN in Vercel.
        </p>
      )}

      {connectedEmail ? (
        <div className="rounded-md border border-emerald-800 bg-emerald-950/30 p-3">
          <p className="text-sm text-emerald-300">
            Connected: {connectedEmail} <span aria-hidden="true">✓</span>
          </p>
          <p className="mt-1 text-[12px] text-emerald-200/80">
            Read-only access — NextReport can list ad accounts and fetch campaign metrics. It cannot create or
            edit ads.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleVerifyAccess}
              disabled={loadingCustomers}
              className="rounded-md border border-dash-border px-3 py-1.5 text-[13px] text-dash-ink-secondary hover:bg-dash-border disabled:opacity-50"
            >
              {loadingCustomers ? "Checking API access…" : "Verify API access"}
            </button>
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="rounded-md border border-dash-border px-3 py-1.5 text-[13px] text-dash-ink-secondary hover:bg-dash-border disabled:opacity-50"
            >
              {disconnecting ? "Disconnecting…" : "Disconnect"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2 rounded-md border border-dash-border bg-dash-bg p-3">
          <p className="text-[13px] text-dash-ink-secondary">
            Connect the Google account that manages your Google Ads campaigns. This is separate from your
            NextReport login and from Google Drive — you will be redirected to Google&apos;s consent screen to
            authorise read-only reporting access.
          </p>
          {googleAdsConfigured ? (
            <a
              href="/api/google-ads/connect"
              className="inline-block rounded-md bg-dash-accent px-3 py-1.5 text-[13px] font-medium text-dash-ink hover:bg-dash-accent-hover"
            >
              Connect Google Ads
            </a>
          ) : null}
        </div>
      )}

      {customers && customers.length > 0 && (
        <ul className="space-y-1 rounded-md border border-dash-border bg-dash-bg p-3 text-[13px] text-dash-ink-secondary">
          {customers.map((c) => (
            <li key={c.id}>
              <span className="text-dash-ink">Customer {c.id}</span>
            </li>
          ))}
        </ul>
      )}

      {customers && customers.length === 0 && (
        <p className="text-[13px] text-dash-ink-secondary">
          API access works, but no Google Ads customer accounts were returned for this Google user.
        </p>
      )}

      {customersError && <p className="text-sm text-red-400">{customersError}</p>}

      {justConnected && !connectError && <p className="text-sm text-green-400">Google Ads connected.</p>}
      {connectError && (
        <p className="text-sm text-red-400">
          {CONNECT_ERROR_MESSAGES[connectError] ??
            "Something went wrong connecting Google Ads. Please try again."}
        </p>
      )}
    </div>
  );
}
