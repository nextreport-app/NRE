"use client";

import Link from "next/link";
import { sanitizeWizardReturnTo } from "@/lib/nre/client-settings-navigation";

export function WizardReturnBanner({
  clientId,
  returnTo,
}: {
  clientId: string;
  returnTo: string | null | undefined;
}) {
  const href = sanitizeWizardReturnTo(returnTo, clientId);
  if (!href) return null;

  return (
    <div className="mb-4 rounded-lg border border-[#f6ad55]/40 border-l-4 border-l-[#f6ad55] bg-dash-card/90 px-4 py-3 shadow-sm">
      <p className="text-[14px] leading-relaxed text-dash-ink-secondary">
        Updating budget for an in-progress report?{" "}
        <Link href={href} className="font-semibold text-dash-accent underline hover:no-underline">
          Return to report setup
        </Link>
        . Your CSV and choices are kept while this tab stays open; if you closed the wizard tab, start again from Import.
      </p>
    </div>
  );
}
