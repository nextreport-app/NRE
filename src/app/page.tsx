import { auth } from "@/lib/auth";
import { HeroSection } from "@/components/home/hero-section";
import { HowItWorksSection } from "@/components/home/how-it-works-section";
import { FeaturesSection } from "@/components/home/features-section";
import { PainPointSection } from "@/components/home/pain-point-section";
import { PricingCtaSection } from "@/components/home/pricing-cta-section";

export default async function Home() {
  const session = await auth();
  const loggedIn = !!session?.user;

  return (
    <main className="flex-1">
      <HeroSection loggedIn={loggedIn} />
      <HowItWorksSection />
      <FeaturesSection />
      <PainPointSection />
      <PricingCtaSection loggedIn={loggedIn} userEmail={session?.user?.email} userName={session?.user?.name} />
    </main>
  );
}
