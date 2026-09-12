"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PreviousMonthCampaignSelector } from "@/components/previous-month-campaign-selector";
import {
  getPreviousMonthComparisonInfo,
  type PreviousMonthComparisonInfo,
} from "@/lib/nre/previous-month-data-status";

const ACCEPTED_FILE_TYPES = ".csv,.tsv,.txt,.xlsx,.xls,.ods";

function CalendarIcon() {
  return (
    <svg className="h-5 w-5 text-[#63b3ed]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
    </svg>
  );
}

function StatusBadge({ status }: { status: PreviousMonthComparisonInfo["status"] }) {
  if (status === "current") {
    return (
      <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400">
        Ready
      </span>
    );
  }
  if (status === "stale") {
    return (
      <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300">
        Update needed
      </span>
    );
  }
  return (
    <span className="rounded-full bg-dash-border px-2.5 py-0.5 text-[11px] font-semibold text-dash-ink-secondary">
      Optional
    </span>
  );
}

/**
 * Compact Previous Month Data block on wizard Step 1 — upload inline when missing
 * or stale; campaign checkboxes when data is ready (CSV upload or API auto-sync).
 */
export function PreviousMonthDataWizardPanel({
  clientId,
  clientTimezone,
  initialHasFile,
  initialUpdatedAt,
  initialCampaigns,
  initialSelectedCampaigns,
  onUploaded,
  onCampaignsChange,
}: {
  clientId: string;
  clientTimezone: string;
  initialHasFile: boolean;
  initialUpdatedAt: string | null;
  initialCampaigns: string[];
  initialSelectedCampaigns: string[] | null;
  onUploaded?: (meta?: { campaigns: string[]; selectedCampaigns: string[] }) => void;
  onCampaignsChange?: (meta: { campaigns: string[]; selectedCampaigns: string[] }) => void;
}) {
  const [hasFile, setHasFile] = useState(initialHasFile);
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt);
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[] | null>(initialSelectedCampaigns);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [campaignsExpanded, setCampaignsExpanded] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHasFile(initialHasFile);
    setUpdatedAt(initialUpdatedAt);
    setCampaigns(initialCampaigns);
    setSelectedCampaigns(initialSelectedCampaigns);
  }, [initialHasFile, initialUpdatedAt, initialCampaigns, initialSelectedCampaigns]);

  const info = getPreviousMonthComparisonInfo(hasFile, updatedAt, clientTimezone);
  const selectedCount = selectedCampaigns?.length ?? campaigns.length;

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
      const newCampaigns: string[] = Array.isArray(data.campaigns) ? data.campaigns : [];
      const newSelected: string[] = Array.isArray(data.selectedCampaigns) ? data.selectedCampaigns : newCampaigns;
      setHasFile(true);
      setUpdatedAt(new Date().toISOString());
      setCampaigns(newCampaigns);
      setSelectedCampaigns(newSelected);
      setCampaignsExpanded(true);
      onUploaded?.({ campaigns: newCampaigns, selectedCampaigns: newSelected });
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleSelectionChange(selected: string[]) {
    setSelectedCampaigns(selected);
    onCampaignsChange?.({ campaigns, selectedCampaigns: selected });
  }

  return (
    <div className="rounded-lg border border-dash-border bg-dash-bg/60 px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <CalendarIcon />
          <div>
            <p className="text-[14px] font-semibold text-white">Previous month comparison</p>
            <p className="mt-0.5 text-[12px] text-dash-ink-secondary">
              {info.status === "current"
                ? `${info.expectedMonthName} · ${selectedCount} of ${campaigns.length || "—"} campaigns selected`
                : `Optional row for ${info.expectedMonthName} on Monthly Overview`}
            </p>
          </div>
        </div>
        <StatusBadge status={info.status} />
      </div>

      <div className="mt-3 border-t border-dash-border pt-3">
        <PreviousMonthDataWizardContent
          clientId={clientId}
          info={info}
          uploading={uploading}
          error={error}
          inputRef={inputRef}
          onFileChange={handleFileChange}
          campaigns={campaigns}
          selectedCampaigns={selectedCampaigns}
          onSelectionChange={handleSelectionChange}
          campaignsExpanded={campaignsExpanded}
          onToggleCampaigns={() => setCampaignsExpanded((v) => !v)}
        />
      </div>
    </div>
  );
}

