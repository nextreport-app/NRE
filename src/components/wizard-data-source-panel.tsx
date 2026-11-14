"use client";
import { metaClientAccountStatus, normalizeMetaAccountId } from "@/lib/meta-client-account";
import { MetaClientAccountNotice } from "./meta-client-account-notice";

import type { MetaApiReportSelection } from "@/lib/nre/meta-api-import-range";
import Link from "next/link";
import { readClientWizardPreferences, saveClientWizardPreferences } from "./report-upload-wizard/client-wizard-preferences";
import { resolveRememberedMetaAccount } from "@/lib/meta-account-selection";
import { MetaAdAccountPicker } from "./meta-ad-account-picker";
import { useCallback, useEffect, useId, useState, type ReactNode } from "react";
import type { ApiSyncMeta } from "@/components/report-upload-wizard/types";

export type WizardDataSource = "csv" | "api";

interface WizardDataSourcePanelProps {
  clientId: string;
  clientName?: string;
  linkedMetaAdAccountId?: string | null;
  linkedMetaAdAccountName?: string | null;
  reportSelection?: MetaApiReportSelection;
  clientTimezone?: string;
  onTimezoneUpdated?: (timezone: string) => void;
  reportTypeControls?: ReactNode;
  setupControls?: ReactNode;
  selectionError?: string | null;
  platform: "META" | "GOOGLE" | "TIKTOK";
  metaConfigured: boolean;
  metaConnected: boolean;
  metaConnectedName: string | null;
  googleAdsConfigured: boolean;
  googleAdsConnected: boolean;
  tiktokConfigured: boolean;
  tiktokConnected: boolean;
  /** Called after a successful API sync with a CSV File ready for analyze. */
  onSynced: (file: File, meta?: ApiSyncMeta) => void | Promise<void>;
  syncStatus: "idle" | "loading" | "error";
  syncError: string | null;
  onSyncStart: () => void;
  onSyncError: (message: string) => void;
  onUseCsv?: () => void;
  onMetaAccountChanged?: (accountId: string) => void;
  /** When true, sync+analyze finished — hide the primary accent CTA so only Continue shows. */
  importComplete?: boolean;
  /** Optional Ads Manager CSV — server merges Result type / Results / Website leads over API delivery. */
  referenceManualCsvText?: string | null;
}

