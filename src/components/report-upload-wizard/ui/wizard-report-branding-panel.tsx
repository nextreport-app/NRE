"use client";

import Link from "next/link";
import type { ReportBrandingMode } from "@/lib/report-branding";
import {
  wizardCoverBrandingDisplay,
  wizardShareLinkBrandingDisplay,
} from "@/lib/report-branding-wizard-ui";

function DeliveryBadge({ children }: { children: string }) {
  return (
    <span className="inline-flex shrink-0 rounded-md bg-dash-accent/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-dash-accent">
      {children}
    </span>
  );
}

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
        From your account settings — used on this report&apos;s cover and share link.
      </p>

      <div className="mt-4 space-y-3">
        <div className="rounded-lg border border-dash-border bg-dash-bg/40 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <DeliveryBadge>PPT</DeliveryBadge>
            <h5 className="text-[14px] font-semibold text-dash-ink">PowerPoint cover slide</h5>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-dash-ink">{wizardCoverBrandingDisplay(agencyName)}</p>
        </div>

        <div className="rounded-lg border border-dash-border bg-dash-bg/40 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <DeliveryBadge>Link</DeliveryBadge>
            <h5 className="text-[14px] font-semibold text-dash-ink">Browser share link</h5>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-dash-ink">
            {wizardShareLinkBrandingDisplay(reportBrandingMode)}
          </p>
        </div>
      </div>

      {error ? <p className="mt-3 text-[13px] text-dash-error">{error}</p> : null}

      <p className="mt-4 text-[13px] text-dash-ink-secondary">
        <Link href="/account" target="_blank" rel="noopener noreferrer" className="font-medium text-dash-accent hover:underline">
          Account settings
        </Link>{" "}
        — change agency name, logo, or share branding.
      </p>
    </section>
  );
}
