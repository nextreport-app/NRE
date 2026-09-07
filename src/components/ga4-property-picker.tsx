"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast";

interface Ga4PropertyOption {
  propertyId: string;
  displayName: string;
  accountName?: string;
}

/**
 * Client Manage page — link one GA4 property for Website Traffic reports.
 */
export function Ga4PropertyPicker({
  clientId,
  initialPropertyId,
  initialPropertyName,
  ga4Connected,
}: {
  clientId: string;
  initialPropertyId: string | null;
  initialPropertyName: string | null;
  ga4Connected: boolean;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [propertyId, setPropertyId] = useState(initialPropertyId ?? "");
  const [propertyName, setPropertyName] = useState(initialPropertyName ?? "");
  const [properties, setProperties] = useState<Ga4PropertyOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!ga4Connected) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/ga4-property`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load properties");
      setProperties(data.properties ?? []);
      if (data.linkedPropertyId) {
        setPropertyId(data.linkedPropertyId);
        setPropertyName(data.linkedPropertyName ?? "");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load properties");
    } finally {
      setLoading(false);
    }
  }, [clientId, ga4Connected]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave() {
    if (!propertyId) {
      setError("Select a GA4 property first.");
      return;
    }
    const selected = properties.find((p) => p.propertyId === propertyId);
    const name = selected?.displayName ?? propertyName ?? propertyId;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/ga4-property`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId, propertyName: name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save property");
      setPropertyName(data.propertyName);
      showToast("GA4 property linked");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save property");
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    setSaving(true);
    setError(null);
    await fetch(`/api/clients/${clientId}/ga4-property`, { method: "DELETE" }).catch(() => {});
    setPropertyId("");
    setPropertyName("");
    setSaving(false);
    showToast("GA4 property unlinked");
    router.refresh();
  }

  if (!ga4Connected) {
    return (
      <div className="space-y-3">
        <p className="text-[15px] text-dash-ink-secondary">
          Connect Google Analytics in Account Settings, then link a property here.
        </p>
        <Link
          href="/account#ga4"
          className="inline-flex rounded-md bg-dash-accent px-4 py-2 text-[13px] font-semibold text-dash-ink hover:bg-dash-accent-hover"
        >
          Connect Google Analytics
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[15px] text-dash-ink-secondary">One GA4 property per client for Google Analytics reports.</p>
      {initialPropertyId && initialPropertyName ? (
        <p className="text-[13px] text-dash-ink">
          Linked: <span className="font-medium">{initialPropertyName}</span>
          <span className="text-dash-ink-muted"> · ID {initialPropertyId}</span>
        </p>
      ) : null}
      {loading ? (
        <p className="text-[13px] text-dash-ink-secondary">Loading GA4 properties…</p>
      ) : properties.length === 0 ? (
        <p className="text-[13px] text-amber-200">No GA4 properties found. Check your Google Analytics connection.</p>
      ) : (
        <select
          value={propertyId}
          onChange={(e) => setPropertyId(e.target.value)}
          className="w-full rounded-md border border-dash-border bg-[#0f172a] px-3 py-2.5 text-[14px] text-white"
        >
          <option value="">Select GA4 property…</option>
          {properties.map((p) => (
            <option key={p.propertyId} value={p.propertyId}>
              {p.displayName}
              {p.accountName ? ` · ${p.accountName}` : ""} · {p.propertyId}
            </option>
          ))}
        </select>
      )}
      {error ? <p className="text-[13px] text-red-300">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || !propertyId}
          className="rounded-md bg-dash-accent px-4 py-2 text-[13px] font-semibold text-dash-ink hover:bg-dash-accent-hover disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save property"}
        </button>
        {initialPropertyId ? (
          <button
            type="button"
            onClick={() => void handleClear()}
            disabled={saving}
            className="rounded-md border border-dash-border px-4 py-2 text-[13px] text-dash-ink-secondary hover:bg-dash-card disabled:opacity-50"
          >
            Unlink
          </button>
        ) : null}
        <Link href="/account#ga4" className="self-center text-[12px] text-dash-ink-secondary underline">
          Manage GA4 connection
        </Link>
      </div>
    </div>
  );
}
