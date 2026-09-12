"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";

export type WizardDataSource = "csv" | "api";

export function isWizardApiAvailable(
  platform: "META" | "GOOGLE" | "TIKTOK",
  opts: {
    metaConfigured: boolean;
    metaConnected: boolean;
    googleAdsConfigured: boolean;
    googleAdsConnected: boolean;
    tiktokConfigured: boolean;
    tiktokConnected: boolean;
  },
): boolean {
  if (platform === "META") return opts.metaConfigured && opts.metaConnected;
  if (platform === "GOOGLE") return opts.googleAdsConfigured && opts.googleAdsConnected;
  return opts.tiktokConfigured && opts.tiktokConnected;
}

type CompareCell = "yes" | "no" | "partial" | "text";

const COMPARE_ROWS: { label: string; csv: CompareCell | string; api: CompareCell | string; csvNote?: string; apiNote?: string }[] = [
  { label: "Setup", csv: "text", api: "text", csvNote: "Export from Ads Manager", apiNote: "Connect once, sync each report" },
  { label: "Main date range", csv: "text", api: "text", csvNote: "You choose in export", apiNote: "Last 30 days ending yesterday" },
  { label: "Previous month row", csv: "partial", api: "yes", csvNote: "Manual upload", apiNote: "Auto-fetched when needed" },
  { label: "Campaign selection (prev. month)", csv: "yes", api: "yes" },
  { label: "Comparison & multi-month", csv: "yes", api: "yes" },
  { label: "Creative (Ad-level) reports", csv: "yes", api: "no" },
  { label: "Custom / extra columns", csv: "yes", api: "partial", apiNote: "Standard column set" },
  { label: "Works offline", csv: "yes", api: "no" },
];

function CompareValue({ value, note }: { value: CompareCell | string; note?: string }) {
  if (value === "yes") {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-400">
        <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Yes
      </span>
    );
  }
  if (value === "no") {
    return (
      <span className="inline-flex items-center gap-1 text-dash-ink-secondary">
        <svg className="h-3.5 w-3.5 shrink-0 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
          <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
        </svg>
        No
      </span>
    );
  }
  if (value === "partial") {
    return (
      <span className="inline-flex items-center gap-1 text-amber-300">
        <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
          <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
        </svg>
        {note ?? "Partial"}
      </span>
    );
  }
  if (value === "text") {
    return <span className="text-[12px] leading-snug text-dash-ink-secondary">{note}</span>;
  }
  return <span className="text-[12px] text-dash-ink-secondary">{value}</span>;
}

