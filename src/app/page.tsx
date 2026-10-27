import Link from "next/link";
import { auth } from "@/lib/auth";
import { PublicNav } from "@/components/public-nav";
import { BetaBanner } from "@/components/beta-banner";
import { JsonLd } from "@/components/json-ld";
import { HOME_JSON_LD, pageMetadata } from "@/lib/seo";
import dynamic from "next/dynamic";
import { HeroSection } from "@/components/home/hero-section";
import { HowItWorksSection } from "@/components/home/how-it-works-section";

const MetaWalkthroughPromoSection = dynamic(
  () => import("@/components/home/meta-walkthrough-promo-section").then((m) => m.MetaWalkthroughPromoSection),
  {
    loading: () => (
      <section className="border-y border-navy-border bg-navy-panel/40 px-6 py-16 sm:py-20" aria-hidden="true">
        <div className="mx-auto h-48 max-w-3xl animate-pulse rounded-lg bg-navy-border/30 sm:h-56" />
      </section>
    ),
  },
);
import { FeaturesSection } from "@/components/home/features-section";
import { TrustAndSocialProofStrip } from "@/components/home/trust-and-social-proof-strip";
import { ReportPreviewSection } from "@/components/home/report-preview-section";
import { SampleReportSection } from "@/components/home/sample-report-section";
import { LeadCaptureSection } from "@/components/home/lead-capture-section";
import { PricingTeaserStrip } from "@/components/home/pricing-teaser-strip";
import { TestimonialsSection } from "@/components/home/testimonials-section";
import { TryNextReportCtaSection } from "@/components/home/try-next-report-cta-section";
import { SpecialistTimeSavingsSection } from "@/components/home/specialist-time-savings-section";
import { getSocialProofStats } from "@/lib/social-proof-stats";

export const metadata = pageMetadata({
  title: "Meta Ads Weekly Report Automation for Agencies",
  description:
    "Meta ads weekly report template automation — upload Ads Manager CSV, get agency client reporting PowerPoint, live link, or Slides in minutes. Save specialist time. Free trial.",
  path: "/",
  keywords: [
    "meta ads weekly report template automation",
    "agency client reporting powerpoint",
    "meta ads csv to ppt",
    "automated client reporting",
  ],
});

export default async function Home() {
  const session = await auth();
  const loggedIn = !!session?.user;
  const socialProofInitial = await getSocialProofStats();

  return (
    <>
      <JsonLd data={HOME_JSON_LD} />
      <BetaBanner />
      <PublicNav loggedIn={loggedIn} />
      <main className="flex-1">
        <HeroSection loggedIn={loggedIn} />
        <SampleReportSection />
        <SpecialistTimeSavingsSection />
        <MetaWalkthroughPromoSection />
        <HowItWorksSection />
        <section aria-label="Platform connections" className="border-y border-navy-border bg-navy-panel/30 px-6 py-6">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
            <div><h2 className="text-base font-semibold text-ink">Platform connections</h2><p className="mt-1 text-sm text-ink-secondary">Meta Ads · Google Ads · Google Analytics (GA4) · TikTok Ads</p><p className="mt-1 text-xs text-ink-muted">Manage connections in Account Settings. Report generation currently supports manual Meta CSV; other platforms and API imports are awaiting testing.</p></div>
            <Link href="/account" className="text-sm font-semibold text-accent hover:underline">Manage connections →</Link>
          </div>
        </section>
        <FeaturesSection />
        <TrustAndSocialProofStrip initial={socialProofInitial} />
        <ReportPreviewSection />
        <TestimonialsSection />
        <LeadCaptureSection />
        <PricingTeaserStrip />
        <TryNextReportCtaSection loggedIn={loggedIn} />
      </main>
    </>
  );
}
