"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  getPreviousMonthComparisonInfo,
  type PreviousMonthComparisonInfo,
} from "@/lib/nre/previous-month-data-status";

const ACCEPTED_FILE_TYPES = ".csv,.tsv,.txt,.xlsx,.xls,.ods";

/**
 * Compact Previous Month Data block on wizard Step 1 — upload inline when missing
 * or stale; a one-line status when current. Full campaign selection stays on the
 * client page.
 */
export function PreviousMonthDataWizardPanel({
  clientId,
  clientTimezone,
  initialHasFile,
  initialUpdatedAt,
  onUploaded,
}: {
  clientId: string;
  clientTimezone: string;
  initialHasFile: boolean;
  initialUpdatedAt: string | null;
  onUploaded?: () => void;
}) {
  const [hasFile, setHasFile] = useState(initialHasFile);
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHasFile(initialHasFile);
    setUpdatedAt(initialUpdatedAt);
  }, [initialHasFile, initialUpdatedAt]);

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
      setHasFile(true);
      setUpdatedAt(new Date().toISOString());
      onUploaded?.();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
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
}: {
  clientId: string;
  info: PreviousMonthComparisonInfo;
  uploading: boolean;
  error: string | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const manageHref = `/clients/${clientId}#previous-month-data`;

  if (info.status === "current") {
    return (
      <p className="text-[13px] leading-relaxed text-dash-ink-secondary">
        <span className="font-medium text-emerald-400">Previous month comparison ready</span>
        <span className="text-dash-ink-secondary"> — {info.expectedMonthName} data will appear in Combined Total. </span>
        <Link href={manageHref} className="font-medium text-dash-accent hover:underline">
          Manage on client page
        </Link>
      </p>
    );
  }

  const needsUpload = info.status === "missing" || info.status === "stale";
  const title =
    info.status === "missing"
      ? `Add ${info.expectedMonthName} for month-over-month comparison`
      : `Update comparison data for ${info.expectedMonthName}`;

  return (
    <div className="space-y-2">
      <p className="text-[14px] font-medium text-[#f6ad55]">{title}</p>
      <p className="text-[13px] leading-relaxed text-dash-ink-secondary">
        Upload once per month — powers the previous-month column in Combined Total. Export{" "}
        <span className="text-dash-ink">Last Month</span> from Meta with Day breakdown (monthly totals also work).
      </p>
      {needsUpload ? (
        <label className="block">
          <span className="sr-only">Upload previous month comparison CSV</span>
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
        Optional — skip if you don&apos;t need the comparison row.{" "}
        <Link href={manageHref} className="font-medium text-dash-accent hover:underline">
          Open full upload on client page
        </Link>
      </p>
    </div>
  );
}
