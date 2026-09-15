"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast";
import type { ReportRetentionDaysOption } from "@/lib/report-retention";

export function ReportRetentionSettings({
  initialRetentionDays,
  options,
  planLabel,
}: {
  initialRetentionDays: number;
  options: ReportRetentionDaysOption[];
  planLabel: string;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [retentionDays, setRetentionDays] = useState(String(initialRetentionDays));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportRetentionDays: Number(retentionDays) }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      const message = data.error || "Something went wrong.";
      setError(message);
      showToast(message, "error");
      return;
    }

    showToast("Report retention updated.");
    router.refresh();
  }

  const maxDays = options[options.length - 1] ?? 30;

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-lg border border-dash-border bg-dash-card p-5">
      <p className="text-[13px] text-dash-ink-secondary">
        Generated PPTX and PDF files are removed automatically after this period. Share links stop working once a
        report is purged — save important decks to Google Drive or download them before they expire.
      </p>

      <div>
        <label htmlFor="report-retention-days" className="mb-1 block text-sm text-dash-ink-secondary">
          Keep reports for
        </label>
        <select
          id="report-retention-days"
          value={retentionDays}
          onChange={(e) => setRetentionDays(e.target.value)}
          className="w-full max-w-xs rounded-md border border-dash-border bg-dash-bg px-3 py-2 text-sm text-dash-ink outline-none focus:border-dash-accent"
        >
          {options.map((days) => (
            <option key={days} value={days}>
              {days} days
            </option>
          ))}
        </select>
        <p className="mt-1 text-[12px] text-dash-ink-secondary">
          Your {planLabel} plan allows up to {maxDays} days. Purge runs daily — reports older than this window are
          deleted overnight.
        </p>
      </div>

      {error && <p className="text-sm text-dash-error">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-dash-accent px-4 py-2 text-sm font-medium text-dash-ink hover:bg-dash-accent-hover disabled:opacity-60"
      >
        {loading ? "Saving…" : "Save retention preference"}
      </button>
    </form>
  );
}
