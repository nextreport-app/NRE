"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { PreviousMonthCampaignSelector } from "@/components/previous-month-campaign-selector";

const ACCEPTED_FILE_TYPES = ".csv,.tsv,.txt,.xlsx,.xls,.ods";

function formatUploadDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

/**
 * Previous Month Data — uploaded once per client, here on the client's own
 * page, and reused automatically by every report generated for this client
 * (see api/clients/[id]/reports/route.ts) instead of the old per-report
 * "Period CSV" upload.
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
  initialCampaigns: string[];
  initialSelectedCampaigns: string[] | null;
}) {
  const [fileName, setFileName] = useState(initialFileName);
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt);
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[] | null>(initialSelectedCampaigns);
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
      const newCampaigns: string[] = Array.isArray(data.campaigns) ? data.campaigns : [];
      const newSelected: string[] = Array.isArray(data.selectedCampaigns) ? data.selectedCampaigns : newCampaigns;
      setCampaigns(newCampaigns);
      setSelectedCampaigns(newSelected);
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
      setSelectedCampaigns(null);
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-[15px] leading-relaxed text-dash-ink-secondary">
        For Monthly reports, export last month&rsquo;s performance from Meta Ads Manager and upload it here once per
        calendar month. We add it as the previous-month comparison row on overview slides. API sync can also fetch this
        automatically.{" "}
        <Link href="/help/download" target="_blank" rel="noopener noreferrer" className="text-dash-accent underline hover:no-underline">
          CSV export guide →
        </Link>
      </p>

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

      {fileName && campaigns.length === 0 && (
        <p className="mt-4 border-t border-dash-border pt-4 text-[13px] text-dash-ink-secondary">
          No campaigns with spend were found in this file.
        </p>
      )}

      {fileName && campaigns.length > 0 && (
        <PreviousMonthCampaignSelector
          clientId={clientId}
          campaigns={campaigns}
          initialSelected={selectedCampaigns}
          onSelectionChange={setSelectedCampaigns}
        />
      )}
    </div>
  );
}
