import Link from "next/link";
import { MARKETING_TRY_CTA_HEADLINE } from "@/lib/product-positioning";

export function TryNextReportCtaSection({ loggedIn }: { loggedIn: boolean }) {
  return (
    <section className="border-t border-navy-border bg-navy-panel px-6 py-16 text-center">
      <h2 className="text-2xl font-semibold text-white sm:text-3xl">{MARKETING_TRY_CTA_HEADLINE}</h2>
      <p className="mx-auto mt-3 max-w-md text-sm text-ink-secondary">7-day free trial — no credit card required.</p>
      <div className="mt-6">
        <Link
          href={loggedIn ? "/clients" : "/signup"}
          className="inline-block rounded-md bg-accent-orange px-6 py-3 text-sm font-semibold text-navy hover:bg-accent-orange-hover"
        >
          {loggedIn ? "Go to Dashboard" : "Start free trial"}
        </Link>
      </div>
    </section>
  );
}
