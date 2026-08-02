"use client";

import { useState } from "react";
import { useToast } from "@/components/toast";

export interface ReportHistoryItem {
  id: string;
  fileName: string | null;
  weekStart: string | null;
  weekEnd: string | null;
  status: string;
  reportType: string;
  createdAt: string; // ISO
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function reportLabel(r: ReportHistoryItem): string {
  return r.fileName || (r.weekStart && r.weekEnd ? `${r.weekStart} – ${r.weekEnd}` : r.id);
}

function weekPeriodLabel(r: ReportHistoryItem): string {
  return r.weekStart && r.weekEnd ? `${r.weekStart} – ${r.weekEnd}` : "—";
}

/**
 * Fix 3 — the client detail page's report history, capped to the last 30
 * days server-side (see clients/[id]/page.tsx's own query) — this
 * component only ever renders what it's handed, it doesn't re-filter.
 * Delete is a two-step inline confirm (not a native confirm() dialog, so
 * the "Confirm"/"Cancel" buttons can be styled and labeled exactly as
 * specified) that swaps a row's action buttons for a confirmation message,
 * then removes the row from local state on a successful DELETE — no full
 * page reload needed.
 */
export function ReportHistoryList({ clientId, initialReports }: { clientId: string; initialReports: ReportHistoryItem[] }) {
  const { showToast } = useToast();
  const [reports, setReports] = useState(initialReports);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(reportId: string) {
    setDeletingId(reportId);
    const res = await fetch(`/api/clients/${clientId}/reports/${reportId}`, { method: "DELETE" });
    setDeletingId(null);
    setConfirmingId(null);
    if (res.ok) {
      setReports((prev) => prev.filter((r) => r.id !== reportId));
      showToast("Report deleted.");
    } else {
      showToast("Could not delete the report. Please try again.", "error");
    }
  }

  if (reports.length === 0) {
    return <p className="text-[15px] text-dash-ink-secondary">No recent reports. Generate your first report above.</p>;
  }

  return (
    <div>
      <ul className="divide-y divide-dash-border rounded-lg border border-dash-border bg-dash-card">
        {reports.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
            <div className="min-w-0">
              <p className="truncate text-[15px] text-dash-ink">{reportLabel(r)}</p>
              <p className="mt-0.5 text-[13px] text-dash-ink-secondary">
                Generated {formatDate(r.createdAt)} · Week: {weekPeriodLabel(r)}
              </p>
            </div>

            {confirmingId === r.id ? (
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <span className="text-[13px] text-dash-ink-secondary">Delete this report? This cannot be undone.</span>
                <button
                  type="button"
                  onClick={() => handleDelete(r.id)}
                  disabled={deletingId === r.id}
                  className="rounded-md bg-dash-error px-3 py-1.5 text-[13px] font-semibold text-dash-sidebar hover:opacity-90 disabled:opacity-60"
                >
                  {deletingId === r.id ? "Deleting…" : "Confirm"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingId(null)}
                  className="rounded-md border border-dash-border px-3 py-1.5 text-[13px] text-dash-ink-secondary hover:bg-dash-bg"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex shrink-0 items-center gap-4">
                {r.status === "COMPLETE" && (
                  <a href={`/api/reports/${r.id}/download`} className="text-[13px] font-semibold text-dash-accent hover:underline">
                    Download
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setConfirmingId(r.id)}
                  className="text-[13px] font-semibold text-dash-error hover:underline"
                >
                  Delete
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[13px] text-dash-ink-secondary">Showing reports from the last 30 days.</p>
    </div>
  );
}
