"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const CONNECT_ERROR_MESSAGES: Record<string, string> = {
  access_denied: "TikTok authorisation was cancelled — your ad account was not connected.",
  invalid_state: "That connection attempt expired or was invalid. Please try again.",
  missing_code: "TikTok did not return an authorisation code. Please try again.",
  connection_failed: "Something went wrong connecting to TikTok Ads. Please try again.",
  not_configured: "TikTok integration is not configured on this server yet.",
};

interface AdvertiserRow {
  id: string;
  name: string;
}

/**
 * Account settings section for connecting a TikTok Ads account (read-only
 * Marketing API reporting). USD-only — built for US and global accounts.
 */
export function TikTokAdsSettings({
  initialConnectedName,
  initialConnected,
  justConnected,
  connectError,
  tiktokConfigured,
}: {
  initialConnectedName: string | null;
  initialConnected: boolean;
  justConnected: boolean;
  connectError: string | null;
  tiktokConfigured: boolean;
}) {
  const router = useRouter();
  const [connected, setConnected] = useState(initialConnected);
  const [connectedName, setConnectedName] = useState(initialConnectedName);
  const [disconnecting, setDisconnecting] = useState(false);
  const [loadingAdvertisers, setLoadingAdvertisers] = useState(false);
  const [advertisers, setAdvertisers] = useState<AdvertiserRow[] | null>(null);
  const [advertisersError, setAdvertisersError] = useState<string | null>(null);

  useEffect(() => {
    if (justConnected || connectError) {
      router.replace("/account#tiktok-ads", { scroll: false });
      if (justConnected && !connectError) {
        setConnected(true);
        router.refresh();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDisconnect() {
    setDisconnecting(true);
    await fetch("/api/tiktok/disconnect", { method: "POST" }).catch(() => {});
    setDisconnecting(false);
    setConnected(false);
    setConnectedName(null);
    setAdvertisers(null);
    setAdvertisersError(null);
  }

  async function handleVerifyAccess() {
    setLoadingAdvertisers(true);
    setAdvertisersError(null);
    try {
      const res = await fetch("/api/tiktok/advertisers");
      const data = (await res.json()) as { advertisers?: AdvertiserRow[]; error?: string };
      if (!res.ok) {
        setAdvertisersError(data.error ?? "Could not load advertisers");
        setAdvertisers(null);
        return;
      }
      setAdvertisers(data.advertisers ?? []);
    } catch {
      setAdvertisersError("Could not load advertisers");
      setAdvertisers(null);
    } finally {
      setLoadingAdvertisers(false);
    }
  }

  const errorMessage = connectError ? CONNECT_ERROR_MESSAGES[connectError] ?? connectError : null;

  return (
    <div id="tiktok-ads" className="scroll-mt-24">
      <p className="mb-4 text-[14px] leading-relaxed text-dash-ink-secondary">
        Connect TikTok Ads Manager for read-only campaign reporting. Built for US and global advertiser accounts
        (USD). Indian agencies managing US clients via VPN can connect the same way.
      </p>

      {justConnected && !errorMessage && (
        <p className="mb-4 rounded-md border border-emerald-800 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-300">
          TikTok Ads connected successfully.
        </p>
      )}

      {errorMessage && (
        <p className="mb-4 rounded-md border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">{errorMessage}</p>
      )}

      {!tiktokConfigured && (
        <p className="mb-4 rounded-md border border-amber-900 bg-amber-950/30 px-3 py-2 text-sm text-amber-200">
          TikTok OAuth is not configured yet. Add TIKTOK_APP_ID and TIKTOK_APP_SECRET from your TikTok for Business
          developer app.
        </p>
      )}

      {connected ? (
        <div className="rounded-md border border-emerald-800 bg-emerald-950/30 p-3">
          <p className="text-sm text-emerald-300">
            Connected{connectedName ? `: ${connectedName}` : ""} <span aria-hidden="true">✓</span>
          </p>
          <p className="mt-1 text-[12px] text-emerald-200/80">
            Read-only access — NextReport can pull campaign performance data. It cannot change your TikTok campaigns.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleVerifyAccess}
              disabled={loadingAdvertisers}
              className="rounded-md border border-dash-border px-3 py-1.5 text-[13px] text-dash-ink-secondary hover:bg-dash-border disabled:opacity-50"
            >
              {loadingAdvertisers ? "Loading advertisers…" : "List advertisers"}
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
          {advertisersError && <p className="mt-2 text-[13px] text-red-300">{advertisersError}</p>}
          {advertisers && advertisers.length === 0 && (
            <p className="mt-2 text-[13px] text-emerald-200/80">No advertisers found for this connection.</p>
          )}
          {advertisers && advertisers.length > 0 && (
            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-md border border-emerald-900/50 bg-emerald-950/20 p-3 text-[13px]">
              {advertisers.map((a) => (
                <li key={a.id} className="text-emerald-100/90">
                  <span className="font-medium text-emerald-50">{a.name}</span>
                  <span className="text-emerald-200/70"> · ID {a.id}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <a
          href={tiktokConfigured ? "/api/tiktok/connect" : "#"}
          className={`inline-block rounded-md px-4 py-2 text-[14px] font-medium ${
            tiktokConfigured
              ? "bg-dash-accent text-dash-ink hover:bg-dash-accent-hover"
              : "cursor-not-allowed bg-dash-border text-dash-ink-muted"
          }`}
          aria-disabled={!tiktokConfigured}
        >
          Connect TikTok Ads
        </a>
      )}
    </div>
  );
}