interface MetaAccountOption {
  id: string;
  name: string;
  accountId?: string;
  currency?: string;
  timezone?: string;
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
  clientName = "this client",
  linkedMetaAdAccountId = null,
  linkedMetaAdAccountName = null,
  reportSelection,
  clientTimezone, onTimezoneUpdated, reportTypeControls, setupControls, selectionError,
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
  onUseCsv,
  onMetaAccountChanged,
  importComplete = false,
  referenceManualCsvText = null,
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
  const selectedAccount = metaAccounts.find(account => account.id === selectedMetaAccount);
  const [confirmedAccountKey, setConfirmedAccountKey] = useState<string | null>(null);
  const accountStatus = metaClientAccountStatus(linkedMetaAdAccountId, selectedMetaAccount);
  const confirmationKey = JSON.stringify([clientId, normalizeMetaAccountId(linkedMetaAdAccountId), normalizeMetaAccountId(selectedMetaAccount)]);
  const accountConfirmed = confirmedAccountKey === confirmationKey;
  const accountNeedsConfirmation = showMeta && (accountStatus === "unlinked" || accountStatus === "mismatch");
  const linkedAccount = metaAccounts.find(account => normalizeMetaAccountId(account.id) === normalizeMetaAccountId(linkedMetaAdAccountId));
  const accountTimezone = showMeta ? selectedAccount?.timezone : undefined;
  // Align date presets before syncing; the server persists authoritative metadata.
  useEffect(() => {
    if (accountTimezone && accountTimezone !== clientTimezone) {
      onTimezoneUpdated?.(accountTimezone);
    }
  }, [accountTimezone, clientTimezone, onTimezoneUpdated]);
  const [accountSelectionNotice, setAccountSelectionNotice] = useState<string | null>(null);
  const [accountsLoading, setAccountsLoading] = useState(connected);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const loadAccounts = useCallback(async (signal?: AbortSignal) => {
    if (!connected) return;
    setAccountsLoading(true);
    setAccountsError(null);
    try {
      if (showMeta) {
        const res = await fetch("/api/meta/adaccounts", { signal });
        const data = await res.json();
        if (signal?.aborted) return;
        if (!res.ok) throw new Error(data.error ?? "Failed to load Meta ad accounts");
        const accounts = (data.accounts ?? []) as MetaAccountOption[];
        setMetaAccounts(accounts);
        const selection = resolveRememberedMetaAccount(accounts, linkedMetaAdAccountId ?? readClientWizardPreferences(clientId)?.metaAdAccountId);
        setSelectedMetaAccount(selection.id);
        setAccountSelectionNotice(selection.unavailable ? "Previous ad account unavailable. Choose another." : null);
      } else if (showGoogle) {
        const res = await fetch("/api/google-ads/customers", { signal });
        const data = await res.json();
        if (signal?.aborted) return;
        if (!res.ok) throw new Error(data.error ?? "Failed to load Google Ads customers");
        const customers = (data.customers ?? []) as GoogleCustomerOption[];
        setGoogleCustomers(customers);
        if (customers.length === 1) setSelectedGoogleCustomer(customers[0].id);
      } else {
        const res = await fetch("/api/tiktok/advertisers", { signal });
        const data = await res.json();
        if (signal?.aborted) return;
        if (!res.ok) throw new Error(data.error ?? "Failed to load TikTok advertisers");
        const advertisers = (data.advertisers ?? []) as TikTokAdvertiserOption[];
        setTiktokAdvertisers(advertisers);
        if (advertisers.length === 1) setSelectedTikTokAdvertiser(advertisers[0].id);
      }
    } catch (err) {
      if (signal?.aborted) return;
      setAccountsError(err instanceof Error ? err.message : "Failed to load accounts");
    } finally {
      if (!signal?.aborted) setAccountsLoading(false);
    }
  }, [connected, showMeta, showGoogle, clientId, linkedMetaAdAccountId]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) return loadAccounts(controller.signal);
    });
    return () => controller.abort();
  }, [loadAccounts]);

  async function handleSync() {
    if (accountNeedsConfirmation && !accountConfirmed) {
      onSyncError("Review and confirm the client and ad account before syncing.");
      return;
    }
    onSyncStart();
    try {
      const refText = referenceManualCsvText?.trim() || undefined;
      const body =
        platform === "META"
          ? {
              platform: "META" as const,
              metaAdAccountId: selectedMetaAccount,
              confirmedMetaAdAccountId: accountConfirmed ? selectedMetaAccount : undefined,
              ...reportSelection,
              ...(refText ? { referenceManualCsvText: refText } : {}),
            }
          : platform === "GOOGLE"
            ? { platform: "GOOGLE" as const, googleCustomerId: selectedGoogleCustomer }
            : { platform: "TIKTOK" as const, tiktokAdvertiserId: selectedTikTokAdvertiser };

      if (platform === "META" && !metaAccounts.some(account => account.id === selectedMetaAccount)) {
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

      if (platform === "META") saveClientWizardPreferences(clientId, { metaAdAccountId: selectedMetaAccount });
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

      let csvText: string = data.csvText ?? "";
      if (typeof data.csvGzipBase64 === "string") {
        const bytes = Uint8Array.from(atob(data.csvGzipBase64), character => character.charCodeAt(0));
        const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
        csvText = await new Response(stream).text();
      }
      if (!csvText || data.rowCount === 0) {
        onSyncError(
          "No campaign data returned for the selected reporting dates. Check the ad account and reporting period.",
        );
        return;
      }

      const fileName = data.fileName ?? "api-sync.csv";
      const file = new File([csvText], fileName, { type: "text/csv" });
      await onSynced(file, {
        metaSyncDiagnostics: data.metaSyncDiagnostics,
        previousMonthWarning: data.previousMonthWarning,
        mergedWithManualReference: !!data.mergedWithManualReference,
        previousMonthSynced: !!data.previousMonthSynced,
        hasPreviousMonthData: !!data.hasPreviousMonthData,
        previousMonthCampaigns: Array.isArray(data.previousMonthCampaigns) ? data.previousMonthCampaigns : [],
        previousMonthSelectedCampaigns: Array.isArray(data.previousMonthSelectedCampaigns)
          ? data.previousMonthSelectedCampaigns
          : null,
        previousMonthUpdatedAt: typeof data.previousMonthUpdatedAt === "string" ? data.previousMonthUpdatedAt : null,
        campaignPeriodReachMaps: data.campaignPeriodReachMaps,
        metaAdAccountId: platform === "META" ? selectedMetaAccount : undefined,
        linkedMetaAdAccountId: data.linkedMetaAdAccountId,
        linkedMetaAdAccountName: data.linkedMetaAdAccountName,
      });
    } catch (err) {
      onSyncError(err instanceof Error ? err.message : "Sync failed");
    }
  }

  const isSyncing = syncStatus === "loading";
  const canSync =
    connected &&
    configured &&
    !isSyncing && (!accountNeedsConfirmation || accountConfirmed) && !(accountTimezone && clientTimezone && accountTimezone !== clientTimezone) && !selectionError && !accountsLoading && !accountsError &&
    (showMeta ? metaAccounts.some(account => account.id === selectedMetaAccount) : showGoogle ? !!selectedGoogleCustomer : !!selectedTikTokAdvertiser);

  const csvFallback = onUseCsv ? <button type="button" onClick={onUseCsv} className="text-[13px] font-medium text-dash-accent underline">Use CSV instead</button> : null;

  return (
    <fieldset disabled={isSyncing} className="min-w-0 space-y-4">
      {reportTypeControls}
      {setupControls}

      {showMeta ? (
        <div className="rounded-lg border border-dash-border bg-dash-bg p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-[14px] font-semibold text-dash-ink">Meta Ads API sync</p>
              <p className="mt-0.5 text-[12px] text-dash-ink-secondary">Read-only connection · report data is fetched when you sync</p>
            </div>
            <StatusPill ok={metaConnected} label={metaConnected ? "Connected" : "Not connected"} />
          </div>
          {metaConnected && metaConnectedName ? (
            <p className="mt-2 text-[13px] text-dash-ink-secondary">
              Connected as <span className="text-dash-ink">{metaConnectedName}</span>
            </p>
          ) : null}
          {!metaConfigured ? (
            <div className="mt-3 space-y-2"><p className="text-[13px] text-dash-ink-secondary">Meta connection is temporarily unavailable.</p>{!syncError && csvFallback}</div>
          ) : !metaConnected ? (
            <>
              <p className="mt-3 text-[13px] text-dash-ink-secondary">Connect your Meta account to sync data directly.</p>
              <a
                href={`/api/meta/connect?returnTo=${encodeURIComponent(`/clients/${clientId}/reports/new`)}`}
                className="mt-3 inline-flex rounded-md bg-dash-accent px-4 py-2 text-[13px] font-semibold text-[#0d1b2e] hover:bg-dash-accent-hover"
              >
                Connect Meta Ads
              </a>
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
                  <div className="flex flex-wrap gap-4"><button
                    type="button"
                    onClick={() => void loadAccounts()}
                    className="text-[13px] text-dash-accent underline"
                  >
                    Retry
                  </button>{!syncError && csvFallback}</div>
                </div>
              ) : metaAccounts.length === 0 ? (
                <div className="space-y-2"><p className="text-[13px] text-dash-ink-secondary">No ad accounts available.</p><div className="flex flex-wrap gap-4"><button type="button" onClick={() => void loadAccounts()} className="text-[13px] text-dash-accent underline">Retry</button>{!syncError && csvFallback}</div></div>
              ) : (
                <MetaAdAccountPicker accounts={metaAccounts} value={selectedMetaAccount}
                  onChange={id => {
                    if (!metaAccounts.some(account => account.id === id)) return;
                    if (id !== selectedMetaAccount) onMetaAccountChanged?.(id);
                    setSelectedMetaAccount(id); setConfirmedAccountKey(null); setAccountsError(null); setAccountSelectionNotice(null);
                    saveClientWizardPreferences(clientId, { metaAdAccountId: id });
                  }} />
              )}
              {selectedAccount && !accountsLoading && !accountsError && <MetaClientAccountNotice
                clientName={clientName} linkedId={linkedMetaAdAccountId} linkedName={linkedMetaAdAccountName}
                selectedId={selectedAccount.id} selectedName={selectedAccount.name} confirmed={accountConfirmed}
                onConfirm={value => setConfirmedAccountKey(value ? confirmationKey : null)}
                onUseLinked={accountStatus === "mismatch" && linkedAccount ? () => {
                  onMetaAccountChanged?.(linkedAccount.id);
                  setSelectedMetaAccount(linkedAccount.id);
                  setConfirmedAccountKey(null);
                } : undefined}
              />}
              {accountTimezone && <p className="mt-2 text-xs text-dash-ink-secondary">Account calendar: {accountTimezone}. Report dates follow this calendar.</p>}
              {accountSelectionNotice && !accountsLoading && !accountsError && <p className="text-[13px] text-dash-ink-secondary" role="status">{accountSelectionNotice}</p>}
              <Link href="/account#meta-ads" className="inline-block text-[12px] text-dash-ink-secondary underline">
                Manage Meta connection
              </Link>
            </div>
          )}
        </div>
      ) : null}

      {selectionError ? <p role="alert" className="text-sm text-red-400">{selectionError}</p> : null}

      {showGoogle ? (
        <div className="rounded-lg border border-dash-border bg-dash-bg p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-[14px] font-semibold text-dash-ink">Google Ads API</p>
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
                  <div className="flex flex-wrap gap-4"><button
                    type="button"
                    onClick={() => void loadAccounts()}
                    className="text-[13px] text-dash-accent underline"
                  >
                    Retry
                  </button>{!syncError && csvFallback}</div>
                </div>
              ) : googleCustomers.length === 0 ? (
                <p className="text-[13px] text-amber-200">No Google Ads customers found for this connection.</p>
              ) : (
                <select
                  value={selectedGoogleCustomer}
                  onChange={(e) => setSelectedGoogleCustomer(e.target.value)}
                  className="w-full rounded-md border border-dash-border bg-dash-bg px-3 py-2.5 text-[14px] text-dash-ink"
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
              <p className="text-[14px] font-semibold text-dash-ink">TikTok Marketing API</p>
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
                  <div className="flex flex-wrap gap-4"><button
                    type="button"
                    onClick={() => void loadAccounts()}
                    className="text-[13px] text-dash-accent underline"
                  >
                    Retry
                  </button>{!syncError && csvFallback}</div>
                </div>
              ) : tiktokAdvertisers.length === 0 ? (
                <p className="text-[13px] text-amber-200">No TikTok advertisers found for this connection.</p>
              ) : (
                <select
                  value={selectedTikTokAdvertiser}
                  onChange={(e) => setSelectedTikTokAdvertiser(e.target.value)}
                  className="w-full rounded-md border border-dash-border bg-dash-bg px-3 py-2.5 text-[14px] text-dash-ink"
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

      {syncError && <div role="alert" className="space-y-2 rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-[13px] text-red-200">
        <p>{syncError}</p>
        <div className="flex flex-wrap items-center gap-4">
          {connected && configured && <button type="button" onClick={() => void handleSync()} disabled={!canSync} className="font-medium text-dash-accent underline disabled:opacity-40">Retry</button>}
          {csvFallback}
        </div>
      </div>}
      {connected && configured && !syncError ? (
          <button
            type="button"
            onClick={() => void handleSync()}
            disabled={!canSync}
            className={
              importComplete
                ? "h-10 w-full rounded-md border border-dash-border text-[14px] font-medium text-dash-ink-secondary hover:bg-dash-border disabled:opacity-40"
                : "h-12 w-full rounded-md bg-dash-accent text-[15px] font-semibold text-[#0d1b2e] hover:bg-dash-accent-hover disabled:opacity-40"
            }
          >
            {isSyncing ? "Syncing & analyzing…" : importComplete ? "Sync again" : "Sync & analyze"}
          </button>
      ) : null}
    </fieldset>
  );
}

