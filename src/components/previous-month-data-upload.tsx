"use client";

import { useEffect, useRef, useState } from "react";

const ACCEPTED_FILE_TYPES = ".csv,.tsv,.txt,.xlsx,.xls,.ods";

function formatUploadDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

/**
 * Previous Month Data — uploaded once per client, here on the client's own
 * page, and reused automatically by every report generated for this client
 * (see api/clients/[id]/reports/route.ts) instead of the old per-report
 * "Period CSV" upload. Immediate upload-on-select (no separate save step —
 * this section isn't part of the surrounding ClientForm) mirroring the
 * account settings page's Google Drive connect/disconnect widget more than
 * the client logo's stage-then-submit-with-the-form flow.
 *
 * Part 1 — the uploaded file's own campaigns get a simple checkbox list
 * (inline, right below the file info) so the user can exclude campaigns
 * they don't manage from the Combined Total table's Period row. All
 * pre-checked by default; each toggle saves immediately (same
 * immediate-save philosophy as the upload itself).
 */
export function PreviousMonthDataUpload({
  clientId,
  initialFileName,
  initialUpdatedAt,
  initialCampaigns,
  initialSelectedCampaigns,
}: {
  clientId: string;
  initialFileName: string | null;
  /** ISO date string, or null if nothing has been uploaded yet. */
  initialUpdatedAt: string | null;
  /** Every campaign found in the currently-uploaded file (server-parsed on page load) — empty when no file is uploaded. */
  initialCampaigns: string[];
  /** Client.previousMonthSelectedCampaigns, already parsed — null means "everything selected" (no exclusions saved yet). */
  initialSelectedCampaigns: string[] | null;
}) {
  const [fileName, setFileName] = useState(initialFileName);
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt);
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelectedCampaigns ?? initialCampaigns));
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [savingSelection, setSavingSelection] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);

  // Fix 2 — the master checkbox's "indeterminate" (dash) state can only be
  // set via the DOM property, not a JSX/HTML attribute, so it's applied
  // imperatively here whenever the selection changes relative to the full
  // campaign list.
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selected.size > 0 && selected.size < campaigns.length;
    }
  }, [selected, campaigns]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/clients/${clientId}/previous-month-data`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not upload file. Please try again.");
        return;
      }
      setFileName(data.fileName ?? file.name);
      setUpdatedAt(new Date().toISOString());
      const newCampaigns: string[] = Array.isArray(data.campaigns) ? data.campaigns : [];
      setCampaigns(newCampaigns);
      setSelected(new Set(newCampaigns));
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleDelete() {
    setError(null);
    setDeleting(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/previous-month-data`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not remove file. Please try again.");
        return;
      }
      setFileName(null);
      setUpdatedAt(null);
      setCampaigns([]);
      setSelected(new Set());
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  async function saveSelection(next: Set<string>) {
    setSelectionError(null);
    setSavingSelection(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/previous-month-data`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedCampaigns: Array.from(next) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSelectionError(data.error || "Could not save your selection. Please try again.");
      }
    } catch {
      setSelectionError("Could not reach the server. Please try again.");
    } finally {
      setSavingSelection(false);
    }
  }

  function toggleCampaign(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      void saveSelection(next);
      return next;
    });
  }

  /** Fix 2 — native checkbox semantics: checking selects every campaign, unchecking clears the selection. A click while indeterminate (some selected) always lands on `checked`, so this also covers "some → all" without special-casing it. */
  function handleSelectAllChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.checked ? new Set(campaigns) : new Set<string>();
    setSelected(next);
    void saveSelection(next);
  }

  return (
    <div className="rounded-lg border border-dash-border bg-dash-card p-5">
      <div className="mb-3 space-y-2 text-[13px] text-dash-ink-secondary">
        <p>
          Upload your previous month campaign data at the start of each new month. This populates the
          comparison row in your Combined Total slide.
        </p>
        <p>
          <span className="font-medium text-dash-ink-secondary">How to download:</span> In Meta Ads Manager,
          set the date range to the full previous month (e.g. July 1–31). Day breakdown is recommended; monthly
          totals also work for the comparison row.
        </p>
        <p>
          NextReport uses this automatically in every report for this client until you replace it with
          the next month&rsquo;s data.
        </p>
      </div>

      {fileName ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-dash-border bg-dash-bg p-3">
          <div className="min-w-0">
            <p className="truncate text-sm text-dash-ink">{fileName}</p>
            {updatedAt && <p className="text-[13px] text-dash-ink-secondary">Uploaded {formatUploadDate(updatedAt)}</p>}
          </div>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="flex-none rounded-md border border-dash-border px-3 py-1.5 text-[13px] text-dash-ink-secondary hover:bg-dash-border disabled:opacity-50"
          >
            {deleting ? "Removing…" : "Delete"}
          </button>
        </div>
      ) : (
        <label className="block">
          <span className="sr-only">Upload previous month data</span>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_FILE_TYPES}
            onChange={handleFileChange}
            disabled={uploading}
            className="block w-full text-sm text-dash-ink-secondary file:mr-4 file:rounded-md file:border-0 file:bg-dash-border file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-dash-ink hover:file:brightness-125 disabled:opacity-50"
          />
        </label>
      )}

      {uploading && <p className="mt-2 text-[13px] text-dash-ink-secondary">Uploading…</p>}
      {error && <p className="mt-2 text-[13px] text-red-400">{error}</p>}

      {/* Fix 1 can legitimately leave zero campaigns (a file where nothing had real spend) — say so explicitly rather than silently showing nothing below the file card. */}
      {fileName && campaigns.length === 0 && (
        <p className="mt-4 border-t border-dash-border pt-4 text-[13px] text-dash-ink-secondary">
          No campaigns with spend were found in this file.
        </p>
      )}

      {fileName && campaigns.length > 0 && (
        <div className="mt-4 border-t border-dash-border pt-4">
          <div className="mb-2 flex items-center justify-between">
            <label className="flex items-center gap-2 text-[13px] font-medium text-dash-ink">
              <input
                ref={selectAllRef}
                type="checkbox"
                checked={campaigns.length > 0 && selected.size === campaigns.length}
                onChange={handleSelectAllChange}
                className="h-4 w-4 accent-accent"
              />
              Select All
            </label>
            {savingSelection && <span className="text-[12px] text-dash-ink-secondary">Saving…</span>}
          </div>
          <p className="mb-2 text-[13px] text-dash-ink">
            {selected.size} of {campaigns.length} campaigns selected
          </p>
          <p className="mb-2 text-[12px] text-dash-ink-secondary">
            Uncheck any campaigns you don&rsquo;t manage — only checked campaigns are included in the
            Combined Total table&rsquo;s previous-month comparison.
          </p>
          <ul className="max-h-56 divide-y divide-dash-border overflow-y-auto rounded-md border border-dash-border">
            {campaigns.map((name) => (
              <li key={name} className="flex items-center gap-3 px-3 py-2">
                <input
                  type="checkbox"
                  id={`pmd-campaign-${name}`}
                  checked={selected.has(name)}
                  onChange={() => toggleCampaign(name)}
                  className="h-4 w-4 accent-accent"
                />
                <label htmlFor={`pmd-campaign-${name}`} className="cursor-pointer truncate text-[13px] text-dash-ink">
                  {name}
                </label>
              </li>
            ))}
          </ul>
          {selectionError && <p className="mt-2 text-[13px] text-red-400">{selectionError}</p>}
        </div>
      )}
    </div>
  );
}
