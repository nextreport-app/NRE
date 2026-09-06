"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const CONNECT_ERROR_MESSAGES: Record<string, string> = {
  access_denied: "Google authorisation was cancelled — Google Analytics was not connected.",
  invalid_state: "That connection attempt expired or was invalid. Please try again.",
  missing_code: "Google did not return an authorisation code. Please try again.",
  connection_failed: "Something went wrong connecting to Google Analytics. Please try again.",
  not_configured: "Google Analytics API credentials are not configured on this server yet.",
  no_refresh_token: "Google did not return a refresh token. Try again and choose Allow on the consent screen.",
};

interface Ga4PropertyRow {
  propertyId: string;
  displayName: string;
  accountName?: string;
}

/**
 * Account settings — Connect Google Analytics 4 (analytics.readonly scope).
 */
export function Ga4Settings({
  initialConnectedEmail,
  initialConnected,
  justConnected,
  connectError,
  ga4Configured,
}: {
  initialConnectedEmail: string | null;
  initialConnected: boolean;
  justConnected: boolean;
  connectError: string | null;
  ga4Configured: boolean;
}) {
  const router = useRouter();
  const [connected, setConnected] = useState(initialConnected);
  const [connectedEmail, setConnectedEmail] = useState(initialConnectedEmail);
  const [disconnecting, setDisconnecting] = useState(false);
  const [loadingProperties, setLoadingProperties] = useState(false);
  const [properties, setProperties] = useState<Ga4PropertyRow[] | null>(null);
  const [propertiesError, setPropertiesError] = useState<string | null>(null);

  useEffect(() => {
    if (justConnected || connectError) {
      router.replace("/account#ga4", { scroll: false });
      if (justConnected && !connectError) {
        setConnected(true);
        router.refresh();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDisconnect() {
    setDisconnecting(true);
    await fetch("/api/ga4/disconnect", { method: "POST" }).catch(() => {});
    setDisconnecting(false);
    setConnected(false);
    setConnectedEmail(null);
    setProperties(null);
    setPropertiesError(null);
  }

  async function handleListProperties() {
    setLoadingProperties(true);
    setPropertiesError(null);
    try {
      const res = await fetch("/api/ga4/properties");
      const data = (await res.json()) as { properties?: Ga4PropertyRow[]; error?: string };
      if (!res.ok) {
        setPropertiesError(data.error ?? "Could not load GA4 properties");
        setProperties(null);
        return;
      }
      setProperties(data.properties ?? []);
    } catch {
      setPropertiesError("Could not load GA4 properties");
      setProperties(null);
    } finally {
      setLoadingProperties(false);
    }
  }

  const errorMessage = connectError ? CONNECT_ERROR_MESSAGES[connectError] ?? connectError : null;

  return (
    <div id="ga4" className="scroll-mt-24">
      <p className="mb-4 text-[14px] leading-relaxed text-dash-ink-secondary">
        Connect Google Analytics 4 to pull website traffic data — sessions, engagement, channels, and conversions —
        into Website Traffic reports. This uses a separate OAuth grant from Google Ads.
      </p>

      {justConnected && !errorMessage && (
        <p className="mb-4 rounded-md border border-emerald-800 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-300">
          Google Analytics connected successfully.
        </p>
      )}

      {errorMessage && (
        <p className="mb-4 rounded-md border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">{errorMessage}</p>
      )}

      {!ga4Configured && (
        <p className="mb-4 rounded-md border border-amber-900 bg-amber-950/30 px-3 py-2 text-sm text-amber-200">
          GA4 OAuth is not configured yet. Add GA4_CLIENT_ID and GA4_CLIENT_SECRET (or reuse GOOGLE_ADS_* from the same
          Google Cloud project with Analytics Data + Admin APIs enabled).
        </p>
      )}

      {connected ? (
        <div className="rounded-md border border-emerald-800 bg-emerald-950/30 p-3">
          <p className="text-sm text-emerald-300">
            Connected{connectedEmail ? `: ${connectedEmail}` : ""} <span aria-hidden="true">✓</span>
          </p>
          <p className="mt-1 text-[12px] text-emerald-200/80">
            Read-only access — NextReport can list GA4 properties and pull website traffic metrics. It cannot change
            your Analytics settings.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleListProperties}
              disabled={loadingProperties}
              className="rounded-md border border-dash-border px-3 py-1.5 text-[13px] text-dash-ink-secondary hover:bg-dash-border disabled:opacity-50"
            >
              {loadingProperties ? "Loading properties…" : "List GA4 properties"}
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
          {propertiesError && <p className="mt-2 text-[13px] text-red-300">{propertiesError}</p>}
          {properties && properties.length === 0 && (
            <p className="mt-2 text-[13px] text-emerald-200/80">No GA4 properties found for this Google account.</p>
          )}
          {properties && properties.length > 0 && (
            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-md border border-emerald-900/50 bg-emerald-950/20 p-3 text-[13px]">
              {properties.map((p) => (
                <li key={p.propertyId} className="text-emerald-100/90">
                  <span className="font-medium text-emerald-50">{p.displayName}</span>
                  {p.accountName ? ` · ${p.accountName}` : ""}
                  <span className="text-emerald-200/70"> · ID {p.propertyId}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[12px] text-emerald-200/70">
            Link a property to each client on their Manage page to generate Website Traffic reports.
          </p>
        </div>
      ) : (
        <a
          href={ga4Configured ? "/api/ga4/connect" : "#"}
          className={`inline-block rounded-md px-4 py-2 text-[14px] font-medium ${
            ga4Configured
              ? "bg-dash-accent text-dash-ink hover:bg-dash-accent-hover"
              : "cursor-not-allowed bg-dash-border text-dash-ink-muted"
          }`}
          aria-disabled={!ga4Configured}
        >
          Connect Google Analytics
        </a>
      )}
    </div>
  );
}
