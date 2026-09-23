"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast";
import {
  REPORT_BRANDING_MODE_LABELS,
  type ReportBrandingMode,
} from "@/lib/report-branding";

export function AccountSettingsForm({
  initialAgencyName,
  initialReportBrandingMode,
}: {
  initialAgencyName: string | null;
  initialReportBrandingMode: ReportBrandingMode;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [agencyName, setAgencyName] = useState(initialAgencyName ?? "");
  const [reportBrandingMode, setReportBrandingMode] = useState<ReportBrandingMode>(
    initialReportBrandingMode,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agencyName, reportBrandingMode }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      const message = data.error || "Something went wrong.";
      setError(message);
      showToast(message, "error");
      return;
    }

    showToast("Agency details saved.");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="mb-1 block text-sm text-dash-ink-secondary">Agency name</label>
        <input
          value={agencyName}
          onChange={(e) => setAgencyName(e.target.value)}
          placeholder="e.g. Bright Path Marketing"
          maxLength={150}
          className="w-full rounded-md border border-dash-border bg-dash-card px-3 py-2 text-sm text-dash-ink outline-none focus:border-dash-accent"
        />
        <p className="mt-1 text-[13px] text-dash-ink-secondary">
          Shown as &quot;Prepared by {agencyName || "..."}&quot; on every report&apos;s cover slide.
        </p>
      </div>

      <fieldset>
        <legend className="mb-2 block text-sm font-medium text-dash-ink-secondary">
          Branding on shared client reports
        </legend>
        <div className="space-y-2">
          {(Object.keys(REPORT_BRANDING_MODE_LABELS) as ReportBrandingMode[]).map((mode) => {
            const option = REPORT_BRANDING_MODE_LABELS[mode];
            const disabled = mode === "agency" && !agencyName.trim();
            return (
              <label
                key={mode}
                className={`flex cursor-pointer gap-3 rounded-md border px-3 py-3 ${
                  reportBrandingMode === mode
                    ? "border-dash-accent bg-dash-accent/5"
                    : "border-dash-border"
                } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
              >
                <input
                  type="radio"
                  name="reportBrandingMode"
                  value={mode}
                  checked={reportBrandingMode === mode}
                  disabled={disabled}
                  onChange={() => setReportBrandingMode(mode)}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-medium text-dash-ink">{option.title}</span>
                  <span className="mt-0.5 block text-[13px] leading-snug text-dash-ink-secondary">
                    {option.description}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        <p className="mt-2 text-[13px] text-dash-ink-secondary">
          Applies to live share links, PDF exports, and client emails for reports you generate from
          now on. Included on free trial, Agency, and Professional plans.
        </p>
      </fieldset>

      {error && <p className="text-sm text-dash-error">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-dash-accent px-4 py-2 text-sm font-medium text-dash-ink hover:bg-dash-accent-hover disabled:opacity-60"
      >
        {loading ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
