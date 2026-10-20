import { auth } from "@/lib/auth";
import { PublicNav } from "@/components/public-nav";
import { BetaBanner } from "@/components/beta-banner";
import { JsonLd } from "@/components/json-ld";
import { HOME_JSON_LD, pageMetadata } from "@/lib/seo";
import { HeroSection } from "@/components/home/hero-section";
import { MetaWalkthroughPromoSection } from "@/components/home/meta-walkthrough-promo-section";
import { StoryAnimationSection } from "@/components/home/story-animation-section";
import { HowItWorksSection } from "@/components/home/how-it-works-section";
import { PainPointSection } from "@/components/home/pain-point-section";
import { FeaturesSection } from "@/components/home/features-section";
import { TrustAndSocialProofStrip } from "@/components/home/trust-and-social-proof-strip";
import { ReportPreviewSection } from "@/components/home/report-preview-section";
import { SampleReportSection } from "@/components/home/sample-report-section";
import { LeadCaptureSection } from "@/components/home/lead-capture-section";
import { PricingCtaSection } from "@/components/home/pricing-cta-section";
import { TestimonialsSection } from "@/components/home/testimonials-section";
import { ReferralBottomSection } from "@/components/home/referral-bottom-section";
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
        <MetaWalkthroughPromoSection />
        <StoryAnimationSection />
        <SpecialistTimeSavingsSection />
        <HowItWorksSection />
        <PainPointSection />
        <FeaturesSection />
        <TrustAndSocialProofStrip initial={socialProofInitial} />
        <ReportPreviewSection />
        <SampleReportSection />
        <TestimonialsSection />
        <LeadCaptureSection />
        <PricingCtaSection loggedIn={loggedIn} userEmail={session?.user?.email} userName={session?.user?.name} />
        <ReferralBottomSection />
        <TryNextReportCtaSection loggedIn={loggedIn} />
      </main>
    </>
  );
}
