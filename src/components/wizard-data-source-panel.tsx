"use client";

import Link from "next/link";

export type WizardDataSource = "csv" | "api";

interface WizardDataSourcePanelProps {
  platform: "META" | "GOOGLE";
  metaConfigured: boolean;
  metaConnected: boolean;
  metaConnectedName: string | null;
  googleAdsConfigured: boolean;
  googleAdsConnected: boolean;
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
 * Step 1 "Sync from API" panel — surfaces Meta / Google Ads API approval and
 * connection status. Report generation from API data is rolling out; CSV
 * upload remains the production path until fetch routes ship.
 */
export function WizardDataSourcePanel({
  platform,
  metaConfigured,
  metaConnected,
  metaConnectedName,
  googleAdsConfigured,
  googleAdsConnected,
}: WizardDataSourcePanelProps) {
  const showMeta = platform === "META";
  const showGoogle = platform === "GOOGLE";

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[#63b3ed]/30 bg-[#0d1b2e]/80 px-4 py-3.5">
        <p className="text-[14px] font-semibold text-white">Official API access — skip the CSV export</p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-dash-ink-secondary">
          NextReport is approved for Meta&apos;s Marketing API and Google&apos;s Ads API. Connect once in Account
          Settings and we&apos;ll pull campaign data directly — no manual download from Ads Manager.
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
          <p className="mt-3 text-[13px] leading-relaxed text-dash-ink-secondary">
            {metaConfigured
              ? "Connect your Meta account, then pick an ad account and date range here — API report generation is rolling out shortly."
              : "Meta API credentials are not configured on this server yet."}
          </p>
          {metaConfigured ? (
            <Link
              href="/account#meta-ads"
              className="mt-3 inline-flex rounded-md bg-dash-accent px-4 py-2 text-[13px] font-semibold text-dash-ink hover:bg-dash-accent-hover"
            >
              {metaConnected ? "Manage Meta connection" : "Connect Meta Ads"}
            </Link>
          ) : null}
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
          <p className="mt-3 text-[13px] leading-relaxed text-dash-ink-secondary">
            {googleAdsConfigured
              ? "Connect your Google Ads account below, then use Sync from API in the report wizard. Direct report generation from API data is rolling out — CSV upload works today."
              : "Google Ads API credentials are not configured on this server yet."}
          </p>
          {googleAdsConfigured ? (
            <Link
              href="/account#google-ads"
              className="mt-3 inline-flex rounded-md border border-dash-border px-4 py-2 text-[13px] font-medium text-dash-ink hover:bg-dash-border"
            >
              {googleAdsConnected ? "Manage Google Ads connection" : "Connect Google Ads"}
            </Link>
          ) : (
            <p className="mt-3 text-[12px] text-dash-ink-secondary">
              Ask your admin to add Google Ads API env vars on Vercel (see setup guide in release notes).
            </p>
          )}
        </div>
      ) : null}

      <p className="text-[12px] leading-relaxed text-dash-ink-secondary">
        Prefer a manual export today? Switch to <span className="text-dash-ink">Upload CSV</span> above — it works
        exactly as before.
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
