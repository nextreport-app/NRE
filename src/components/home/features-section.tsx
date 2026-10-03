const FEATURES = [
  {
    icon: "📊",
    title: "CSV upload",
    description:
      "Export Last 30 days or Previous month with Day breakdown from Ads Manager — the supported way to build Meta reports today.",
    live: true,
  },
  {
    icon: "🔌",
    title: "Meta Marketing API",
    description:
      "Hybrid sync: API delivery metrics plus your Ads Manager CSV for accurate lead Results — no guesswork from Insights alone.",
    live: true,
  },
  {
    icon: "🎯",
    title: "Auto-detects campaign objectives",
    description: "Identifies leads, purchases, traffic, reach and more — picks the right metrics for each Meta campaign.",
    live: true,
  },
  {
    icon: "🤖",
    title: "AI-written summaries",
    description: "Every slide gets an AI-written summary and key insights — no manual writing.",
    live: true,
  },
  {
    icon: "🔀",
    title: "Comparison reports",
    description: "Compare any two periods side by side, campaign by campaign — this week vs last week or a custom range.",
    live: true,
  },
  {
    icon: "🌐",
    title: "Share a browser link",
    description: "Clients open the report on any device, in any browser — no PowerPoint app needed.",
    live: true,
  },
  {
    icon: "📈",
    title: "GA4 website reporting",
    description: "Traffic, channels, landing pages, device and geo breakdowns — a full website performance deck.",
    live: false,
  },
  {
    icon: "🎵",
    title: "Google & TikTok Ads",
    description: "Same branded template and wizard flow — CSV upload when we open the next platforms.",
    live: false,
  },
];

export function FeaturesSection() {
  return (
    <section className="bg-navy-panel px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center text-2xl font-semibold text-white sm:text-3xl">
          Everything you need to send better Meta reports
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-ink-muted">
          Launching with Meta Ads first — Google Ads, TikTok, and GA4 launching soon.
        </p>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className={`rounded-xl border bg-navy p-6 ${feature.live ? "border-navy-border" : "border-navy-border/80 opacity-90"}`}
            >
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
