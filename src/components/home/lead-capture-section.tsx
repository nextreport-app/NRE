import Link from "next/link";
import { NewsletterSignup } from "@/components/newsletter-signup";
import { QuickEnquiryForm } from "@/components/quick-enquiry-form";

export function LeadCaptureSection() {
  return (
    <section className="border-t border-navy-border bg-navy-panel px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">Stay ahead on client reporting</h2>
          <p className="mt-3 text-base text-ink-muted">
            Join agencies using NextReport to ship polished Meta and Google Ads decks in minutes — not hours.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="rounded-xl border border-navy-border bg-navy p-6 sm:p-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-orange/15 text-accent-orange">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
                <path strokeLinecap="round" d="M4 4h16v16H4z" />
                <path strokeLinecap="round" d="m4 4 8 8 8-8" />
              </svg>
            </div>
            <h3 className="mt-4 text-lg font-semibold text-white">Get reporting tips in your inbox</h3>
            <p className="mt-2 text-sm text-ink-muted">
              Product updates, agency workflows, and ideas to make your monthly reports sharper. Unsubscribe anytime.
            </p>
            <div className="mt-5">
              <NewsletterSignup />
            </div>
          </div>

          <div className="rounded-xl border border-navy-border bg-navy p-6 sm:p-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-orange/15 text-accent-orange">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
                <path strokeLinecap="round" d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
              </svg>
            </div>
            <h3 className="mt-4 text-lg font-semibold text-white">Ask us anything</h3>
            <p className="mt-2 text-sm text-ink-muted">
              Demo, pricing, or a custom workflow for your agency — drop a quick note and we&apos;ll respond within one business day.
            </p>
            <div className="mt-5">
              <QuickEnquiryForm />
            </div>
            <p className="mt-4 text-xs text-ink-muted">
              Prefer email?{" "}
              <Link href="/contact" className="text-accent hover:underline">
                Full contact form →
              </Link>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
