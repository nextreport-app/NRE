import { auth } from "@/lib/auth";
import { PublicNav } from "@/components/public-nav";
import { BetaBanner } from "@/components/beta-banner";
import { JsonLd } from "@/components/json-ld";
import { HOME_JSON_LD, pageMetadata } from "@/lib/seo";
import { HeroSection } from "@/components/home/hero-section";
import { HowItWorksSection } from "@/components/home/how-it-works-section";
import { PainPointSection } from "@/components/home/pain-point-section";
import { FeaturesSection } from "@/components/home/features-section";
import { TrustStrip } from "@/components/home/trust-strip";
import { ReportPreviewSection } from "@/components/home/report-preview-section";
import { SampleReportSection } from "@/components/home/sample-report-section";
import { LeadCaptureSection } from "@/components/home/lead-capture-section";
import { PricingCtaSection } from "@/components/home/pricing-cta-section";
import { TestimonialsSection } from "@/components/home/testimonials-section";
import { V1PromiseSection } from "@/components/home/v1-promise-section";
import { DesignPartnerSection } from "@/components/home/design-partner-section";
import { CommunityReferralSection } from "@/components/home/community-referral-section";

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

  return (
    <>
      <JsonLd data={HOME_JSON_LD} />
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
        <V1PromiseSection />
        <FeaturesSection />
        <TrustStrip />
        <ReportPreviewSection />
        <SampleReportSection />
        <TestimonialsSection />
        <DesignPartnerSection />
        <CommunityReferralSection />
        <LeadCaptureSection />
        <PricingCtaSection loggedIn={loggedIn} userEmail={session?.user?.email} userName={session?.user?.name} />
      </main>
    </>
  );
}
