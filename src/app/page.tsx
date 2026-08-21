import { auth } from "@/lib/auth";
import { PublicNav } from "@/components/public-nav";
import { BetaBanner } from "@/components/beta-banner";
import { HeroSection } from "@/components/home/hero-section";
import { HowItWorksSection } from "@/components/home/how-it-works-section";
import { PainPointSection } from "@/components/home/pain-point-section";
import { FeaturesSection } from "@/components/home/features-section";
import { TrustStrip } from "@/components/home/trust-strip";
import { ReportPreviewSection } from "@/components/home/report-preview-section";
import { SampleReportSection } from "@/components/home/sample-report-section";
import { PricingCtaSection } from "@/components/home/pricing-cta-section";
import { BETA_HIDE_PRICING } from "@/lib/beta";

export default async function Home() {
  const session = await auth();
  const loggedIn = !!session?.user;

  return (
    <>
      <BetaBanner />
      <PublicNav loggedIn={loggedIn} />
      <main className="flex-1">
        <HeroSection loggedIn={loggedIn} />
        <HowItWorksSection />
        {/* Homepage copy/structure overhaul — the time-comparison section
            (the best copy on the page) moved up to position 3, right after
            the hero and the 3-step "how it works" — it used to sit near the
            bottom of the page, well past where most visitors scroll. */}
        <PainPointSection />
        <FeaturesSection />
        <TrustStrip />
        <ReportPreviewSection />
        <SampleReportSection />
        {/* BETA: hidden during beta period — restore before public launch (see lib/beta.ts's BETA_HIDE_PRICING) */}
        {!BETA_HIDE_PRICING && (
          <PricingCtaSection loggedIn={loggedIn} userEmail={session?.user?.email} userName={session?.user?.name} />
        )}
      </main>
    </>
  );
}
