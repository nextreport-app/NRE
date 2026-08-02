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
 * Fix 1 — the client detail page's report history, capped to the 10 most
 * recent reports server-side (see clients/[id]/page.tsx's own query,
 * `take: 10` ordered newest-first) — this component only ever renders what
 * it's handed, it doesn't re-filter or re-sort.
 *
 * Fix 2 — checkbox multi-select with a Select All row and bulk delete,
 * alongside the existing single-row delete (unchanged: a two-step inline
 * confirm swapping a row's action buttons for a Confirm/Cancel pair, rather
 * than a native confirm() dialog, so it can be styled and labeled exactly
 * as specified). Bulk delete uses the same inline-confirm pattern at the
 * list level and a single DELETE /api/clients/[id]/reports call.
 */
export function ReportHistoryList({ clientId, initialReports }: { clientId: string; initialReports: ReportHistoryItem[] }) {
  const { showToast } = useToast();
  const [reports, setReports] = useState(initialReports);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmingBulk, setConfirmingBulk] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  async function handleDelete(reportId: string) {
    setDeletingId(reportId);
    const res = await fetch(`/api/clients/${clientId}/reports/${reportId}`, { method: "DELETE" });
    setDeletingId(null);
    setConfirmingId(null);
    if (res.ok) {
      setReports((prev) => prev.filter((r) => r.id !== reportId));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(reportId);
        return next;
      });
      showToast("Report deleted.");
    } else {
      showToast("Could not delete the report. Please try again.", "error");
    }
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => (prev.size === reports.length ? new Set() : new Set(reports.map((r) => r.id))));
  }

  function toggleSelected(reportId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(reportId)) next.delete(reportId);
      else next.add(reportId);
      return next;
    });
  }

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    setBulkDeleting(true);
    const res = await fetch(`/api/clients/${clientId}/reports`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportIds: ids }),
    });
    setBulkDeleting(false);
    setConfirmingBulk(false);
    if (res.ok) {
      setReports((prev) => prev.filter((r) => !selectedIds.has(r.id)));
      setSelectedIds(new Set());
      showToast(`${ids.length} report${ids.length === 1 ? "" : "s"} deleted`);
    } else {
      showToast("Could not delete the selected reports. Please try again.", "error");
    }
  }

  if (reports.length === 0) {
    return <p className="text-[15px] text-dash-ink-secondary">No reports yet. Generate your first report above.</p>;
  }

  const allSelected = selectedIds.size === reports.length;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 px-1">
        <label className="flex items-center gap-2 text-[13px] font-medium text-dash-ink-secondary">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleSelectAll}
            className="h-4 w-4 rounded border-dash-border accent-dash-accent"
          />
          Select All
        </label>

        {selectedIds.size > 0 &&
          (confirmingBulk ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] text-dash-ink-secondary">
                Delete {selectedIds.size} report{selectedIds.size === 1 ? "" : "s"}? This cannot be undone.
              </span>
              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="rounded-md bg-dash-error px-3 py-1.5 text-[13px] font-semibold text-dash-sidebar hover:opacity-90 disabled:opacity-60"
              >
                {bulkDeleting ? "Deleting…" : "Confirm"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingBulk(false)}
                className="rounded-md border border-dash-border px-3 py-1.5 text-[13px] text-dash-ink-secondary hover:bg-dash-bg"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingBulk(true)}
              className="rounded-md bg-dash-error px-3 py-1.5 text-[13px] font-semibold text-dash-sidebar hover:opacity-90"
            >
              Delete Selected ({selectedIds.size})
            </button>
          ))}
      </div>

      <ul className="divide-y divide-dash-border rounded-lg border border-dash-border bg-dash-card">
        {reports.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
            <div className="flex min-w-0 items-center gap-3">
              <input
                type="checkbox"
                checked={selectedIds.has(r.id)}
                onChange={() => toggleSelected(r.id)}
                aria-label={`Select ${reportLabel(r)}`}
                className="h-4 w-4 shrink-0 rounded border-dash-border accent-dash-accent"
              />
              <div className="min-w-0">
                <p className="truncate text-[15px] text-dash-ink">{reportLabel(r)}</p>
                <p className="mt-0.5 text-[13px] text-dash-ink-secondary">
                  Generated {formatDate(r.createdAt)} · Week: {weekPeriodLabel(r)}
                </p>
              </div>
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
      <p className="mt-3 text-[13px] text-dash-ink-secondary">Showing your 10 most recent reports.</p>
    </div>
  );
}
