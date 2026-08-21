"use client";

import { useState } from "react";

const SLIDE_BG = "#0d1b2e";
const ACCENT = "#f6ad55";

function SlideHeader({ label }: { label: string }) {
  return (
    <span className="text-[10px] font-medium uppercase tracking-wide text-ink-muted sm:text-xs">{label}</span>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-navy-border bg-navy-panel p-2.5 sm:p-3">
      <p className="text-[9px] uppercase tracking-wide text-ink-muted sm:text-[11px]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white sm:text-lg">{value}</p>
    </div>
  );
}

function TextBox({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-lg border border-navy-border bg-navy-panel p-3">
      <p className="text-[9px] font-semibold uppercase tracking-wide sm:text-[10px]" style={{ color: ACCENT }}>
        {label}
      </p>
      <p className="mt-1.5 text-[11px] leading-relaxed text-ink-secondary sm:text-xs">{text}</p>
    </div>
  );
}

/** Slide 1 — Campaign Summary. */
function CampaignSummarySlide() {
  return (
    <div className="flex h-full flex-col">
      <SlideHeader label="META ADS · WEEKLY PERFORMANCE REPORT" />
      <h3 className="mt-1 text-base font-bold text-white sm:text-xl">Coastal Skin Co. — Lead Generation (Campaign)</h3>
      <p className="mt-0.5 text-[11px] text-ink-muted sm:text-xs">July 18 - July 24, 2026</p>

      <div className="mt-3 grid grid-cols-3 gap-2 sm:mt-4 sm:gap-3">
        <MetricCard label="AD SPEND" value="$284" />
        <MetricCard label="IMPRESSIONS" value="48,291" />
        <MetricCard label="REACH" value="22,403" />
        <MetricCard label="LEADS" value="47" />
        <MetricCard label="COST PER LEAD" value="$6.04" />
        <MetricCard label="CTR (ALL)" value="2.84%" />
      </div>

      <div className="mt-3 grid flex-1 gap-2 sm:mt-4 sm:grid-cols-2 sm:gap-3">
        <TextBox
          label="Campaign Summary"
          text="During July 18-24, the campaign generated 47 leads at a $6.04 cost per lead, reaching 22,403 people with 48,291 impressions."
        />
        <TextBox
          label="Key Insights"
          text="Lead volume increased this week with strong CTR performance. To maximise results, budget will shift toward top-performing ads while targeting is refined."
        />
      </div>
    </div>
  );
}

/** Slide 2 — Ad Set. */
function AdSetSlide() {
  return (
    <div className="flex h-full flex-col">
      <SlideHeader label="META ADS · WEEKLY PERFORMANCE REPORT" />
      <h3 className="mt-1 text-base font-bold text-white sm:text-xl">Coastal Skin Co. — Interest Based Targeting (Ad Set)</h3>
      <p className="mt-0.5 text-[11px] text-ink-muted sm:text-xs">July 18 - July 24, 2026</p>

      <div className="mt-4 grid flex-1 grid-cols-3 gap-2 sm:mt-6 sm:gap-3">
        <MetricCard label="AD SPEND" value="$156" />
        <MetricCard label="IMPRESSIONS" value="28,441" />
        <MetricCard label="REACH" value="14,203" />
        <MetricCard label="LEADS" value="31" />
        <MetricCard label="COST PER LEAD" value="$5.03" />
        <MetricCard label="CTR (ALL)" value="3.12%" />
      </div>
    </div>
  );
}

function DonutCircle({ percent, color }: { percent: number; color: string }) {
  return (
    <div
      className="mx-auto h-20 w-20 rounded-full sm:h-24 sm:w-24"
      style={{ background: `conic-gradient(${color} 0% ${percent}%, #1e3a5f ${percent}% 100%)` }}
      aria-hidden="true"
    >
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-navy text-xs font-semibold text-white sm:h-16 sm:w-16">
          {percent}%
        </div>
      </div>
    </div>
  );
}

