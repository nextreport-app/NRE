import Link from "next/link";
import { QuickEnquiryForm } from "@/components/quick-enquiry-form";

export function LeadCaptureSection() {
  return (
    <section className="border-t border-navy-border bg-navy-panel px-6 py-12 sm:py-14">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-xl border border-navy-border bg-navy p-6 sm:flex sm:items-start sm:gap-10 sm:p-8">
          <div className="sm:max-w-xs sm:shrink-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-orange/15 text-accent-orange">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
                <path strokeLinecap="round" d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
              </svg>
            </div>
            <h2 className="mt-4 text-xl font-bold text-white sm:text-2xl">Ask us anything</h2>
            <p className="mt-2 text-sm text-ink-muted">
              Demo, pricing, or a feature question — drop a quick note and we&apos;ll respond within one business day.
            </p>
            <p className="mt-4 text-xs text-ink-muted">
              Prefer email?{" "}
              <Link href="/contact" className="text-accent hover:underline">
                Full contact form →
              </Link>
            </p>
          </div>
          <div className="mt-6 flex-1 sm:mt-0">
            <QuickEnquiryForm />
          </div>
        </div>
      </div>
    </section>
  );
}
