import Link from "next/link";

const STEPS = [
  {
    number: "1",
    title: "Connect or upload",
    description:
      "Sync Meta, Google Ads, TikTok, or GA4 via official API — or upload a CSV export.",
  },
  {
    number: "2",
    title: "Confirm & review",
    description: "Select campaigns, verify objectives, and preview metric cards before you generate.",
  },
  {
    number: "3",
    title: "Generate & share",
    description: "Branded .pptx, live link, PDF, Google Drive, WhatsApp, or email — often under 2 minutes.",
  },
];

export function HowItWorksSection() {
  return (
    <section className="bg-navy px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center text-2xl font-semibold text-white sm:text-3xl">
          Client reports in three moves
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-ink-muted">
          The wizard has five detailed steps — here is the short version.
        </p>

        <div className="mt-12 grid gap-10 sm:grid-cols-3 sm:gap-8">
          {STEPS.map((step) => (
            <div key={step.number} className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-orange text-lg font-bold text-navy">
                {step.number}
              </div>
              <h3 className="mt-4 text-lg font-medium text-white">{step.title}</h3>
              <p className="mt-2 text-sm text-ink-muted">{step.description}</p>
            </div>
          ))}
        </div>

        <p className="mt-10 text-center text-sm">
          <Link href="/how-it-works" className="text-accent-orange hover:underline">
            See the full 5-step walkthrough →
          </Link>
        </p>
      </div>
    </section>
  );
}
