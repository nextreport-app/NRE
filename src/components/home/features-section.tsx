const FEATURES = [
  {
    icon: "✅",
    title: "Official platform APIs",
    description:
      "Meta Marketing API, Google Ads API, and GA4 Data API — connect your accounts and skip manual CSV exports.",
  },
  {
    icon: "📈",
    title: "GA4 website reporting",
    description:
      "Traffic, channels, landing pages, device and geo breakdowns — a full website performance deck alongside your ad reports.",
  },
  {
    icon: "🎯",
    title: "Auto-detects campaign objectives",
    description: "Identifies leads, purchases, traffic, reach and more — for Meta and Google Ads campaigns.",
  },
  {
    icon: "🤖",
    title: "AI-written summaries",
    description: "Every slide gets an AI-written summary and key insights — no manual writing.",
  },
  {
    icon: "📊",
    title: "CSV upload still supported",
    description: "Prefer a manual export? Standard Meta, Google Ads, and GA4 CSVs work when the recommended columns are included.",
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
  {
    icon: "🎵",
    title: "TikTok Ads reporting",
    description: "Our fourth platform — TikTok Ads reporting is in development and launching soon for US and global accounts.",
  },
];

export function FeaturesSection() {
  return (
    <section className="bg-navy-panel px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center text-2xl font-semibold text-white sm:text-3xl">
          Everything you need to send better reports
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-ink-muted">
          Meta Ads, Google Ads, GA4 website analytics — and TikTok Ads coming soon.
        </p>

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
