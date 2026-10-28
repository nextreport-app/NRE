"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { isWizardApiSyncVisible } from "@/lib/ad-platform-api-sync";

const CONNECT_ERROR_MESSAGES: Record<string, string> = {
  access_denied: "Meta authorisation was cancelled — your ad account was not connected.",
  invalid_state: "That connection attempt expired or was invalid. Please try again.",
  missing_code: "Meta did not return an authorisation code. Please try again.",
  connection_failed: "Something went wrong connecting to Meta Ads. Please try again.",
  not_configured: "Meta Ads connections are currently unavailable. You can still upload a CSV to generate reports.",
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
  const [accountSearch, setAccountSearch] = useState("");
  const visibleAccounts = useMemo(() => (accounts ?? []).filter(a => `${a.name} ${a.accountId ?? a.id}`.toLowerCase().includes(accountSearch.trim().toLowerCase())).sort((a, b) => (a.name || "").localeCompare(b.name || "")), [accounts, accountSearch]);
  const [accountsError, setAccountsError] = useState<string | null>(null);

  useEffect(() => {
    if (justConnected || connectError) {
      router.replace("/account", { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      const response = await fetch("/api/meta/disconnect", { method: "POST" });
      if (!response.ok) throw new Error("disconnect failed");
      setConnectedName(null);
      setConnectedUserId(null);
      setAccounts(null);
      setAccountSearch("");
      setAccountsError(null);
    } catch {
      setAccountsError("Could not disconnect Meta Ads. Please try again.");
    } finally {
      setDisconnecting(false);
    }
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
      {!isWizardApiSyncVisible() ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-dash-border bg-dash-bg/50 px-3 py-2 text-[13px] text-dash-ink-secondary">
          <span className="rounded-full border border-amber-500/25 px-2 py-0.5 text-xs font-medium text-dash-accent">In testing</span>
          <p>Reports currently use Meta CSV uploads.</p>
        </div>
      ) : null}
      {!metaConfigured && !(connectedName || connectedUserId) && (
        <p className="text-[13px] text-amber-300">
          Meta Ads connections are currently unavailable. You can still upload a CSV to generate reports.
        </p>
      )}

      {connectedName || connectedUserId ? (
        <div className="rounded-lg border border-dash-border bg-dash-bg/50 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">✓ Connected</span>
            <p className="text-sm font-semibold text-dash-ink">{connectedName || "Meta account"}</p>
          </div>
          <p className="mt-2 text-[13px] text-dash-ink-secondary">Read-only reporting access. NextReport cannot create or edit ads.</p>
          {connectedUserId ? <details className="mt-2 text-xs text-dash-ink-secondary"><summary className="cursor-pointer">Connection details</summary><p className="mt-1 break-all">Meta user ID: {connectedUserId}</p></details> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleVerifyAccess}
              disabled={loadingAccounts || disconnecting}
              className="rounded-md border border-dash-border px-3 py-1.5 text-[13px] text-dash-ink-secondary hover:bg-dash-border disabled:opacity-50"
            >
              {loadingAccounts ? "Loading accounts…" : accounts ? "Refresh accounts" : "Load ad accounts"}
            </button>
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={disconnecting || loadingAccounts}
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
              className="inline-block rounded-md nre-account-primary bg-dash-accent px-3 py-1.5 text-[13px] font-medium hover:bg-dash-accent-hover"
            >
              Connect Meta Ads
            </a>
          ) : null}
        </div>
      )}

      {accounts !== null && (
        <section className="overflow-hidden rounded-lg border border-dash-border" aria-label="Accessible Meta ad accounts">
          <div className="space-y-3 border-b border-dash-border p-3 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold text-dash-ink">Ad accounts</h3><span className="text-xs text-dash-ink-secondary">{accounts.length} accessible</span></div>
            <p className="text-xs text-dash-ink-secondary">Accounts available to your connected Meta login.</p>
            {accounts.length > 0 ? <input type="search" value={accountSearch} onChange={e => setAccountSearch(e.target.value)} placeholder="Search by account name or ID" aria-label="Search Meta ad accounts" className="w-full rounded-md border border-dash-border bg-dash-bg px-3 py-2 text-sm text-dash-ink outline-none focus:border-dash-accent" /> : null}
          </div>
          <ul className="max-h-80 divide-y divide-dash-border overflow-y-auto bg-dash-bg/40">
            {visibleAccounts.map(a => {
              const id = (a.accountId || a.id).replace(/^act_/, "");
              const name = a.name && a.name !== id && a.name !== `act_${id}` ? a.name : "Unnamed ad account";
              return <li key={a.id} className="flex flex-col gap-1 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-4"><span className="min-w-0 break-words text-sm font-medium text-dash-ink">{name}</span><span className="shrink-0 break-all font-mono text-xs text-dash-ink-secondary">ID: {id}</span></li>;
            })}
          </ul>
          {visibleAccounts.length === 0 ? <p className="p-4 text-sm text-dash-ink-secondary">{accounts.length ? "No accounts match your search." : "Connection verified. No accessible ad accounts were returned."}</p> : null}
        </section>
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
