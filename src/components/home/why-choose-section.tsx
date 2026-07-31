const REASONS = [
  {
    icon: "🎯",
    title: "Built for Indian agencies",
    description: "Priced in INR, built for how Indian agencies work. No expensive USD subscriptions.",
  },
  {
    icon: "⚡",
    title: "Faster than any tool",
    description: "While other tools need minutes of configuration, NextReport reads your CSV and just works.",
  },
  {
    icon: "🤖",
    title: "AI writes the insights",
    description: "Campaign summaries and key insights written by AI. No copy-pasting, no manual writing.",
  },
  {
    icon: "📊",
    title: "Meta + Google Ads",
    description: "Full reporting support for both platforms. More data sources coming soon.",
  },
];

export function WhyChooseSection() {
  return (
    <section className="bg-navy px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center text-2xl font-semibold text-white sm:text-3xl">
          Why agencies choose NextReport
        </h2>

        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {REASONS.map((reason) => (
            <div key={reason.title} className="rounded-xl border border-navy-border bg-navy-panel p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy text-xl" aria-hidden="true">
                {reason.icon}
              </span>
              <h3 className="mt-4 text-base font-semibold text-white">{reason.title}</h3>
              <p className="mt-1.5 text-sm text-ink-muted">{reason.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
