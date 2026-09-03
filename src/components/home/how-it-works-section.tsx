const STEPS = [
  {
    number: "1",
    title: "Connect or upload",
    description:
      "Sync from Meta or Google Ads via official API — or upload a CSV export. Pick the path that suits your workflow.",
  },
  {
    number: "2",
    title: "Select campaigns and dates",
    description: "Filter to only the campaigns you manage. Choose your reporting period.",
  },
  {
    number: "3",
    title: "Download or share",
    description: "Get a branded PowerPoint or save directly to Google Drive with a shareable link.",
  },
];

export function HowItWorksSection() {
  return (
    <section className="bg-navy px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center text-2xl font-semibold text-white sm:text-3xl">
          Three steps to your weekly report
        </h2>

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
      </div>
    </section>
  );
}
