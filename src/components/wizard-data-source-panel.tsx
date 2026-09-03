"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

export type WizardDataSource = "csv" | "api";

interface WizardDataSourcePanelProps {
  clientId: string;
  platform: "META" | "GOOGLE";
  metaConfigured: boolean;
  metaConnected: boolean;
  metaConnectedName: string | null;
  googleAdsConfigured: boolean;
  googleAdsConnected: boolean;
  /** Called after a successful API sync with a CSV File ready for analyze. */
  onSynced: (file: File) => void;
  syncStatus: "idle" | "loading" | "error";
  syncError: string | null;
  onSyncStart: () => void;
  onSyncError: (message: string) => void;
}

interface MetaAccountOption {
  id: string;
  name: string;
  accountId?: string;
}

interface GoogleCustomerOption {
  id: string;
  resourceName: string;
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={
        ok
          ? "inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400"
          : "inline-flex items-center rounded-full bg-dash-border px-2.5 py-0.5 text-[11px] font-semibold text-dash-ink-secondary"
      }
    >
      {label}
    </span>
  );
}

/**
 * Step 1 "Sync from API" panel — connect status, ad account / customer picker,
 * and sync action that fetches data and hands a CSV File to the wizard.
 */
export function WizardDataSourcePanel({
  clientId,
  platform,
  metaConfigured,
  metaConnected,
  metaConnectedName,
  googleAdsConfigured,
  googleAdsConnected,
  onSynced,
  syncStatus,
  syncError,
  onSyncStart,
  onSyncError,
}: WizardDataSourcePanelProps) {
  const showMeta = platform === "META";
  const showGoogle = platform === "GOOGLE";
  const connected = showMeta ? metaConnected : googleAdsConnected;
  const configured = showMeta ? metaConfigured : googleAdsConfigured;

  const [metaAccounts, setMetaAccounts] = useState<MetaAccountOption[]>([]);
  const [googleCustomers, setGoogleCustomers] = useState<GoogleCustomerOption[]>([]);
  const [selectedMetaAccount, setSelectedMetaAccount] = useState("");
  const [selectedGoogleCustomer, setSelectedGoogleCustomer] = useState("");
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsError, setAccountsError] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    if (!connected) return;
    setAccountsLoading(true);
    setAccountsError(null);
    try {
      if (showMeta) {
        const res = await fetch("/api/meta/adaccounts");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load Meta ad accounts");
        const accounts = (data.accounts ?? []) as MetaAccountOption[];
        setMetaAccounts(accounts);
        if (accounts.length === 1) setSelectedMetaAccount(accounts[0].id);
      } else {
        const res = await fetch("/api/google-ads/customers");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load Google Ads customers");
        const customers = (data.customers ?? []) as GoogleCustomerOption[];
        setGoogleCustomers(customers);
        if (customers.length === 1) setSelectedGoogleCustomer(customers[0].id);
      }
    } catch (err) {
      setAccountsError(err instanceof Error ? err.message : "Failed to load accounts");
    } finally {
      setAccountsLoading(false);
    }
  }, [connected, showMeta]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  async function handleSync() {
    onSyncStart();
    try {
      const body =
        platform === "META"
          ? { platform: "META" as const, metaAdAccountId: selectedMetaAccount }
          : { platform: "GOOGLE" as const, googleCustomerId: selectedGoogleCustomer };

      if (platform === "META" && !selectedMetaAccount) {
        onSyncError("Select a Meta ad account first.");
        return;
      }
      if (platform === "GOOGLE" && !selectedGoogleCustomer) {
        onSyncError("Select a Google Ads customer first.");
        return;
      }

      const res = await fetch(`/api/clients/${clientId}/reports/sync-api`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Sync failed");
      }

      if (!data.csvText || data.rowCount === 0) {
        onSyncError(
          "No campaign data returned for the last 30 days. Check that campaigns were active during this period.",
        );
        return;
      }

      const fileName = data.fileName ?? "api-sync.csv";
      const file = new File([data.csvText], fileName, { type: "text/csv" });
      onSynced(file);
    } catch (err) {
      onSyncError(err instanceof Error ? err.message : "Sync failed");
    }
  }

  const canSync =
    connected &&
    configured &&
    syncStatus !== "loading" &&
    (showMeta ? !!selectedMetaAccount : !!selectedGoogleCustomer);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[#63b3ed]/30 bg-[#0d1b2e]/80 px-4 py-3.5">
        <p className="text-[14px] font-semibold text-white">Official API access — skip the CSV export</p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-dash-ink-secondary">
          Connect once in Account Settings, pick your ad account here, and we&apos;ll pull the last 30 days of
          daily campaign data — same report pipeline as CSV upload.
        </p>
      </div>

      {showMeta ? (
        <div className="rounded-lg border border-dash-border bg-dash-bg p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-[15px] font-semibold text-white">Meta Marketing API</p>
              <p className="mt-0.5 text-[12px] text-dash-ink-secondary">Approved · read-only ads reporting</p>
            </div>
            <StatusPill ok={metaConnected} label={metaConnected ? "Connected" : "Not connected"} />
          </div>
          {metaConnected && metaConnectedName ? (
            <p className="mt-2 text-[13px] text-dash-ink-secondary">
              Connected as <span className="text-dash-ink">{metaConnectedName}</span>
            </p>
          ) : null}
          {!metaConfigured ? (
            <p className="mt-3 text-[13px] text-dash-ink-secondary">Meta API credentials are not configured on this server.</p>
          ) : !metaConnected ? (
            <>
              <p className="mt-3 text-[13px] text-dash-ink-secondary">Connect your Meta account to sync data directly.</p>
              <Link
                href="/account#meta-ads"
                className="mt-3 inline-flex rounded-md bg-dash-accent px-4 py-2 text-[13px] font-semibold text-dash-ink hover:bg-dash-accent-hover"
              >
                Connect Meta Ads
              </Link>
            </>
          ) : (
            <div className="mt-3 space-y-3">
              <label className="block text-[12px] font-medium uppercase tracking-wide text-dash-ink-secondary">
                Ad account
              </label>
              {accountsLoading ? (
                <p className="text-[13px] text-dash-ink-secondary">Loading ad accounts…</p>
              ) : accountsError ? (
                <div className="space-y-2">
                  <p className="text-[13px] text-red-300">{accountsError}</p>
                  <button
                    type="button"
                    onClick={() => void loadAccounts()}
                    className="text-[13px] text-dash-accent underline"
                  >
                    Retry
                  </button>
                </div>
              ) : metaAccounts.length === 0 ? (
                <p className="text-[13px] text-amber-200">No ad accounts found for this Meta connection.</p>
              ) : (
                <select
                  value={selectedMetaAccount}
                  onChange={(e) => setSelectedMetaAccount(e.target.value)}
                  className="w-full rounded-md border border-dash-border bg-[#0f172a] px-3 py-2.5 text-[14px] text-white"
                >
                  <option value="">Select ad account…</option>
                  {metaAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.accountId ?? a.id.replace("act_", "")})
                    </option>
                  ))}
                </select>
              )}
              <Link href="/account#meta-ads" className="inline-block text-[12px] text-dash-ink-secondary underline">
                Manage Meta connection
              </Link>
            </div>
          )}
        </div>
      ) : null}

      {showGoogle ? (
        <div className="rounded-lg border border-dash-border bg-dash-bg p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-[15px] font-semibold text-white">Google Ads API</p>
              <p className="mt-0.5 text-[12px] text-dash-ink-secondary">Approved · read-only campaign metrics</p>
            </div>
            <StatusPill ok={googleAdsConnected} label={googleAdsConnected ? "Connected" : "Not connected"} />
          </div>
          {!googleAdsConfigured ? (
            <p className="mt-3 text-[13px] text-dash-ink-secondary">
              Google Ads API credentials are not configured on this server yet.
            </p>
          ) : !googleAdsConnected ? (
            <>
              <p className="mt-3 text-[13px] text-dash-ink-secondary">Connect your Google Ads account to sync data directly.</p>
              <Link
                href="/account#google-ads"
                className="mt-3 inline-flex rounded-md border border-dash-border px-4 py-2 text-[13px] font-medium text-dash-ink hover:bg-dash-border"
              >
                Connect Google Ads
              </Link>
            </>
          ) : (
            <div className="mt-3 space-y-3">
              <label className="block text-[12px] font-medium uppercase tracking-wide text-dash-ink-secondary">
                Google Ads customer
              </label>
              {accountsLoading ? (
                <p className="text-[13px] text-dash-ink-secondary">Loading customers…</p>
              ) : accountsError ? (
                <div className="space-y-2">
                  <p className="text-[13px] text-red-300">{accountsError}</p>
                  <button
                    type="button"
                    onClick={() => void loadAccounts()}
                    className="text-[13px] text-dash-accent underline"
                  >
                    Retry
                  </button>
                </div>
              ) : googleCustomers.length === 0 ? (
                <p className="text-[13px] text-amber-200">No Google Ads customers found for this connection.</p>
              ) : (
                <select
                  value={selectedGoogleCustomer}
                  onChange={(e) => setSelectedGoogleCustomer(e.target.value)}
                  className="w-full rounded-md border border-dash-border bg-[#0f172a] px-3 py-2.5 text-[14px] text-white"
                >
                  <option value="">Select customer…</option>
                  {googleCustomers.map((c) => (
                    <option key={c.id} value={c.id}>
                      Customer {c.id}
                    </option>
                  ))}
                </select>
              )}
              <Link href="/account#google-ads" className="inline-block text-[12px] text-dash-ink-secondary underline">
                Manage Google Ads connection
              </Link>
            </div>
          )}
        </div>
      ) : null}

      {connected && configured ? (
        <>
          <p className="text-[12px] text-dash-ink-secondary">
            Syncs the last 30 days with daily breakdown — same date range as our CSV download guide.
          </p>
          {syncError ? (
            <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-[13px] text-red-200">
              {syncError}
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => void handleSync()}
            disabled={!canSync}
            className="h-12 w-full rounded-md bg-dash-accent text-[15px] font-semibold text-dash-ink hover:bg-dash-accent-hover disabled:opacity-40"
          >
            {syncStatus === "loading" ? "Syncing from API…" : "Sync data & analyze"}
          </button>
        </>
      ) : null}

      <p className="text-[12px] leading-relaxed text-dash-ink-secondary">
        Prefer a manual export? Switch to <span className="text-dash-ink">Upload CSV</span> above.
      </p>
    </div>
  );
}

export function WizardDataSourceToggle({
  value,
  onChange,
}: {
  value: WizardDataSource;
  onChange: (value: WizardDataSource) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 rounded-lg border border-dash-border bg-dash-bg p-1">
      <button
        type="button"
        onClick={() => onChange("csv")}
        className={`rounded-md px-3 py-2.5 text-[13px] font-semibold transition-colors ${
          value === "csv" ? "bg-dash-accent text-dash-ink" : "text-dash-ink-secondary hover:text-dash-ink"
        }`}
      >
        Upload CSV
      </button>
      <button
        type="button"
        onClick={() => onChange("api")}
        className={`rounded-md px-3 py-2.5 text-[13px] font-semibold transition-colors ${
          value === "api" ? "bg-dash-accent text-dash-ink" : "text-dash-ink-secondary hover:text-dash-ink"
        }`}
      >
        Sync from API
      </button>
    </div>
  );
}
