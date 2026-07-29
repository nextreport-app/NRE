import { CurrencyPricing } from "@/components/currency-pricing";

export function PricingCtaSection({
  loggedIn,
  userEmail,
  userName,
}: {
  loggedIn: boolean;
  userEmail?: string | null;
  userName?: string | null;
}) {
  return (
    <section className="bg-navy px-6 py-20">
      <div className="mx-auto max-w-5xl text-center">
        <h2 className="text-2xl font-semibold text-white sm:text-3xl">Simple pricing for growing agencies</h2>
        <p className="mt-3 text-base text-ink-muted">Start free for 7 days. No credit card required.</p>

        <CurrencyPricing loggedIn={loggedIn} userEmail={userEmail} userName={userName} />

        <p className="mt-10 text-sm text-ink-muted">
          Need a demo? Email us at{" "}
          <a href="mailto:hello@nextreport.in" className="text-accent hover:underline">
            hello@nextreport.in
          </a>
        </p>
      </div>
    </section>
  );
}
