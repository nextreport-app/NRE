"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast";
import {
  REPORT_BRANDING_MODE_LABELS,
  type ReportBrandingMode,
} from "@/lib/report-branding";

const ACCEPTED_LOGO_TYPES = "image/png,image/jpeg,image/webp,image/svg+xml";
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export function AccountSettingsForm({
  initialAgencyName,
  initialReportBrandingMode,
  hasAgencyLogo = false,
}: {
  initialAgencyName: string | null;
  initialReportBrandingMode: ReportBrandingMode;
  hasAgencyLogo?: boolean;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [agencyName, setAgencyName] = useState(initialAgencyName ?? "");
  const [reportBrandingMode, setReportBrandingMode] = useState<ReportBrandingMode>(
    initialReportBrandingMode,
  );
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const logoPreviewSrc =
    logoPreviewUrl ?? (hasAgencyLogo && !removeLogo ? "/api/account/logo" : null);

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

    if (logoFile) {
      const logoFormData = new FormData();
      logoFormData.append("logo", logoFile);
      const logoRes = await fetch("/api/account/logo", { method: "POST", body: logoFormData });
      if (!logoRes.ok) {
        const logoData = await logoRes.json().catch(() => ({}));
        const message = logoData.error || "Settings saved, but the logo upload failed.";
        showToast(message, "error");
        router.refresh();
        return;
      }
    } else if (removeLogo) {
      await fetch("/api/account/logo", { method: "DELETE" });
    }

    showToast("Agency details saved.");
    router.refresh();
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    setLogoError(null);
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError("Logo file must be 2MB or smaller.");
      return;
    }
    setLogoFile(file);
    setRemoveLogo(false);
    setLogoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }

  function handleRemoveLogo() {
    setLogoFile(null);
    setLogoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setRemoveLogo(true);
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

      <div>
        <label className="mb-1 block text-sm text-dash-ink-secondary">Agency logo — optional</label>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept={ACCEPTED_LOGO_TYPES}
            onChange={handleLogoChange}
            className="max-w-full text-sm text-dash-ink-secondary file:mr-3 file:rounded-md file:border-0 file:bg-dash-border file:px-3 file:py-1.5 file:text-sm file:text-dash-ink"
          />
          {((hasAgencyLogo && !removeLogo) || logoFile) && (
            <button
              type="button"
              onClick={handleRemoveLogo}
              className="text-sm text-dash-error hover:underline"
            >
              Remove logo
            </button>
          )}
        </div>
        {logoPreviewSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoPreviewSrc} alt="Agency logo preview" className="mt-3 h-12 w-auto max-w-[200px] object-contain" />
        )}
        {logoError && <p className="mt-1 text-sm text-dash-error">{logoError}</p>}
        <p className="mt-1 text-[13px] text-dash-ink-secondary">
          Shown in the header on shared client reports when &quot;Show my agency name&quot; is selected. PNG, JPG, WebP, or SVG — max 2MB.
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
