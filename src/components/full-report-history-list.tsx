"use client";

import { useState } from "react";
import { useToast } from "@/components/toast";
import { shareReportUrl, formatReportDate } from "@/lib/report-list-shared";

export interface FullReportHistoryItem {
  id: string;
  fileName: string | null;
  weekStart: string | null;
  weekEnd: string | null;
  status: string;
  reportType: string;
  createdAt: string; // ISO
  shareToken: string | null;
  /** Report.displayName, already resolved to the auto-generated default when no custom name was saved. */
  displayName: string;
  /** Client-timezone month/year label ("August 2026") — consecutive rows sharing this value are rendered under one date separator, computed server-side (clients/[id]/reports/page.tsx). */
  monthLabel: string;
}

const REPORT_TYPE_LABELS: Record<string, string> = {
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  COMPARISON: "Comparison",
};

function ReportTypeBadge({ reportType }: { reportType: string }) {
  return (
    <span className="rounded-full border border-dash-border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-dash-ink-secondary">
      {REPORT_TYPE_LABELS[reportType] ?? reportType}
    </span>
  );
}

function weekPeriodLabel(r: FullReportHistoryItem): string {
  return r.weekStart && r.weekEnd ? `${r.weekStart} – ${r.weekEnd}` : "—";
}

/**
 * Feature 1's full report history list — same row-level actions as the
 * Manage page's ReportHistoryList (select/bulk-delete/delete/rename/share),
 * plus month-separator grouping and a report-type badge per row. Kept as
 * its own component rather than sharing JSX with ReportHistoryList: the two
 * lists' layouts diverge enough (grouping, badges, no "showing N of" line,
 * different empty state handled by the parent page) that forcing one
 * component to cover both would need more prop-driven branching than it's
 * worth — the handful of truly-identical bits (shareReportUrl,
 * formatReportDate) already live in lib/report-list-shared.ts.
 */
export function FullReportHistoryList({ clientId, initialReports }: { clientId: string; initialReports: FullReportHistoryItem[] }) {
  const { showToast } = useToast();
  const [reports, setReports] = useState(initialReports);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmingBulk, setConfirmingBulk] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

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

  async function handleCopyShareLink(shareToken: string) {
    await navigator.clipboard.writeText(shareReportUrl(shareToken));
    showToast("Share link copied!");
  }

  function startEditing(r: FullReportHistoryItem) {
    setEditingId(r.id);
    setEditValue(r.displayName);
  }

  async function commitRename(reportId: string) {
    const trimmed = editValue.trim();
    setEditingId(null);
    const current = reports.find((r) => r.id === reportId);
    if (!trimmed || !current || trimmed === current.displayName) return;

    const res = await fetch(`/api/clients/${clientId}/reports/${reportId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: trimmed }),
    });
    if (res.ok) {
      setReports((prev) => prev.map((r) => (r.id === reportId ? { ...r, displayName: trimmed } : r)));
    } else {
      showToast("Could not rename the report. Please try again.", "error");
    }
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

  const allSelected = reports.length > 0 && selectedIds.size === reports.length;

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

      <div className="overflow-hidden rounded-lg border border-dash-border bg-dash-card">
        {reports.map((r, i) => {
          const showSeparator = i === 0 || reports[i - 1].monthLabel !== r.monthLabel;
          return (
            <div key={r.id}>
              {showSeparator && (
                <div className="border-b border-t border-dash-border bg-dash-bg px-4 py-1.5 text-[12px] font-semibold uppercase tracking-wide text-dash-ink-secondary first:border-t-0">
                  {r.monthLabel}
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-dash-border px-4 py-3.5 last:border-b-0">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(r.id)}
                    onChange={() => toggleSelected(r.id)}
                    aria-label={`Select ${r.displayName}`}
                    className="h-4 w-4 shrink-0 rounded border-dash-border accent-dash-accent"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {editingId === r.id ? (
                        <input
                          autoFocus
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => commitRename(r.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              commitRename(r.id);
                            } else if (e.key === "Escape") {
                              setEditingId(null);
                            }
                          }}
                          className="w-full max-w-sm rounded border border-dash-accent bg-dash-bg px-2 py-0.5 text-[15px] text-dash-ink outline-none"
                        />
                      ) : (
                        <p className="flex items-center gap-1.5 text-[15px] text-dash-ink">
                          <span className="truncate">{r.displayName}</span>
                          <button
                            type="button"
                            onClick={() => startEditing(r)}
                            aria-label={`Rename ${r.displayName}`}
                            className="shrink-0 text-[12px] text-dash-ink-secondary hover:text-dash-ink"
                          >
                            ✏️
                          </button>
                        </p>
                      )}
                      <ReportTypeBadge reportType={r.reportType} />
                    </div>
                    <p className="mt-0.5 text-[13px] text-dash-ink-secondary">
                      Generated {formatReportDate(r.createdAt)} · Week: {weekPeriodLabel(r)}
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
                    {r.status === "COMPLETE" && r.shareToken && (
                      <button
                        type="button"
                        onClick={() => handleCopyShareLink(r.shareToken!)}
                        className="text-[13px] font-semibold text-dash-accent hover:underline"
                      >
                        Share Link
                      </button>
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
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
