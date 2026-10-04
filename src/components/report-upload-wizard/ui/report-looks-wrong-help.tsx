import Link from "next/link";
import { SUPPORT_EMAIL } from "@/lib/site-links";
import { SupportTicketLink } from "@/components/support-ticket-link";

/** Shown on generate step — encourages Ads Manager comparison before support. */
export function ReportLooksWrongHelp({ clientId }: { clientId: string }) {
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-[14px] leading-relaxed text-dash-ink-secondary">
      <p className="font-medium text-white">Report looks wrong?</p>
      <p className="mt-1.5">
        In Ads Manager, open the same date range and export level you used for this CSV. Compare{" "}
        <span className="text-dash-ink">Amount spent</span> and{" "}
        <span className="text-dash-ink">Results</span> to the deck totals. Screenshot both if they
        differ.
      </p>
      <p className="mt-2">
        Then{" "}
        <SupportTicketLink clientId={clientId} className="text-dash-accent" /> or email{" "}
        <a href={`mailto:${SUPPORT_EMAIL}?subject=Report%20mismatch`} className="font-medium text-dash-accent underline hover:no-underline">
          {SUPPORT_EMAIL}
        </a>{" "}
        with the screenshots.{" "}
        <Link href="/help/download" className="font-medium text-dash-accent underline hover:no-underline">
          CSV export guide
        </Link>
      </p>
    </div>
  );
}
