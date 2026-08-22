export function PainPointSection() {
  return (
    <section className="border-t-4 border-accent-orange bg-navy px-6 py-20">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-[2rem] font-bold text-white">Stop spending hours on reporting every week</h2>
        <p className="mt-5 text-base leading-relaxed text-ink-muted">
          The average digital agency spends 25 minutes per client per week manually downloading data,
          formatting slides, and writing campaign summaries. With 10 clients that is 4+ hours every
          week on work that adds zero strategic value. NextReport does it in under 2 minutes.
        </p>

        <div className="mt-10 grid gap-6 sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-4">
          <div className="rounded-xl border border-navy-border bg-navy-panel p-6">
            <p className="text-xs uppercase tracking-wide text-ink-muted">Without NextReport</p>
            <p className="mt-2 text-xl font-semibold text-white">10 clients × 25 minutes</p>
            <p className="mt-1 text-sm font-medium text-red-400">= 4+ hours/week</p>
          </div>

          <div className="hidden text-2xl font-bold text-accent-orange sm:block" aria-hidden="true">
            →
          </div>
          <div className="text-xl font-bold text-accent-orange sm:hidden" aria-hidden="true">
            ↓
          </div>

          <div className="rounded-xl border border-accent-orange/50 bg-navy-panel p-6">
            <p className="text-xs uppercase tracking-wide text-ink-muted">With NextReport</p>
            <p className="mt-2 text-xl font-semibold text-white">10 clients × 2 minutes</p>
            <p className="mt-1 text-sm font-medium text-accent-orange">= 20 minutes/week</p>
          </div>
        </div>
      </div>
    </section>
  );
}
