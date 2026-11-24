"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  MetaAdAccountPicker,
  type SelectableAdAccount,
} from "./meta-ad-account-picker";
export function MetaClientAccountSelector({
  clientId,
  clientName,
  busy,
  onLinked,
  onActivity,
}: {
  clientId: string;
  clientName: string;
  busy: boolean;
  onLinked: () => Promise<void>;
  onActivity: (busy: boolean) => void;
}) {
  const [accounts, setAccounts] = useState<SelectableAdAccount[]>([]),
    [selected, setSelected] = useState(""),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0),
    [needsConnection, setNeedsConnection] = useState(false);
  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      setNeedsConnection(false);
      try {
        const r = await fetch("/api/meta/adaccounts", { cache: "no-store" });
        const data = await r.json();
        if (!r.ok) {
          if (active) setNeedsConnection(true);
          throw Error(data.error ?? "Ad accounts could not load. Try again.");
        }
        if (active) setAccounts(data.accounts ?? []);
      } catch (e) {
        if (active)
          setError(
            e instanceof Error
              ? e.message
              : "Ad accounts could not load. Try again.",
          );
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [retry]);
  async function save() {
    if (!selected || busy || saving) return;
    setSaving(true);
    setError("");
    onActivity(true);
    try {
      const r = await fetch(
        `/api/clients/${encodeURIComponent(clientId)}/meta-account`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId: selected }),
        },
      );
      const data = await r.json();
      if (!r.ok)
        throw Error(data.error ?? "The ad account could not be assigned.");
      try {
        await onLinked();
      } catch {
        throw Error(
          "Account saved, but the screen could not refresh. Reload this page.",
        );
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "The ad account could not be assigned.",
      );
    } finally {
      setSaving(false);
      onActivity(false);
    }
  }
  return (
    <div className="mt-4 rounded-xl border border-dash-border bg-dash-bg p-5">
      <h3 className="font-semibold">
        Choose the Meta ad account for {clientName}
      </h3>
      <p className="mt-2 text-sm text-dash-ink-secondary">
        Choose which ad account belongs to this client. No report import is
        needed.
      </p>
      {loading ? (
        <p role="status" className="mt-4 text-sm">
          Loading your accessible ad accounts…
        </p>
      ) : accounts.length ? (
        <div className="mt-4 space-y-3">
          <MetaAdAccountPicker
            accounts={accounts}
            value={selected}
            onChange={setSelected}
            disabled={busy || saving}
          />
          <button
            type="button"
            disabled={!selected || busy || saving}
            onClick={() => void save()}
            className="min-h-11 cursor-pointer rounded-xl bg-dash-accent px-5 py-3 text-sm font-semibold text-[#102033] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving…" : "Use this ad account"}
          </button>
        </div>
      ) : (
        !error && (
          <p className="mt-4 text-sm text-dash-ink-secondary">
            Meta returned no ad accounts for this connection. Check account
            access in Meta or reconnect.
          </p>
        )
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-amber-400">
          {error}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-dash-ink-secondary">
        {error && (
          <button
            type="button"
            className="cursor-pointer underline"
            disabled={busy || saving || loading}
            onClick={() => setRetry((n) => n + 1)}
          >
            Reload accounts
          </button>
        )}
        {(needsConnection || (!loading && !accounts.length)) && (
          <Link href="/account#meta-ads" className="underline">
            Manage Meta connection
          </Link>
        )}
        <Link href={`/clients/${clientId}`} className="underline">
          Client settings
        </Link>
      </div>
    </div>
  );
}
