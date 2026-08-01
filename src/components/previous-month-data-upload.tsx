"use client";

import { useRef, useState } from "react";

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
 */
export function PreviousMonthDataUpload({
  clientId,
  initialFileName,
  initialUpdatedAt,
}: {
  clientId: string;
  initialFileName: string | null;
  /** ISO date string, or null if nothing has been uploaded yet. */
  initialUpdatedAt: string | null;
}) {
  const [fileName, setFileName] = useState(initialFileName);
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="rounded-lg border border-navy-border bg-navy-panel p-5">
      <div className="mb-3 space-y-2 text-xs text-ink-muted">
        <p>
          Upload your previous month campaign data at the start of each new month. This populates the
          comparison row in your Combined Total slide.
        </p>
        <p>
          <span className="font-medium text-ink-secondary">How to download:</span> In Meta Ads Manager,
          set the date range to the full previous month (e.g. July 1-31), set Time Increment to Monthly
          (not Day — monthly total only), then export and upload here.
        </p>
        <p>
          NextReport uses this automatically in every report for this client until you replace it with
          the next month&rsquo;s data.
        </p>
      </div>

      {fileName ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-navy-border bg-navy p-3">
          <div className="min-w-0">
            <p className="truncate text-sm text-white">{fileName}</p>
            {updatedAt && <p className="text-xs text-ink-muted">Uploaded {formatUploadDate(updatedAt)}</p>}
          </div>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="flex-none rounded-md border border-navy-border px-3 py-1.5 text-xs text-ink-secondary hover:bg-navy-border disabled:opacity-50"
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
            className="block w-full text-sm text-ink-secondary file:mr-4 file:rounded-md file:border-0 file:bg-navy-border file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:brightness-125 disabled:opacity-50"
          />
        </label>
      )}

      {uploading && <p className="mt-2 text-xs text-ink-muted">Uploading…</p>}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