export function WizardDataSourceToggle({ value, onChange, apiUnavailable = false }: {
  value: WizardDataSource;
  onChange: (value: WizardDataSource) => void;
  /** Operational kill switch; CSV remains available. */
  apiUnavailable?: boolean;
}) {
  const labelId = useId();
  return <div className="space-y-2">
    <p id={labelId} className="text-sm font-semibold text-dash-ink">Import data</p>
    <div role="group" aria-labelledby={labelId} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {([
        ['api', 'Meta API', 'Sync directly from Meta'],
        ['csv', 'Upload CSV', 'Upload an Ads Manager export'],
      ] as const).map(([method, label, description]) => {
        const selected = value === method;
        return <button
          key={method} type="button" aria-label={label} aria-describedby={`${labelId}-${method}-description`} aria-pressed={selected}
          disabled={method === "api" && apiUnavailable}
          onClick={() => onChange(method)}
          className={`flex min-h-20 min-w-0 items-center gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dash-accent disabled:cursor-not-allowed disabled:opacity-40 sm:p-4 ${selected ? 'border-dash-accent bg-dash-accent/5' : 'border-dash-border bg-dash-bg/40 hover:border-dash-ink-secondary/50 hover:bg-dash-bg'}`}
        >
          <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-dash-border text-dash-ink-secondary">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              {method === "api" ? <><path d="M8 3v5m8-5v5M6 8h12v4a6 6 0 0 1-12 0V8ZM12 18v3" /></> : <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6ZM14 3v6h6M12 17v-5m-3 3 3-3 3 3" /></>}
            </svg>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-dash-ink">{label}</span>
            <span id={`${labelId}-${method}-description`} className="mt-1 block text-xs leading-relaxed text-dash-ink-secondary">{description}</span>
          </span>
          <span aria-hidden="true" className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${selected ? 'bg-dash-accent text-[#0d1b2e]' : 'border border-dash-border'}`}>
            {selected && <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 8 3 3 7-7" /></svg>}
          </span>
        </button>;
      })}
    </div>
    {apiUnavailable && <p className="text-xs text-dash-ink-secondary">Meta API is temporarily unavailable. Upload a CSV to continue.</p>}
  </div>;
}
