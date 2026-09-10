import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { PublicNav } from "@/components/public-nav";
import { BetaBanner } from "@/components/beta-banner";
import { BookDemoForm } from "@/components/book-demo-form";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Book a Demo",
  description:
    "Schedule a live NextReport walkthrough — see Meta, Google, TikTok, and GA4 reporting in under 2 minutes. We reply within one business day.",
  path: "/book-demo",
});

const DEMO_POINTS = [
  "Live walkthrough of the 5-step report wizard",
  "API sync vs CSV — whichever fits your workflow",
  "Branded .pptx, live link, PDF, and Google Drive export",
  "Agency plan limits, client setup, and billing Q&A",
];

export default async function BookDemoPage() {
  const session = await auth();
  const loggedIn = !!session?.user;

  return (
    <>
      <BetaBanner />
      <PublicNav loggedIn={loggedIn} />
      <main className="mx-auto w-full max-w-[640px] flex-1 px-6 py-16 pb-24 sm:pb-16">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent-orange">Book a Demo</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">See NextReport in action</h1>
          <p className="mt-4 text-sm leading-relaxed text-ink-secondary">
            Tell us about your agency and what you report on. We&apos;ll schedule a short live demo — usually within one
            business day.
          </p>
        </div>

        <ul className="mt-8 space-y-2 rounded-lg border border-navy-border bg-navy-panel p-5 text-sm text-ink-secondary">
          {DEMO_POINTS.map((point) => (
            <li key={point} className="flex gap-2">
              <span className="text-accent-orange" aria-hidden="true">
                ✓
              </span>
              <span>{point}</span>
            </li>
          ))}
        </ul>

        <div className="mt-8">
          <BookDemoForm />
        </div>

        <p className="mt-8 text-center text-sm text-ink-muted">
          General questions?{" "}
          <Link href="/contact" className="text-accent-orange hover:underline">
            Contact us
          </Link>{" "}
          instead.
        </p>
      </main>
    </>
  );
}
