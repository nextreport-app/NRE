"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PreviousMonthCampaignSelector } from "@/components/previous-month-campaign-selector";
import {
  getPreviousMonthComparisonInfo,
  type PreviousMonthComparisonInfo,
} from "@/lib/nre/previous-month-data-status";

const ACCEPTED_FILE_TYPES = ".csv,.tsv,.txt,.xlsx,.xls,.ods";

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
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHasFile(initialHasFile);
    setUpdatedAt(initialUpdatedAt);
    setCampaigns(initialCampaigns);
    setSelectedCampaigns(initialSelectedCampaigns);
  }, [initialHasFile, initialUpdatedAt, initialCampaigns, initialSelectedCampaigns]);

  const info = getPreviousMonthComparisonInfo(hasFile, updatedAt, clientTimezone);

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
      />
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
}) {
  const manageHref = `/clients/${clientId}#previous-month-data`;

  if (info.status === "current") {
    return (
      <div className="space-y-3">
        <p className="text-[13px] leading-relaxed text-dash-ink-secondary">
          <span className="font-medium text-emerald-400">Previous month data ready</span>
          <span className="text-dash-ink-secondary">
            {" "}
            — {info.expectedMonthName} will appear in Monthly Overview and month-vs-month comparisons.{" "}
          </span>
          <Link href={manageHref} className="font-medium text-dash-accent hover:underline">
            Manage on client page
          </Link>
        </p>
        <PreviousMonthCampaignSelector
          clientId={clientId}
          campaigns={campaigns}
          initialSelected={selectedCampaigns}
          onSelectionChange={onSelectionChange}
          compact
        />
      </div>
    );
  }

  const needsUpload = info.status === "missing" || info.status === "stale";
  const title =
    info.status === "missing"
      ? `Add ${info.expectedMonthName} data for the previous month row`
      : `Update ${info.expectedMonthName} data for the previous month row`;

  return (
    <div className="space-y-2">
      <p className="text-[14px] font-medium text-[#f6ad55]">{title}</p>
      <p className="text-[13px] leading-relaxed text-dash-ink-secondary">
        Powers the previous-month row on Monthly Overview slides and month-vs-month comparisons. If you use{" "}
        <span className="text-dash-ink">Sync from API</span>, we auto-fetch last month when it&apos;s missing or stale;
        manual upload is only needed when you skip API sync or prefer your own export.
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
      <p className="text-[12px] text-dash-ink-secondary">
        Optional — skip if you don&apos;t need the previous month row. After sync or upload, uncheck campaigns you
        don&apos;t manage.
      </p>
    </div>
  );
}
