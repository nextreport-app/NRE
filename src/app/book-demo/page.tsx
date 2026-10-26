import Link from "next/link";
import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { auth } from "@/lib/auth";
import { PublicNav } from "@/components/public-nav";
import { BetaBanner } from "@/components/beta-banner";
import { BookDemoForm } from "@/components/book-demo-form";
import { MetaWalkthroughPromoSection } from "@/components/home/meta-walkthrough-promo-section";
import { pageMetadata } from "@/lib/seo";

const HomeWorkflowFilm = dynamic(
  () => import("@/components/home/home-workflow-film").then((m) => m.HomeWorkflowFilm),
  {
    loading: () => (
      <section className="border-t border-navy-border bg-navy px-6 py-16" aria-hidden="true">
        <div className="mx-auto h-48 max-w-3xl animate-pulse rounded-lg bg-navy-border/30 sm:h-56" />
      </section>
    ),
  },
);

export const metadata: Metadata = pageMetadata({
  title: "Book a Demo",
  description:
    "Schedule a live NextReport walkthrough — see Meta Ads reporting in under 2 minutes. We reply within one business day.",
  path: "/book-demo",
});

const DEMO_POINTS = [
  "Live walkthrough of the 4-step report wizard",
  "CSV workflow and report types for your agency",
  "Branded .pptx, live link, Google Slides, and Google Drive export",
  "Agency plan limits, client setup, and billing Q&A",
];

export default async function BookDemoPage() {
  const session = await auth();
  const loggedIn = !!session?.user;

  return (
    <>
      <BetaBanner />
      <PublicNav loggedIn={loggedIn} />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-[640px] px-6 py-16">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-accent-orange">Book a Demo</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">See NextReport in action</h1>
            <p className="mt-4 text-sm leading-relaxed text-ink-secondary">
              Tell us about your agency and what you report on. We&apos;ll schedule a live walkthrough — typically{" "}
              <span className="font-medium text-white">20–30 minutes</span> — and reply within one business day. No
              high-pressure sales; we focus on your CSV workflow and report types.
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
        </div>

        <MetaWalkthroughPromoSection
          kicker="Self-serve demo"
          title="Watch the product end-to-end (5 min)"
          lead="Same walkthrough we cover on live demos: export a day-wise Meta CSV, run the wizard, and deliver a branded deck."
          showFullGuideLink
        />
        <HomeWorkflowFilm />
      </main>
    </>
  );
}