/** Slide 3 — MTD Campaign Performance chart. */
function MtdChartSlide() {
  return (
    <div className="flex h-full flex-col">
      <SlideHeader label="META ADS · MONTHLY PERFORMANCE REPORT" />
      <h3 className="mt-1 text-base font-bold text-white sm:text-xl">MTD Campaign Performance</h3>

      <div className="mt-4 grid flex-1 grid-cols-2 items-center gap-4 sm:mt-6">
        <div className="text-center">
          <DonutCircle percent={78} color={ACCENT} />
          <p className="mt-2 text-[11px] font-medium text-white sm:text-xs">Coastal Skin Co. — Lead Gen</p>
          <p className="text-[10px] text-ink-muted sm:text-[11px]">$284 spend · 78% of budget</p>
        </div>
        <div className="text-center">
          <DonutCircle percent={22} color="#63b3ed" />
          <p className="mt-2 text-[11px] font-medium text-white sm:text-xs">Coastal Skin Co. — Retargeting</p>
          <p className="text-[10px] text-ink-muted sm:text-[11px]">$82 spend · 22% of budget</p>
        </div>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-[10px] text-ink-muted sm:text-[11px]">
          <span>Spend proportion</span>
          <span>$366 total</span>
        </div>
        <div className="mt-1 flex h-2.5 overflow-hidden rounded-full bg-navy-panel">
          <div className="h-full" style={{ width: "78%", background: ACCENT }} />
          <div className="h-full" style={{ width: "22%", background: "#63b3ed" }} />
        </div>
      </div>
    </div>
  );
}

const COMBINED_ROWS = [
  { month: "June 2026", spend: "$1,840", reach: "89,234", impressions: "198,441", ctr: "2.41%", cpc: "$1.23", leads: "187", cpl: "$9.84" },
  { month: "July 1 - July 24 MTD", spend: "$366", reach: "65,858", impressions: "76,732", ctr: "2.93%", cpc: "$1.18", leads: "63", cpl: "$5.81" },
];

/**
 * Slide 4 — Campaign Overview Combined Total. The widest slide in the
 * carousel (8-column table) — needs its own mobile handling that the other
 * 3 slides don't. `min-w-0` on every level from the slide root down to the
 * table itself is load-bearing: without it, a flex item's default
 * `min-width: auto` lets a descendant's intrinsic content width (the table)
 * bubble all the way up and stretch the whole carousel row wider than the
 * viewport, even though `overflow-x-auto`/`overflow-x-hidden` is set on the
 * table wrapper — that only clips/scrolls content within a box that's
 * already sized correctly, it doesn't prevent the box itself from growing.
 * Below md (768px): 8px table text, tighter cell padding, and the 4
 * lowest-priority columns (Reach, Impressions, CTR, CPC) hidden entirely
 * rather than squeezed, so the remaining 4 columns (Month, Ad Spend, Leads,
 * Cost Per Lead) have room to sit on one line without wrapping.
 */
