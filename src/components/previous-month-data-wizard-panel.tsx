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
  return null;
}

function collapsedHint(info: PreviousMonthComparisonInfo): string {
  if (info.status === "current") {
    return `${info.expectedMonthName} data is saved — turn on to include a previous-month row on Combined Total.`;
  }
  if (info.status === "stale") {
    return `Update ${info.expectedMonthName} CSV once this month, then turn on to add the comparison row.`;
  }
  return `Upload ${info.expectedMonthName} CSV once (or sync from API) to add a previous-month row on Combined Total.`;
}

/**
 * Compact Previous Month Data block on wizard Step 1 — collapsed by default;
 * expands when the user turns on "Include in report".
 */
export function PreviousMonthDataWizardPanel({
  clientId,
  clientTimezone,
  currencySymbol = "$",
  initialHasFile,
  initialUpdatedAt,
  initialCampaigns,
  initialSelectedCampaigns,
  initialCampaignSpend = {},
  includeInReport,
  onIncludeInReportChange,
  onUploaded,
  onCampaignsChange,
}: {
  clientId: string;
  clientTimezone: string;
  currencySymbol?: string;
  initialHasFile: boolean;
  initialUpdatedAt: string | null;
  initialCampaigns: string[];
  initialSelectedCampaigns: string[] | null;
  initialCampaignSpend?: Record<string, number>;
  includeInReport: boolean;
  onIncludeInReportChange: (include: boolean) => void;
  onUploaded?: (meta?: {
    campaigns: string[];
    selectedCampaigns: string[];
    campaignSpend?: Record<string, number>;
  }) => void;
  onCampaignsChange?: (meta: { campaigns: string[]; selectedCampaigns: string[] }) => void;
}) {
  const [hasFile, setHasFile] = useState(initialHasFile);
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt);
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[] | null>(initialSelectedCampaigns);
  const [campaignSpend, setCampaignSpend] = useState<Record<string, number>>(initialCampaignSpend);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHasFile(initialHasFile);
    setUpdatedAt(initialUpdatedAt);
    setCampaigns(initialCampaigns);
    setSelectedCampaigns(initialSelectedCampaigns);
    setCampaignSpend(initialCampaignSpend);
  }, [initialHasFile, initialUpdatedAt, initialCampaigns, initialSelectedCampaigns, initialCampaignSpend]);

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
      const newSpend =
        data.campaignSpend && typeof data.campaignSpend === "object"
          ? (data.campaignSpend as Record<string, number>)
          : {};
      setHasFile(true);
      setUpdatedAt(new Date().toISOString());
      setCampaigns(newCampaigns);
      setSelectedCampaigns(newSelected);
      setCampaignSpend(newSpend);
      onUploaded?.({ campaigns: newCampaigns, selectedCampaigns: newSelected, campaignSpend: newSpend });
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <CalendarIcon />
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-white">Previous month comparison</p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-dash-ink-secondary">
              {includeInReport
                ? info.status === "current"
                  ? `${info.expectedMonthName} · ${selectedCount} of ${campaigns.length || "—"} campaigns selected`
                  : `Set up ${info.expectedMonthName} for the Combined Total previous-month row`
                : collapsedHint(info)}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {!includeInReport && (info.status === "current" || info.status === "stale") ? (
            <StatusBadge status={info.status} />
          ) : null}
          <label className="flex cursor-pointer items-center gap-2">
            <span className="text-[12px] font-medium text-dash-ink-secondary">Include in report</span>
            <button
              type="button"
              role="switch"
              aria-checked={includeInReport}
              aria-expanded={includeInReport}
              onClick={() => onIncludeInReportChange(!includeInReport)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                includeInReport ? "bg-dash-accent" : "bg-dash-border"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  includeInReport ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </label>
          {includeInReport ? <StatusBadge status={info.status} /> : null}
        </div>
      </div>

      {includeInReport ? (
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
            campaignSpend={campaignSpend}
            currencySymbol={currencySymbol}
            onSelectionChange={handleSelectionChange}
          />
        </div>
      ) : null}
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
  campaignSpend,
  currencySymbol,
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
  campaignSpend: Record<string, number>;
  currencySymbol: string;
  onSelectionChange: (selected: string[]) => void;
}) {
  const manageHref = `/clients/${clientId}#previous-month-data`;
  const selectedCount = selectedCampaigns?.length ?? campaigns.length;

  if (info.status === "current") {
    return (
      <div className="space-y-3">
        <div className="space-y-1">
          <p className="text-[13px] leading-relaxed text-dash-ink-secondary">
            {info.expectedMonthName} data powers the previous-month row on Monthly Overview and month-vs-month
            comparisons.
          </p>
          <Link href={manageHref} className="inline-block text-[13px] font-medium text-dash-accent hover:underline">
            Manage on client page
          </Link>
        </div>

        {campaigns.length > 0 ? (
          <div className="rounded-md border border-dash-border bg-dash-bg/80 px-3 pb-3 pt-2">
            <p className="text-[13px] font-medium text-dash-ink">
              Campaigns for previous-month row
              <span className="ml-2 font-normal text-dash-ink-secondary">
                ({selectedCount}/{campaigns.length} selected)
              </span>
            </p>
            <div className="mt-2">
              <PreviousMonthCampaignSelector
                clientId={clientId}
                campaigns={campaigns}
                initialSelected={selectedCampaigns}
                campaignSpend={campaignSpend}
                currencySymbol={currencySymbol}
                onSelectionChange={onSelectionChange}
                compact
              />
            </div>
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
