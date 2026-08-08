import { auth } from "@/lib/auth";
import { PublicNav } from "@/components/public-nav";
import { BetaBanner } from "@/components/beta-banner";
import { HeroSection } from "@/components/home/hero-section";
import { HowItWorksSection } from "@/components/home/how-it-works-section";
import { FeaturesSection } from "@/components/home/features-section";
import { ReportPreviewSection } from "@/components/home/report-preview-section";
import { WhyChooseSection } from "@/components/home/why-choose-section";
import { TestimonialsSection } from "@/components/home/testimonials-section";
import { PainPointSection } from "@/components/home/pain-point-section";
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
        <FeaturesSection />
        <ReportPreviewSection />
        <WhyChooseSection />
        <TestimonialsSection />
        <PainPointSection />
        {/* BETA: hidden during beta period — restore before public launch (see lib/beta.ts's BETA_HIDE_PRICING) */}
        {!BETA_HIDE_PRICING && (
          <PricingCtaSection loggedIn={loggedIn} userEmail={session?.user?.email} userName={session?.user?.name} />
        )}
      </main>
    </>
  );
}