function CombinedTotalSlide() {
  return (
    <div className="flex h-full min-w-0 flex-col overflow-x-hidden">
      <SlideHeader label="META ADS · MONTHLY PERFORMANCE REPORT" />
      <h3 className="mt-1 text-base font-bold text-white sm:text-xl">Campaign Overview — Combined Total</h3>

      <div className="mt-4 min-w-0 flex-1 overflow-x-hidden sm:mt-6 md:overflow-x-auto">
        <table className="w-full min-w-0 border-collapse text-left text-[8px] break-words md:min-w-[520px] md:text-[11px]">
          <thead>
            <tr className="border-b border-navy-border" style={{ color: ACCENT }}>
              <th className="py-1.5 pr-1 font-semibold uppercase tracking-wide md:py-2 md:pr-2">Month</th>
              <th className="py-1.5 pr-1 font-semibold uppercase tracking-wide whitespace-nowrap md:py-2 md:pr-2">
                Ad Spend
              </th>
              <th className="hidden py-2 pr-2 font-semibold uppercase tracking-wide md:table-cell">Reach</th>
              <th className="hidden py-2 pr-2 font-semibold uppercase tracking-wide md:table-cell">Impressions</th>
              <th className="hidden py-2 pr-2 font-semibold uppercase tracking-wide md:table-cell">CTR</th>
              <th className="hidden py-2 pr-2 font-semibold uppercase tracking-wide md:table-cell">CPC</th>
              <th className="py-1.5 pr-1 font-semibold uppercase tracking-wide whitespace-nowrap md:py-2 md:pr-2">
                Leads
              </th>
              <th className="py-1.5 font-semibold uppercase tracking-wide whitespace-nowrap md:py-2">
                Cost Per Lead
              </th>
            </tr>
          </thead>
          <tbody>
            {COMBINED_ROWS.map((row) => (
              <tr key={row.month} className="border-b border-navy-border/60 text-ink-secondary">
                <td className="break-words py-1.5 pr-1 font-medium text-white md:py-2 md:pr-2">{row.month}</td>
                <td className="whitespace-nowrap py-1.5 pr-1 md:py-2 md:pr-2">{row.spend}</td>
                <td className="hidden py-2 pr-2 md:table-cell">{row.reach}</td>
                <td className="hidden py-2 pr-2 md:table-cell">{row.impressions}</td>
                <td className="hidden py-2 pr-2 md:table-cell">{row.ctr}</td>
                <td className="hidden py-2 pr-2 md:table-cell">{row.cpc}</td>
                <td className="whitespace-nowrap py-1.5 pr-1 md:py-2 md:pr-2">{row.leads}</td>
                <td className="whitespace-nowrap py-1.5 md:py-2">{row.cpl}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const SLIDES = [
  { name: "Campaign Summary", render: () => <CampaignSummarySlide /> },
  { name: "Ad Set", render: () => <AdSetSlide /> },
  { name: "MTD Performance", render: () => <MtdChartSlide /> },
  { name: "Combined Total", render: () => <CombinedTotalSlide /> },
];

function ArrowIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={direction === "left" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
    </svg>
  );
}

/** Interactive 4-slide carousel of real-looking report slide mockups — pure HTML/CSS, no image assets. */
function SlideCarousel() {
  const [index, setIndex] = useState(0);
  const goTo = (i: number) => setIndex((i + SLIDES.length) % SLIDES.length);

  return (
    <div className="mx-auto w-full max-w-[680px]">
      <div className="flex items-center gap-2 sm:gap-4">
        <button
          type="button"
          onClick={() => goTo(index - 1)}
          aria-label="Previous slide"
          className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-navy-border text-white hover:bg-navy-panel"
        >
          <ArrowIcon direction="left" />
        </button>

        <div
          className="min-h-[420px] w-full min-w-0 overflow-x-hidden rounded-xl border border-navy-border p-4 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6)] sm:min-h-[380px] sm:p-6"
          style={{ background: SLIDE_BG }}
        >
          {SLIDES[index].render()}
        </div>

        <button
          type="button"
          onClick={() => goTo(index + 1)}
          aria-label="Next slide"
          className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-navy-border text-white hover:bg-navy-panel"
        >
          <ArrowIcon direction="right" />
        </button>
      </div>

      <div className="mt-4 flex items-center justify-center gap-2">
        {SLIDES.map((slide, i) => (
          <button
            key={slide.name}
            type="button"
            onClick={() => goTo(i)}
            aria-label={`Show slide ${i + 1}: ${slide.name}`}
            aria-current={i === index}
            className="h-2 w-2 rounded-full transition-colors"
            style={{ background: i === index ? ACCENT : "#1e3a5f" }}
          />
        ))}
      </div>

      <p className="mt-2 text-center text-[11px] text-ink-muted sm:text-xs">
        {index + 1} / {SLIDES.length} — {SLIDES[index].name}
      </p>
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
          <SlideCarousel />
          <p className="mt-6 text-sm text-ink-muted">
            Your actual reports will use your real campaign data and your agency branding.
          </p>
        </div>
      </div>
    </section>
  );
}