function PreviousMonthDataWizardContent({
  clientId,
  info,
  uploading,
  error,
  inputRef,
  onFileChange,
  campaigns,
  selectedCampaigns,
  onSelectionChange,
  campaignsExpanded,
  onToggleCampaigns,
}: {
  clientId: string;
  info: PreviousMonthComparisonInfo;
  uploading: boolean;
  error: string | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  campaigns: string[];
  selectedCampaigns: string[] | null;
  onSelectionChange: (selected: string[]) => void;
  campaignsExpanded: boolean;
  onToggleCampaigns: () => void;
}) {
  const manageHref = `/clients/${clientId}#previous-month-data`;
  const selectedCount = selectedCampaigns?.length ?? campaigns.length;

  if (info.status === "current") {
    return (
      <div className="space-y-3">
        <p className="text-[13px] leading-relaxed text-dash-ink-secondary">
          {info.expectedMonthName} data powers the previous-month row on Monthly Overview and month-vs-month
          comparisons.{" "}
          <Link href={manageHref} className="font-medium text-dash-accent hover:underline">
            Manage on client page
          </Link>
        </p>

        {campaigns.length > 0 ? (
          <div className="rounded-md border border-dash-border bg-dash-bg/80">
            <button
              type="button"
              onClick={onToggleCampaigns}
              className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
            >
              <span className="text-[13px] font-medium text-dash-ink">
                Campaigns for previous-month row
                <span className="ml-2 font-normal text-dash-ink-secondary">
                  ({selectedCount}/{campaigns.length} selected)
                </span>
              </span>
              <span className="text-[12px] text-dash-accent">{campaignsExpanded ? "Hide" : "Show"}</span>
            </button>
            {campaignsExpanded ? (
              <div className="border-t border-dash-border px-3 pb-3 pt-1">
                <PreviousMonthCampaignSelector
                  clientId={clientId}
                  campaigns={campaigns}
                  initialSelected={selectedCampaigns}
                  onSelectionChange={onSelectionChange}
                  compact
                />
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-[12px] text-dash-ink-secondary">No campaigns with spend were found in the previous month data.</p>
        )}
      </div>
    );
  }

  const needsUpload = info.status === "missing" || info.status === "stale";
  const title =
    info.status === "missing"
      ? `Add ${info.expectedMonthName} for the previous-month row`
      : `Update ${info.expectedMonthName} — file is from an older month`;

  return (
    <div className="space-y-2">
      <p className="text-[13px] font-medium text-[#f6ad55]">{title}</p>
      <p className="text-[13px] leading-relaxed text-dash-ink-secondary">
        Skip this if you don&apos;t need a previous-month row.{" "}
        <span className="text-dash-ink">Sync from API</span> auto-fetches last month when missing — or upload manually
        below.
      </p>
      {needsUpload ? (
        <label className="block">
          <span className="sr-only">Upload previous month CSV</span>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_FILE_TYPES}
            onChange={onFileChange}
            disabled={uploading}
            className="block w-full text-[13px] text-dash-ink-secondary file:mr-3 file:rounded-md file:border-0 file:bg-dash-border file:px-3 file:py-1.5 file:text-[13px] file:font-medium file:text-dash-ink hover:file:brightness-125 disabled:opacity-50"
          />
        </label>
      ) : null}
      {uploading ? <p className="text-[13px] text-dash-ink-secondary">Uploading…</p> : null}
      {error ? <p className="text-[13px] text-red-400">{error}</p> : null}
    </div>
  );
}
