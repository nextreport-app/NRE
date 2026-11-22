"use client";

import { useCallback, useState } from "react";
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
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!ga4Connected) return;
    setLoading(true);
    setAttempted(true);
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
      setError(
        err instanceof Error ? err.message : "Could not load properties",
      );
    } finally {
      setLoading(false);
    }
  }, [clientId, ga4Connected]);

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
    try {
      const response = await fetch(`/api/clients/${clientId}/ga4-property`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error ?? "Could not unlink property.");
      setPropertyId("");
      setPropertyName("");
      showToast("GA4 property unlinked");
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not unlink property.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!ga4Connected) {
    return (
      <div className="space-y-3">
        <p className="text-[15px] text-dash-ink-secondary">
          Connect Google Analytics in Account Settings, then link a property
          here.
        </p>
        <Link
          href="/account#ga4"
          className="inline-flex rounded-md nre-account-primary bg-dash-accent px-4 py-2 text-[13px] font-semibold hover:bg-dash-accent-hover"
        >
          Connect Google Analytics
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[15px] text-dash-ink-secondary">
        Link the website property that belongs to this client.
      </p>
      {initialPropertyId && initialPropertyName ? (
        <p className="text-[13px] text-dash-ink">
          Linked: <span className="font-medium">{initialPropertyName}</span>
          <span className="text-dash-ink-muted"> · ID {initialPropertyId}</span>
        </p>
      ) : null}
      <button
        type="button"
        disabled={loading || saving}
        onClick={() => void load()}
        className="rounded-md border border-dash-border px-3 py-2 text-sm disabled:opacity-50"
      >
        {loading ? "Loading…" : "Load GA4 properties"}
      </button>
      {loading ? (
        <p className="text-[13px] text-dash-ink-secondary">
          Loading GA4 properties…
        </p>
      ) : attempted && properties.length === 0 ? (
        <p className="text-[13px] text-amber-200">
          No GA4 properties found. Check your Google Analytics connection.
        </p>
      ) : properties.length > 0 ? (
        <select
          aria-label="GA4 property"
          value={propertyId}
          onChange={(e) => setPropertyId(e.target.value)}
          className="w-full rounded-md border border-dash-border bg-dash-bg px-3 py-2.5 text-[14px] text-dash-ink"
        >
          <option value="">Select GA4 property…</option>
          {properties.map((p) => (
            <option key={p.propertyId} value={p.propertyId}>
              {p.displayName}
              {p.accountName ? ` · ${p.accountName}` : ""} · {p.propertyId}
            </option>
          ))}
        </select>
      ) : null}
      {error ? <p className="text-[13px] text-red-300">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={
            saving ||
            !propertyId ||
            !properties.some((p) => p.propertyId === propertyId)
          }
          className="rounded-md nre-account-primary bg-dash-accent px-4 py-2 text-[13px] font-semibold hover:bg-dash-accent-hover disabled:opacity-50"
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
        <Link
          href="/account#ga4"
          className="self-center text-[12px] text-dash-ink-secondary underline"
        >
          Manage GA4 connection
        </Link>
      </div>
    </div>
  );
}
