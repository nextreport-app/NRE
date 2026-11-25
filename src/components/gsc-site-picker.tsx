"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function GscSitePicker({
  clientId,
  initialSiteUrl,
  connected,
  configured = true,
}: {
  clientId: string;
  initialSiteUrl: string | null;
  connected: boolean;
  configured?: boolean;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSiteUrl ?? ""),
    [selected, setSelected] = useState(initialSiteUrl ?? ""),
    [sites, setSites] = useState<Array<{
      siteUrl: string;
      permissionLevel: string;
    }> | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function action(method: "GET" | "PATCH" | "DELETE") {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/clients/${clientId}/gsc-site`, {
        method,
        ...(method === "PATCH"
          ? {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ siteUrl: selected }),
            }
          : {}),
      });
      const data = await response.json();
      if (!response.ok)
        throw Error(data.error ?? "Search Console sites could not be updated.");
      if (method === "GET") {
        setSites(data.sites);
        setSaved(data.siteUrl ?? "");
        setSelected(data.siteUrl ?? "");
      } else {
        setSaved(method === "DELETE" ? "" : data.siteUrl);
        setSelected(method === "DELETE" ? "" : data.siteUrl);
        router.refresh();
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Search Console request failed.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (!configured)
    return (
      <p className="text-sm text-dash-ink-secondary">
        Search Console connections are not available yet. Contact support to
        enable this connection.
      </p>
    );
  if (!connected)
    return (
      <p className="text-sm text-dash-ink-secondary">
        Connect a Google login above, then choose this client’s Search Console
        site. This is separate from GA4.
      </p>
    );
  const button =
    "inline-flex min-h-11 items-center rounded-lg border border-dash-border px-3 py-2 text-xs font-semibold hover:border-dash-accent disabled:opacity-50";
  return (
    <div className="space-y-3">
      <p className="break-all text-sm">
        {saved ? (
          <>
            Linked site: <strong>{saved}</strong>
          </>
        ) : (
          "Choose the domain or URL-prefix property that belongs to this client."
        )}
      </p>
      <button
        type="button"
        disabled={busy}
        className={button}
        onClick={() => void action("GET")}
      >
        {busy ? "Working…" : "Load Search Console sites"}
      </button>
      {sites &&
        (!sites.length ? (
          <p className="text-sm text-dash-ink-secondary">
            No verified Search Console sites are available to this login. Choose
            a different login above, or add this Google account as a user of the
            site in Search Console.
          </p>
        ) : (
          <label className="block text-xs text-dash-ink-secondary">
            Search Console site
            <select
              aria-label="Search Console site"
              disabled={busy}
              className="mt-2 min-h-11 w-full rounded-lg border border-dash-border bg-dash-bg px-3 text-sm text-dash-ink"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">Choose a site…</option>
              {sites.map((s) => (
                <option key={s.siteUrl} value={s.siteUrl}>
                  {s.siteUrl} ·{" "}
                  {(
                    {
                      siteOwner: "Owner",
                      siteFullUser: "Full access",
                      siteRestrictedUser: "Restricted access",
                    } as Record<string, string>
                  )[s.permissionLevel] ?? s.permissionLevel}
                </option>
              ))}
            </select>
          </label>
        ))}
      {error && (
        <p role="alert" className="text-sm text-dash-error">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {selected !== saved && !!selected && (
          <button
            type="button"
            disabled={busy}
            className={`${button} bg-dash-accent text-[#102033]`}
            onClick={() => void action("PATCH")}
          >
            Save site
          </button>
        )}
        {saved && (
          <button
            type="button"
            disabled={busy}
            className={button}
            onClick={() => void action("DELETE")}
          >
            Unlink site
          </button>
        )}
      </div>
    </div>
  );
}
