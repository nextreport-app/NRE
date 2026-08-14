"use client";

import { useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/toast";
import { shareReportUrl, formatReportDate } from "@/lib/report-list-shared";

export interface ReportHistoryItem {
  id: string;
  fileName: string | null;
  weekStart: string | null;
  weekEnd: string | null;
  status: string;
  reportType: string;
  createdAt: string; // ISO
  /** Report.shareToken — null for a report generated before this feature existed, or a COMPARISON report (share pages don't support that data shape yet — see lib/nre/share-report.ts's header). */
  shareToken: string | null;
  /** Report.displayName, already resolved to the auto-generated default (lib/nre/report-display-name.ts) when no custom name was saved — always a non-empty display string, never re-derived client-side. */
  displayName: string;
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
 *
 * Feature 4 — each row's name is inline-editable (pencil icon → text
 * input, Enter/blur to save) via PATCH /api/clients/[id]/reports/[reportId].
 * An empty save reverts to (and re-saves) the auto-generated default rather
 * than leaving a blank name.
 *
 * Feature 1 — "View all reports" link shown only when this client has more
 * reports than the 10 shown here (hasMoreReports, computed server-side by
 * comparing the client's total report count against this list's length).
 */
export function ReportHistoryList({
  clientId,
  initialReports,
  hasMoreReports = false,
}: {
  clientId: string;
  initialReports: ReportHistoryItem[];
  /** True when the client has reports beyond the ones shown here — see clients/[id]/page.tsx's total-count query. Drives the "View all reports →" link. */
  hasMoreReports?: boolean;
}) {
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

  function startEditing(r: ReportHistoryItem) {
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
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <input
                type="checkbox"
                checked={selectedIds.has(r.id)}
                onChange={() => toggleSelected(r.id)}
                aria-label={`Select ${r.displayName}`}
                className="h-4 w-4 shrink-0 rounded border-dash-border accent-dash-accent"
              />
              <div className="min-w-0 flex-1">
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
                  <a
                    href={`https://${shareReportUrl(r.shareToken)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[13px] font-semibold text-dash-accent hover:underline"
                  >
                    View in Browser
                  </a>
                )}
                {r.status === "COMPLETE" && r.shareToken && (
                  <button
                    type="button"
                    onClick={() => handleCopyShareLink(r.shareToken!)}
                    className="text-[13px] font-semibold text-dash-accent hover:underline"
                  >
                    Copy Link
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
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-[13px] text-dash-ink-secondary">Showing your {reports.length} most recent reports.</p>
        {hasMoreReports && (
          <Link href={`/clients/${clientId}/reports`} className="text-[13px] font-semibold text-dash-accent hover:underline">
            View all reports →
          </Link>
        )}
      </div>
    </div>
  );
}
