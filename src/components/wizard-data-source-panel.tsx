"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

export type WizardDataSource = "csv" | "api";

interface WizardDataSourcePanelProps {
  clientId: string;
  platform: "META" | "GOOGLE" | "TIKTOK";
  metaConfigured: boolean;
  metaConnected: boolean;
  metaConnectedName: string | null;
  googleAdsConfigured: boolean;
  googleAdsConnected: boolean;
  tiktokConfigured: boolean;
  tiktokConnected: boolean;
  /** Called after a successful API sync with a CSV File ready for analyze. */
  onSynced: (
    file: File,
    meta?: {
      previousMonthSynced?: boolean;
      hasPreviousMonthData?: boolean;
      previousMonthCampaigns?: string[];
      previousMonthSelectedCampaigns?: string[] | null;
      previousMonthUpdatedAt?: string | null;
    },
  ) => void;
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

interface TikTokAdvertiserOption {
  id: string;
  name: string;
}

/** Black square badge matching the import-source picker design (CSV / API). */
export function DataSourceBadge({ label }: { label: "CSV" | "API" }) {
  return (
    <span
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] bg-black text-[9px] font-bold leading-none tracking-tight text-white"
      aria-hidden="true"
    >
      {label}
    </span>
  );
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
  tiktokConfigured,
  tiktokConnected,
  onSynced,
  syncStatus,
  syncError,
  onSyncStart,
  onSyncError,
}: WizardDataSourcePanelProps) {
  const showMeta = platform === "META";
  const showGoogle = platform === "GOOGLE";
  const showTikTok = platform === "TIKTOK";
  const connected = showMeta ? metaConnected : showGoogle ? googleAdsConnected : tiktokConnected;
  const configured = showMeta ? metaConfigured : showGoogle ? googleAdsConfigured : tiktokConfigured;

  const [metaAccounts, setMetaAccounts] = useState<MetaAccountOption[]>([]);
  const [googleCustomers, setGoogleCustomers] = useState<GoogleCustomerOption[]>([]);
  const [tiktokAdvertisers, setTiktokAdvertisers] = useState<TikTokAdvertiserOption[]>([]);
  const [selectedMetaAccount, setSelectedMetaAccount] = useState("");
  const [selectedGoogleCustomer, setSelectedGoogleCustomer] = useState("");
  const [selectedTikTokAdvertiser, setSelectedTikTokAdvertiser] = useState("");
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
      } else if (showGoogle) {
        const res = await fetch("/api/google-ads/customers");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load Google Ads customers");
        const customers = (data.customers ?? []) as GoogleCustomerOption[];
        setGoogleCustomers(customers);
        if (customers.length === 1) setSelectedGoogleCustomer(customers[0].id);
      } else {
        const res = await fetch("/api/tiktok/advertisers");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load TikTok advertisers");
        const advertisers = (data.advertisers ?? []) as TikTokAdvertiserOption[];
        setTiktokAdvertisers(advertisers);
        if (advertisers.length === 1) setSelectedTikTokAdvertiser(advertisers[0].id);
      }
    } catch (err) {
      setAccountsError(err instanceof Error ? err.message : "Failed to load accounts");
    } finally {
      setAccountsLoading(false);
    }
  }, [connected, showMeta, showGoogle]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  async function handleSync() {
    onSyncStart();
    try {
      const body =
        platform === "META"
          ? { platform: "META" as const, metaAdAccountId: selectedMetaAccount }
          : platform === "GOOGLE"
            ? { platform: "GOOGLE" as const, googleCustomerId: selectedGoogleCustomer }
            : { platform: "TIKTOK" as const, tiktokAdvertiserId: selectedTikTokAdvertiser };

      if (platform === "META" && !selectedMetaAccount) {
        onSyncError("Select a Meta ad account first.");
        return;
      }
      if (platform === "GOOGLE" && !selectedGoogleCustomer) {
        onSyncError("Select a Google Ads customer first.");
        return;
      }
      if (platform === "TIKTOK" && !selectedTikTokAdvertiser) {
        onSyncError("Select a TikTok advertiser first.");
        return;
      }

      const res = await fetch(`/api/clients/${clientId}/reports/sync-api`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message =
          typeof data?.error === "string"
            ? data.error
            : res.status === 504
              ? "Import timed out — Meta may be slow for large accounts. Please try again in a moment."
              : "Sync failed";
        throw new Error(message);
      }

      if (!data.csvText || data.rowCount === 0) {
        onSyncError(
          "No campaign data returned for the last 30 days. Check that campaigns were active during this period.",
        );
        return;
      }

      const fileName = data.fileName ?? "api-sync.csv";
      const file = new File([data.csvText], fileName, { type: "text/csv" });
      onSynced(file, {
        previousMonthSynced: !!data.previousMonthSynced,
        hasPreviousMonthData: !!data.hasPreviousMonthData,
        previousMonthCampaigns: Array.isArray(data.previousMonthCampaigns) ? data.previousMonthCampaigns : [],
        previousMonthSelectedCampaigns: Array.isArray(data.previousMonthSelectedCampaigns)
          ? data.previousMonthSelectedCampaigns
          : null,
        previousMonthUpdatedAt: typeof data.previousMonthUpdatedAt === "string" ? data.previousMonthUpdatedAt : null,
      });
    } catch (err) {
      onSyncError(err instanceof Error ? err.message : "Sync failed");
    }
  }

  const canSync =
    connected &&
    configured &&
    syncStatus !== "loading" &&
    (showMeta ? !!selectedMetaAccount : showGoogle ? !!selectedGoogleCustomer : !!selectedTikTokAdvertiser);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[#63b3ed]/30 bg-[#0d1b2e]/80 px-4 py-3">
        <p className="text-[13px] text-dash-ink-secondary">Reduce manual work — no more spreadsheets.</p>
        <p className="mt-1 text-[13px] text-dash-ink-secondary">
          Last 30 days through yesterday — Previous month loads automatically.
        </p>
      </div>

      {showMeta ? (
        <div className="rounded-lg border border-dash-border bg-dash-bg p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-[14px] font-semibold text-white">Meta Marketing API</p>
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
              <p className="text-[14px] font-semibold text-white">Google Ads API</p>
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

      {showTikTok ? (
        <div className="rounded-lg border border-dash-border bg-dash-bg p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-[14px] font-semibold text-white">TikTok Marketing API</p>
              <p className="mt-0.5 text-[12px] text-dash-ink-secondary">Read-only · USD reporting</p>
            </div>
            <StatusPill ok={tiktokConnected} label={tiktokConnected ? "Connected" : "Not connected"} />
          </div>
          {!tiktokConfigured ? (
            <p className="mt-3 text-[13px] text-dash-ink-secondary">
              TikTok API credentials are not configured on this server yet.
            </p>
          ) : !tiktokConnected ? (
            <>
              <p className="mt-3 text-[13px] text-dash-ink-secondary">Connect your TikTok Ads account to sync data directly.</p>
              <Link
                href="/account#tiktok-ads"
                className="mt-3 inline-flex rounded-md border border-dash-border px-4 py-2 text-[13px] font-medium text-dash-ink hover:bg-dash-border"
              >
                Connect TikTok Ads
              </Link>
            </>
          ) : (
            <div className="mt-3 space-y-3">
              <label className="block text-[12px] font-medium uppercase tracking-wide text-dash-ink-secondary">
                Advertiser account
              </label>
              {accountsLoading ? (
                <p className="text-[13px] text-dash-ink-secondary">Loading advertisers…</p>
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
              ) : tiktokAdvertisers.length === 0 ? (
                <p className="text-[13px] text-amber-200">No TikTok advertisers found for this connection.</p>
              ) : (
                <select
                  value={selectedTikTokAdvertiser}
                  onChange={(e) => setSelectedTikTokAdvertiser(e.target.value)}
                  className="w-full rounded-md border border-dash-border bg-[#0f172a] px-3 py-2.5 text-[14px] text-white"
                >
                  <option value="">Select advertiser…</option>
                  {tiktokAdvertisers.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.id})
                    </option>
                  ))}
                </select>
              )}
              <Link href="/account#tiktok-ads" className="inline-block text-[12px] text-dash-ink-secondary underline">
                Manage TikTok connection
              </Link>
            </div>
          )}
        </div>
      ) : null}

      {connected && configured ? (
        <>
          {syncError ? (
            <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-[13px] text-red-200">
              {syncError}
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => void handleSync()}
            disabled={!canSync}
            className="h-12 w-full rounded-md bg-dash-accent text-[14px] font-semibold text-dash-ink hover:bg-dash-accent-hover disabled:opacity-40"
          >
            {syncStatus === "loading" ? "Syncing & analyzing…" : "Analyze campaign data"}
          </button>
        </>
      ) : null}
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
    <div className="space-y-2">
      <p className="text-[15px] font-semibold text-white">Import data</p>
      <div>
        <p className="mb-1.5 text-[12px] font-medium text-dash-ink-secondary">Import source</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => onChange("csv")}
            className={`flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-left transition-colors ${
              value === "csv"
                ? "border-dash-accent bg-dash-accent text-dash-ink"
                : "border-dash-border bg-dash-bg text-dash-ink-secondary hover:border-dash-ink-secondary/40 hover:text-dash-ink"
            }`}
          >
            <DataSourceBadge label="CSV" />
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold">Manual CSV upload</span>
              <span className={`mt-0.5 block text-[11px] leading-snug ${value === "csv" ? "text-dash-ink/80" : ""}`}>
                Manual export from Ads Manager
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => onChange("api")}
            className={`flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-left transition-colors ${
              value === "api"
                ? "border-dash-accent bg-dash-accent text-dash-ink"
                : "border-dash-border bg-dash-bg text-dash-ink-secondary hover:border-dash-ink-secondary/40 hover:text-dash-ink"
            }`}
          >
            <DataSourceBadge label="API" />
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold">Connect your data via API</span>
              <span className={`mt-0.5 block text-[11px] leading-snug ${value === "api" ? "text-dash-ink/80" : ""}`}>
                Your data connects automatically
              </span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