/** Side-by-side feature comparison — compact reference under the toggle cards. */
export function WizardDataSourceCompareTable({
  highlightMode,
}: {
  highlightMode: WizardDataSource;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-dash-border bg-dash-bg/50">
      <div className="border-b border-dash-border px-3 py-2">
        <p className="text-[12px] font-medium uppercase tracking-wide text-dash-ink-secondary">Quick comparison</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[320px] text-left text-[12px]">
          <thead>
            <tr className="border-b border-dash-border text-dash-ink-secondary">
              <th className="px-3 py-2 font-medium">Feature</th>
              <th
                className={`px-3 py-2 font-medium transition-colors duration-200 ${
                  highlightMode === "csv" ? "bg-[#f6ad55]/10 text-[#fbd38d]" : ""
                }`}
              >
                Upload CSV
              </th>
              <th
                className={`px-3 py-2 font-medium transition-colors duration-200 ${
                  highlightMode === "api" ? "bg-[#63b3ed]/10 text-[#90cdf4]" : ""
                }`}
              >
                Sync from API
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dash-border/70">
            {COMPARE_ROWS.map((row) => (
              <tr key={row.label} className="text-dash-ink-secondary">
                <td className="px-3 py-2 font-medium text-dash-ink">{row.label}</td>
                <td
                  className={`px-3 py-2 transition-colors duration-200 ${
                    highlightMode === "csv" ? "bg-[#f6ad55]/5" : ""
                  }`}
                >
                  <CompareValue value={row.csv} note={row.csvNote} />
                </td>
                <td
                  className={`px-3 py-2 transition-colors duration-200 ${
                    highlightMode === "api" ? "bg-[#63b3ed]/5" : ""
                  }`}
                >
                  <CompareValue value={row.api} note={row.apiNote} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

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

function CsvFileIcon() {
  return (
    <svg className="h-6 w-6 text-[#f6ad55]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 2v6h6M8 13h8M8 17h5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ApiCloudIcon() {
  return (
    <svg className="h-6 w-6 text-[#63b3ed]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 12v4M10 14h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FeatureChip({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "warn" }) {
  const toneClass =
    tone === "good"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
      : tone === "warn"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
        : "border-dash-border bg-dash-bg text-dash-ink-secondary";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${toneClass}`}>
      {children}
    </span>
  );
}

/** Side-by-side cards — same selectable pattern as platform / report-type cards. */
export function WizardDataSourceToggle({
  value,
  onChange,
  apiAvailable,
}: {
  value: WizardDataSource;
  onChange: (value: WizardDataSource) => void;
  /** When false, API card shows a connect hint instead of Recommended badge. */
  apiAvailable?: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <button
        type="button"
        onClick={() => onChange("csv")}
        aria-pressed={value === "csv"}
        className={`rounded-lg border p-4 text-left transition-all duration-200 ease-out hover:-translate-y-0.5 active:scale-[0.99] ${
          value === "csv"
            ? "wizard-card-selected border-[#f6ad55]/60 bg-[#f6ad55]/10 shadow-[0_4px_20px_rgba(246,173,85,0.12)] ring-1 ring-[#f6ad55]/30"
            : "border-dash-border bg-dash-bg hover:border-[#f6ad55]/30 hover:bg-dash-border/20"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <span className={`transition-transform duration-200 ${value === "csv" ? "scale-110" : ""}`}>
            <CsvFileIcon />
          </span>
          {value === "csv" ? (
            <span className="rounded-full bg-[#f6ad55]/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#fbd38d]">
              Selected
            </span>
          ) : null}
        </div>
        <p className="mt-2.5 text-[15px] font-semibold text-white">Upload CSV</p>
        <p className="mt-1 text-[13px] leading-relaxed text-dash-ink-secondary">
          Export from Ads Manager — full control over columns and date range.
        </p>
        <ul className="mt-3 space-y-1 text-[12px] text-dash-ink-secondary">
          <li className="flex items-start gap-1.5">
            <span className="mt-0.5 text-[#f6ad55]">✓</span>
            <span>Any column your export includes</span>
          </li>
          <li className="flex items-start gap-1.5">
            <span className="mt-0.5 text-[#f6ad55]">✓</span>
            <span>Ad-level Creative reports</span>
          </li>
          <li className="flex items-start gap-1.5">
            <span className="mt-0.5 text-[#f6ad55]">✓</span>
            <span>Manual previous-month upload</span>
          </li>
        </ul>
      </button>

      <button
        type="button"
        onClick={() => onChange("api")}
        aria-pressed={value === "api"}
        className={`rounded-lg border p-4 text-left transition-all duration-200 ease-out hover:-translate-y-0.5 active:scale-[0.99] ${
          value === "api"
            ? "wizard-card-selected border-[#63b3ed]/60 bg-[#63b3ed]/10 shadow-[0_4px_20px_rgba(99,179,237,0.12)] ring-1 ring-[#63b3ed]/30"
            : "border-dash-border bg-dash-bg hover:border-[#63b3ed]/30 hover:bg-dash-border/20"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <span className={`transition-transform duration-200 ${value === "api" ? "scale-110" : ""}`}>
            <ApiCloudIcon />
          </span>
          {apiAvailable ? (
            <span className="rounded-full bg-[#63b3ed]/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#90cdf4]">
              {value === "api" ? "Selected" : "Recommended"}
            </span>
          ) : (
            <span className="rounded-full bg-dash-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-dash-ink-secondary">
              Connect first
            </span>
          )}
        </div>
        <p className="mt-2.5 text-[15px] font-semibold text-white">Sync from API</p>
        <p className="mt-1 text-[13px] leading-relaxed text-dash-ink-secondary">
          One click — last 30 days plus previous month, no export step.
        </p>
        <ul className="mt-3 space-y-1 text-[12px] text-dash-ink-secondary">
          <li className="flex items-start gap-1.5">
            <span className="mt-0.5 text-[#63b3ed]">✓</span>
            <span>Last 30 days ending yesterday</span>
          </li>
          <li className="flex items-start gap-1.5">
            <span className="mt-0.5 text-[#63b3ed]">✓</span>
            <span>Previous month auto-fetched</span>
          </li>
          <li className="flex items-start gap-1.5">
            <span className="mt-0.5 text-[#63b3ed]">✓</span>
            <span>Comparison &amp; multi-month reports</span>
          </li>
        </ul>
      </button>
    </div>
  );
}

/** Compact feature row shown under the active data-source panel. */
export function WizardDataSourceSummary({ mode }: { mode: WizardDataSource }) {
  if (mode === "api") {
    return (
      <div className="flex flex-wrap gap-2">
        <FeatureChip tone="good">Same engine as CSV</FeatureChip>
        <FeatureChip>30-day daily breakdown</FeatureChip>
        <FeatureChip>Previous month included</FeatureChip>
        <FeatureChip tone="warn">Creative needs Ad-level CSV</FeatureChip>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <FeatureChip tone="good">Full column control</FeatureChip>
      <FeatureChip>Ad-level Creative reports</FeatureChip>
      <FeatureChip>Previous month optional upload</FeatureChip>
      <FeatureChip>Works offline</FeatureChip>
    </div>
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

  const platformLabel = showMeta ? "Meta" : showGoogle ? "Google Ads" : "TikTok";

  return (
    <div className="space-y-4 rounded-lg border border-[#63b3ed]/25 bg-[#0d1b2e]/40 p-4">
      <div>
        <p className="text-[14px] font-semibold text-white">Connect &amp; sync</p>
        <p className="mt-1 text-[13px] leading-relaxed text-dash-ink-secondary">
          Pick your {platformLabel} account below. We pull last 30 complete days (ending yesterday) and auto-fetch
          previous month when needed — then run the same analyze pipeline as a CSV upload.
        </p>
      </div>

      <WizardDataSourceSummary mode="api" />

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
            className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-dash-accent text-[14px] font-semibold text-dash-ink hover:bg-dash-accent-hover disabled:opacity-40"
          >
            {syncStatus === "loading" ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Syncing from API…
              </>
            ) : (
              "Sync data & analyze"
            )}
          </button>
          <p className="text-center text-[12px] text-dash-ink-secondary">
            After sync, review previous-month campaign checkboxes below.
          </p>
        </>
      ) : null}
    </div>
  );
}
