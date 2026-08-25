"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/toast";

interface CopySlide {
  campaignName: string;
  adSetName?: string;
  aiSummary: string;
  aiInsights: string;
}

/**
 * Logged-in editor for Campaign Summary + Key Insights. Writes Report.summaryJson
 * so the public /r/{token} live link updates. Already-downloaded PPT files stay
 * as generated — edit those in Drive if needed.
 */
export function ReportCopyReview({ clientId, reportId }: { clientId: string; reportId: string }) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [campaigns, setCampaigns] = useState<CopySlide[]>([]);
  const [adSets, setAdSets] = useState<CopySlide[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const res = await fetch(`/api/clients/${clientId}/reports/${reportId}`);
      const json = await res.json().catch(() => null);
      if (cancelled) return;
      if (!res.ok || !json?.ok) {
        setError(json?.error || "Could not load copy for this report.");
        setLoading(false);
        return;
      }
      setCampaigns(json.campaigns ?? []);
      setAdSets(json.adSets ?? []);
      setError(null);
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [clientId, reportId]);

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/clients/${clientId}/reports/${reportId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        copyReview: {
          campaigns: campaigns.map((c) => ({ campaignName: c.campaignName, aiSummary: c.aiSummary, aiInsights: c.aiInsights })),
          adSets: adSets.map((c) => ({
            campaignName: c.campaignName,
            adSetName: c.adSetName,
            aiSummary: c.aiSummary,
            aiInsights: c.aiInsights,
          })),
        },
      }),
    });
    setSaving(false);
    if (!res.ok) {
      showToast("Could not save copy. Try again.", "error");
      return;
    }
    showToast("Live report link updated with this copy.");
  }

  if (loading) {
    return <p className="text-[13px] text-dash-ink-secondary">Loading campaign copy…</p>;
  }
  if (error) {
    return <p className="text-[13px] text-amber-300">{error}</p>;
  }
  if (campaigns.length === 0 && adSets.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4 rounded-lg border border-dash-border bg-dash-card p-4">
      <div>
        <p className="text-[15px] font-semibold text-dash-ink">Review Campaign Summary &amp; Key Insights</p>
        <p className="mt-1 text-[12px] text-dash-ink-secondary">
          Saving updates the live browser link. A PPT already downloaded (or saved to Drive) keeps the original text —
          edit that file in Drive if you need the deck to match.
        </p>
      </div>
      {campaigns.map((c, i) => (
        <div key={`c-${c.campaignName}-${i}`} className="space-y-2 border-t border-dash-border pt-3">
          <p className="text-[13px] font-semibold text-dash-ink">{c.campaignName}</p>
          <label className="block text-[11px] uppercase tracking-wide text-dash-ink-secondary">Campaign Summary</label>
          <textarea
            value={c.aiSummary}
            onChange={(e) =>
              setCampaigns((prev) => prev.map((row, idx) => (idx === i ? { ...row, aiSummary: e.target.value } : row)))
            }
            rows={3}
            className="w-full rounded-md border border-dash-border bg-dash-bg px-3 py-2 text-[13px] text-dash-ink"
          />
          <label className="block text-[11px] uppercase tracking-wide text-dash-ink-secondary">Key Insights</label>
          <textarea
            value={c.aiInsights}
            onChange={(e) =>
              setCampaigns((prev) => prev.map((row, idx) => (idx === i ? { ...row, aiInsights: e.target.value } : row)))
            }
            rows={3}
            className="w-full rounded-md border border-dash-border bg-dash-bg px-3 py-2 text-[13px] text-dash-ink"
          />
        </div>
      ))}
      {adSets.map((c, i) => (
        <div key={`a-${c.campaignName}-${c.adSetName}-${i}`} className="space-y-2 border-t border-dash-border pt-3">
          <p className="text-[13px] font-semibold text-dash-ink">
            {c.adSetName} <span className="font-normal text-dash-ink-secondary">({c.campaignName})</span>
          </p>
          <label className="block text-[11px] uppercase tracking-wide text-dash-ink-secondary">Ad set summary</label>
          <textarea
            value={c.aiSummary}
            onChange={(e) =>
              setAdSets((prev) => prev.map((row, idx) => (idx === i ? { ...row, aiSummary: e.target.value } : row)))
            }
            rows={3}
            className="w-full rounded-md border border-dash-border bg-dash-bg px-3 py-2 text-[13px] text-dash-ink"
          />
          <label className="block text-[11px] uppercase tracking-wide text-dash-ink-secondary">Key Insights</label>
          <textarea
            value={c.aiInsights}
            onChange={(e) =>
              setAdSets((prev) => prev.map((row, idx) => (idx === i ? { ...row, aiInsights: e.target.value } : row)))
            }
            rows={3}
            className="w-full rounded-md border border-dash-border bg-dash-bg px-3 py-2 text-[13px] text-dash-ink"
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className="rounded-md bg-dash-accent px-4 py-2 text-[13px] font-semibold text-dash-ink disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save copy to live link"}
      </button>
    </div>
  );
}
