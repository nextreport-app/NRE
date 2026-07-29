const FEATURES = [
  {
    icon: "📊",
    title: "Auto-detects any CSV",
    description: "Works with any column layout from Meta or Google Ads exports.",
  },
  {
    icon: "🎯",
    title: "Smart objective detection",
    description: "Automatically identifies leads, purchases, traffic, reach and more.",
  },
  {
    icon: "🤖",
    title: "AI-written insights",
    description: "Campaign summaries and key insights written by AI for every slide.",
  },
  {
    icon: "☁️",
    title: "Google Drive sync",
    description: "Reports save directly to your Drive folder with a shareable link.",
  },
  {
    icon: "📱",
    title: "Meta and Google Ads",
    description: "Full support for both platforms in one tool.",
  },
  {
    icon: "⚡",
    title: "Under 3 minutes",
    description: "From CSV upload to downloaded report in minutes not hours.",
  },
];

export function FeaturesSection() {
  return (
    <section className="bg-navy-panel px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center text-2xl font-semibold text-white sm:text-3xl">
          Everything your agency needs for client reporting
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
