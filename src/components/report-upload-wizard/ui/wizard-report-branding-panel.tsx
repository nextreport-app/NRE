"use client";

import Link from "next/link";
import type { ReportBrandingMode } from "@/lib/report-branding";
import { wizardUnifiedBrandingDisplay } from "@/lib/report-branding-wizard-ui";

export function WizardReportBrandingPanel({
  agencyName,
  reportBrandingMode,
  error,
}: {
  agencyName: string;
  reportBrandingMode: ReportBrandingMode;
  error?: string | null;
}) {
  return (
    <section className="rounded-lg border border-dash-border bg-dash-card p-4">
      <h4 className="text-[15px] font-semibold text-dash-ink">Agency &amp; white-label branding</h4>
      <p className="mt-1 text-[13px] leading-snug text-dash-ink-secondary">
        From your account settings — the same credit on the deck, live link, and client emails.
      </p>

      <p className="mt-4 rounded-lg border border-dash-border bg-dash-bg/40 p-4 text-[13px] leading-relaxed text-dash-ink">
        {wizardUnifiedBrandingDisplay(reportBrandingMode, agencyName)}
      </p>

      {error ? <p className="mt-3 text-[13px] text-dash-error">{error}</p> : null}

      <p className="mt-4 text-[13px] text-dash-ink-secondary">
        <Link href="/account" target="_blank" rel="noopener noreferrer" className="font-medium text-dash-accent hover:underline">
          Account settings
        </Link>{" "}
        — change branding for all future reports.
      </p>
    </section>
  );
}
