import { ComingSoonBadge } from "@/components/coming-soon-badge";

const FEATURES = [
  {
    icon: "✅",
    title: "Meta Marketing API",
    description:
      "Connect your Meta ad account and skip manual CSV exports — sync campaign data straight into the report wizard.",
    live: true,
  },
  {
    icon: "📊",
    title: "CSV upload",
    description:
      "Prefer a manual export? Standard Meta Ads Manager CSVs work when the recommended day-level columns are included.",
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
    description: "Same branded template and wizard flow — API sync or CSV upload when we open the next platforms.",
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
          Launching with Meta Ads first — Google Ads, TikTok, and GA4 follow once parity testing is complete.
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
              <h3 className="mt-4 flex flex-wrap items-center gap-2 text-base font-semibold text-white">
                {feature.title}
                {!feature.live ? <ComingSoonBadge compact={false} /> : null}
              </h3>
              <p className="mt-1.5 text-sm text-ink-muted">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
