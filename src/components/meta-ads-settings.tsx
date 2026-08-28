"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const CONNECT_ERROR_MESSAGES: Record<string, string> = {
  access_denied: "Meta authorisation was cancelled — your ad account was not connected.",
  invalid_state: "That connection attempt expired or was invalid. Please try again.",
  missing_code: "Meta did not return an authorisation code. Please try again.",
  connection_failed: "Something went wrong connecting to Meta Ads. Please try again.",
  not_configured: "Meta integration is not configured on this server yet.",
};

interface AdAccountRow {
  id: string;
  name: string;
  accountId?: string;
}

/**
 * Account settings section for connecting a Meta Ads account (read-only
 * ads_read). Reviewers can use this to verify Marketing API access works.
 */
export function MetaAdsSettings({
  initialConnectedName,
  initialConnectedUserId,
  justConnected,
  connectError,
  metaConfigured,
}: {
  initialConnectedName: string | null;
  initialConnectedUserId: string | null;
  justConnected: boolean;
  connectError: string | null;
  /** False when META_APP_ID / META_APP_SECRET are not set on the server. */
  metaConfigured: boolean;
}) {
  const router = useRouter();
  const [connectedName, setConnectedName] = useState(initialConnectedName);
  const [connectedUserId, setConnectedUserId] = useState(initialConnectedUserId);
  const [disconnecting, setDisconnecting] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [accounts, setAccounts] = useState<AdAccountRow[] | null>(null);
  const [accountsError, setAccountsError] = useState<string | null>(null);

  useEffect(() => {
    if (justConnected || connectError) {
      router.replace("/account", { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDisconnect() {
    setDisconnecting(true);
    await fetch("/api/meta/disconnect", { method: "POST" }).catch(() => {});
    setDisconnecting(false);
    setConnectedName(null);
    setConnectedUserId(null);
    setAccounts(null);
    setAccountsError(null);
  }

  async function handleVerifyAccess() {
    setLoadingAccounts(true);
    setAccountsError(null);
    try {
      const res = await fetch("/api/meta/adaccounts");
      const data = (await res.json()) as { accounts?: AdAccountRow[]; error?: string };
      if (!res.ok) {
        setAccountsError(data.error ?? "Could not load ad accounts");
        setAccounts(null);
        return;
      }
      setAccounts(data.accounts ?? []);
    } catch {
      setAccountsError("Could not load ad accounts");
      setAccounts(null);
    } finally {
      setLoadingAccounts(false);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-dash-border bg-dash-card p-5">
      {!metaConfigured && (
        <p className="text-[13px] text-amber-300">
          Meta App credentials are not configured on this server yet. Add META_APP_ID and META_APP_SECRET
          in your environment before connecting.
        </p>
      )}

      {connectedName || connectedUserId ? (
        <div className="rounded-md border border-emerald-800 bg-emerald-950/30 p-3">
          <p className="text-sm text-emerald-300">
            Connected{connectedName ? `: ${connectedName}` : ""}
            {connectedUserId ? ` (Meta user ${connectedUserId})` : ""} <span aria-hidden="true">✓</span>
          </p>
          <p className="mt-1 text-[12px] text-emerald-200/80">
            Read-only access — NextReport can list ad accounts and campaign metrics. It cannot create or edit
            ads.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleVerifyAccess}
              disabled={loadingAccounts}
              className="rounded-md border border-dash-border px-3 py-1.5 text-[13px] text-dash-ink-secondary hover:bg-dash-border disabled:opacity-50"
            >
              {loadingAccounts ? "Checking API access…" : "Verify API access"}
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
            Connect the Meta account that manages your ad accounts. This is separate from your NextReport
            login — you will be redirected to Meta&apos;s consent screen to authorise read-only access.
          </p>
          {metaConfigured ? (
            <a
              href="/api/meta/connect"
              className="inline-block rounded-md bg-dash-accent px-3 py-1.5 text-[13px] font-medium text-dash-ink hover:bg-dash-accent-hover"
            >
              Connect Meta Ads
            </a>
          ) : null}
        </div>
      )}

      {accounts && accounts.length > 0 && (
        <ul className="space-y-1 rounded-md border border-dash-border bg-dash-bg p-3 text-[13px] text-dash-ink-secondary">
          {accounts.map((a) => (
            <li key={a.id}>
              <span className="text-dash-ink">{a.name}</span>
              {a.accountId ? ` — act_${a.accountId}` : ` — ${a.id}`}
            </li>
          ))}
        </ul>
      )}

      {accounts && accounts.length === 0 && (
        <p className="text-[13px] text-dash-ink-secondary">
          API access works, but no ad accounts were returned for this Meta user.
        </p>
      )}

      {accountsError && <p className="text-sm text-red-400">{accountsError}</p>}

      {justConnected && !connectError && <p className="text-sm text-green-400">Meta Ads connected.</p>}
      {connectError && (
        <p className="text-sm text-red-400">
          {CONNECT_ERROR_MESSAGES[connectError] ?? "Something went wrong connecting Meta Ads. Please try again."}
        </p>
      )}
    </div>
  );
}
