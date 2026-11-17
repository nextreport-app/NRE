"use client";
import { previousMonthNotificationKey, notifyPreviousMonthDataChanged } from "@/lib/previous-month-notifications";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PreviousMonthCampaignSelector } from "@/components/previous-month-campaign-selector";
import {
  getPreviousMonthComparisonInfo,
  type PreviousMonthComparisonInfo,
} from "@/lib/nre/previous-month-data-status";
import { resolvePreviousMonthUiSelection } from "@/lib/nre/merge-previous-month-selection";

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

/** Optional weekly-report content, configured on the final wizard step. */
export function PreviousMonthDataWizardPanel({
  clientId,
  uploadSessionId,
  onAvailabilityChange,
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
  onUploadingChange,
  onCampaignsChange,
}: {
  clientId: string;
  uploadSessionId?: string | null;
  onAvailabilityChange?: (ready: boolean) => void;
  clientTimezone: string;
  currencySymbol?: string;
  initialHasFile: boolean;
  initialUpdatedAt: string | null;
  initialCampaigns: string[];
  initialSelectedCampaigns: string[] | null;
  initialCampaignSpend?: Record<string, number>;
  includeInReport: boolean;
  onIncludeInReportChange: (include: boolean) => void;
  onUploadingChange?: (uploading: boolean) => void;
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
  const [checking, setChecking] = useState(!!uploadSessionId);
  const [verifiedReady, setVerifiedReady] = useState<boolean | null>(null);
  const [source, setSource] = useState<"import" | "stored">("stored");
  const callbacks = useRef({ onUploaded, onAvailabilityChange });
  useEffect(() => { callbacks.current = { onUploaded, onAvailabilityChange }; }, [onUploaded, onAvailabilityChange]);
  const snapshot = useRef("");
  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    let refreshAgain = false;
    async function refresh(force = false) {
      if (inFlight) { refreshAgain ||= force; return; }
      if (!force && document.visibilityState === "hidden") return;
      inFlight = true;
      try {
        const query = uploadSessionId ? `?uploadSessionId=${encodeURIComponent(uploadSessionId)}` : "";
        const res = await fetch(`/api/clients/${clientId}/previous-month-data${query}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setVerifiedReady(data.ready === true);
        setSource(data.source === "import" ? "import" : "stored");
        const key = JSON.stringify(data);
        if (snapshot.current === key) return;
        snapshot.current = key;
        setHasFile(data.ready === true);
        setCampaigns(data.campaigns ?? []);
        setSelectedCampaigns(data.selectedCampaigns ?? []);
        setCampaignSpend(data.campaignSpend ?? {});
        callbacks.current.onAvailabilityChange?.(data.ready === true);
        if (data.ready) callbacks.current.onUploaded?.({ campaigns: data.campaigns, selectedCampaigns: data.selectedCampaigns, campaignSpend: data.campaignSpend });
      } finally {
        inFlight = false;
        if (!cancelled) {
          setChecking(false);
          if (refreshAgain) { refreshAgain = false; void refresh(true).catch(() => undefined); }
        }
      }
    }
    const run = () => { void refresh().catch(() => undefined); };
    const onStorage = (event: StorageEvent) => {
      if (event.key === previousMonthNotificationKey(clientId)) void refresh(true).catch(() => undefined);
    };
    run();
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", run);
    document.addEventListener("visibilitychange", run);
    return () => { cancelled = true; window.removeEventListener("storage", onStorage); window.removeEventListener("focus", run); document.removeEventListener("visibilitychange", run); };
  }, [clientId, uploadSessionId]);

  useEffect(() => {
    // Synchronize facts refreshed by the parent after an external upload.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasFile(initialHasFile);
    setUpdatedAt(initialUpdatedAt);
    setCampaigns(initialCampaigns);
    setSelectedCampaigns(initialSelectedCampaigns);
    setCampaignSpend(initialCampaignSpend);
  }, [initialHasFile, initialUpdatedAt, initialCampaigns, initialSelectedCampaigns, initialCampaignSpend]);

  const info = getPreviousMonthComparisonInfo(hasFile, updatedAt, clientTimezone);
  if (verifiedReady !== null) info.status = verifiedReady ? "current" : "missing";
  const selectedCount =
    selectedCampaigns?.length ??
    resolvePreviousMonthUiSelection(campaigns, campaignSpend, null).selectedCampaigns.length;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);
    onUploadingChange?.(true);
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
      notifyPreviousMonthDataChanged(clientId);
      setVerifiedReady(true);
      setSource("stored");
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
      onUploadingChange?.(false);
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
            <p className="text-[14px] font-semibold text-white">Include previous-month totals</p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-dash-ink-secondary">
              {includeInReport
                ? info.status === "current"
                  ? `${info.expectedMonthName} · ${selectedCount} of ${campaigns.length || "—"} campaigns selected`
                  : `Add ${info.expectedMonthName} totals to Monthly Overview.`
                : "Add a full previous-month row to Monthly Overview."}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2">
            <button
              type="button"
              role="switch"
              aria-label="Include previous-month totals"
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
          {includeInReport && info.status === "current" ? <StatusBadge status={info.status} /> : null}
        </div>
      </div>

      {includeInReport && checking ? <p className="mt-3 text-[13px] text-dash-ink-secondary">Checking previous-month coverage…</p> : includeInReport ? (
        <div className="mt-3 border-t border-dash-border pt-3">
          <PreviousMonthDataWizardContent
            clientId={clientId}
            uploadSessionId={uploadSessionId}
            source={source}
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
  uploadSessionId,
  source,
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
  uploadSessionId?: string | null;
  source: "import" | "stored";
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
  const selectedCount =
    selectedCampaigns?.length ??
    resolvePreviousMonthUiSelection(campaigns, campaignSpend, null).selectedCampaigns.length;

  if (info.status === "current") {
    return (
      <div className="space-y-3">
        <div className="space-y-1">
          <p className="text-[13px] leading-relaxed text-dash-ink-secondary">
            {source === "import" ? `${info.expectedMonthName} data is already included in your import. No additional upload needed.` : `${info.expectedMonthName} data adds a full previous-month row to Monthly Overview.`}
          </p>
          <Link href={manageHref} target="_blank" rel="noopener noreferrer" className="inline-block text-[13px] font-medium text-dash-accent hover:underline">
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
                uploadSessionId={uploadSessionId}
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
      : `Update ${info.expectedMonthName} CSV`;

  return (
    <div className="space-y-2">
      <p className="text-[13px] font-medium text-[#f6ad55]">{title}</p>
      <p className="text-[13px] leading-relaxed text-dash-ink-secondary">
        Upload the full previous month&apos;s CSV to include its totals.
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
