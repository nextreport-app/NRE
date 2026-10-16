"use client";

/** Decorative about hero — soft motion + deck mock (Modal company-page style, no stock photo). */
export function AboutHeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-md lg:max-w-none">
      <div
        className="nre-about-hero-glow pointer-events-none absolute -inset-6 rounded-[2rem] opacity-80"
        aria-hidden
      />
      <div className="nre-keep-dark-surface relative overflow-hidden rounded-2xl border border-navy-border bg-[#0d1b2e] p-6 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.55)]">
        <div className="flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-ink-muted">
          <span>Agency workflow</span>
          <span className="text-accent-orange">Meta · CSV → deck</span>
        </div>
        <p className="mt-4 text-lg font-semibold text-white">Weekly client deck</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {[
            { label: "Ad spend", value: "$12.4k" },
            { label: "Leads", value: "186" },
            { label: "CPL", value: "$66.7" },
            { label: "Reach", value: "842k" },
          ].map((m) => (
            <div key={m.label} className="rounded-lg border border-[#1e3a5f] bg-[#111f35] px-3 py-2">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-[#f5b45a]">{m.label}</p>
              <p className="mt-1 text-sm font-bold text-white">{m.value}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {["PowerPoint", "Live link", "Google Slides"].map((chip) => (
            <span
              key={chip}
              className="rounded-full border border-accent-orange/35 bg-accent-orange/10 px-2.5 py-0.5 text-[10px] font-medium text-accent-orange"
            >
              {chip}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
