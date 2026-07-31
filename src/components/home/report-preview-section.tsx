const METRICS = [
  { label: "AD SPEND", value: "₹68,450" },
  { label: "IMPRESSIONS", value: "2,84,600" },
  { label: "RESULTS", value: "1,192" },
  { label: "CTR", value: "3.8%" },
];

/** Pure HTML/CSS mock of a generated PPT slide — no image asset, matches the report's dark/metric-tile look. */
function MockSlidePreview() {
  return (
    <div className="mx-auto aspect-video w-full max-w-[640px] rounded-xl border border-navy-border bg-navy p-5 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6)] sm:p-8">
      <div className="flex h-full flex-col">
        <span className="text-[10px] font-medium uppercase tracking-wide text-ink-muted sm:text-xs">
          META ADS
        </span>
        <h3 className="mt-1 text-lg font-bold text-white sm:text-2xl">WEEKLY PERFORMANCE REPORT</h3>

        <div className="mt-4 grid flex-1 grid-cols-2 gap-2 sm:mt-6 sm:grid-cols-4 sm:gap-3">
          {METRICS.map((metric) => (
            <div key={metric.label} className="rounded-lg border border-navy-border bg-navy-panel p-2.5 sm:p-3">
              <p className="text-[9px] uppercase tracking-wide text-ink-muted sm:text-[11px]">{metric.label}</p>
              <p className="mt-1 text-sm font-semibold text-white sm:text-lg">{metric.value}</p>
            </div>
          ))}
        </div>

        <p className="mt-4 text-[11px] italic leading-relaxed text-ink-muted sm:text-xs">
          AI-written campaign summary preview text here...
        </p>
      </div>
    </div>
  );
}

export function ReportPreviewSection() {
  return (
    <section className="bg-navy-panel px-6 py-20">
      <div className="mx-auto max-w-5xl text-center">
        <h2 className="text-2xl font-semibold text-white sm:text-3xl">What your clients will receive</h2>
        <p className="mx-auto mt-3 max-w-2xl text-base text-ink-muted">
          A fully branded PowerPoint report with AI-written insights — automatically generated from your
          campaign data.
        </p>

        <div className="mt-12">
          <MockSlidePreview />
          <p className="mt-4 text-sm text-ink-muted">
            Generated in under 2 minutes. No design skills required.
          </p>
        </div>
      </div>
    </section>
  );
}
