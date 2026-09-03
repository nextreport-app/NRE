const FEATURES = [
  {
    icon: "✅",
    title: "Official Meta & Google Ads APIs",
    description:
      "Approved for Meta Marketing API and Google Ads API — connect your accounts and skip the CSV export entirely.",
  },
  {
    icon: "🎯",
    title: "Auto-detects campaign objectives",
    description: "Identifies leads, purchases, traffic, reach and more — for both Meta and Google Ads.",
  },
  {
    icon: "🤖",
    title: "AI-written campaign summaries",
    description: "Every slide gets an AI-written summary and key insights — no manual writing.",
  },
  {
    icon: "📊",
    title: "CSV upload still supported",
    description: "Prefer a manual export? Standard Meta and Google Ads CSVs work when the recommended columns are included.",
  },
  {
    icon: "🔀",
    title: "Comparison reports",
    description: "Compare any two periods side by side, campaign by campaign — this week vs last week or a custom range.",
  },
  {
    icon: "🌐",
    title: "Share a browser link",
    description: "Clients open the report on any device, in any browser — no PowerPoint app needed.",
  },
];

export function FeaturesSection() {
  return (
    <section className="bg-navy-panel px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center text-2xl font-semibold text-white sm:text-3xl">
          Everything you need to send better reports
        </h2>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="rounded-xl border border-navy-border bg-navy p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy-panel text-xl" aria-hidden="true">
                {feature.icon}
              </span>
              <h3 className="mt-4 text-base font-semibold text-white">{feature.title}</h3>
              <p className="mt-1.5 text-sm text-ink-muted">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
