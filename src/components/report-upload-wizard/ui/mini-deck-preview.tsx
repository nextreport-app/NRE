"use client";

import type { PreviewKind } from "../types";

type SlideChip = {
  key: string;
  title: string;
  subtitle?: string;
  accent?: "cover" | "campaign" | "chart" | "table" | "other";
};

function accentBorder(accent: SlideChip["accent"]): string {
  switch (accent) {
    case "cover":
      return "border-l-[#f6ad55]";
    case "campaign":
      return "border-l-[#63b3ed]";
    case "chart":
      return "border-l-[#68d391]";
    case "table":
      return "border-l-[#b794f4]";
    default:
      return "border-l-dash-border";
  }
}

export function buildMiniDeckSlides(input: {
  previewKind: PreviewKind;
  clientName: string;
  reportTypeLabel: string;
  campaignNames: string[];
  estimatedSlides: number;
  periodHint?: string;
}): SlideChip[] {
  const slides: SlideChip[] = [
    {
      key: "cover",
      title: "Cover",
      subtitle: input.clientName,
      accent: "cover",
    },
  ];

  if (input.previewKind === "comparison") {
    for (const name of input.campaignNames.slice(0, 4)) {
      slides.push({ key: `cmp-${name}`, title: name, subtitle: "Period A vs B", accent: "campaign" });
    }
    if (input.campaignNames.length > 4) {
      slides.push({
        key: "more-campaigns",
        title: `+${input.campaignNames.length - 4} campaigns`,
        accent: "other",
      });
    }
    slides.push({ key: "cmp-total", title: "Comparison total", accent: "table" });
    return slides;
  }

  if (input.previewKind === "historical") {
    slides.push({ key: "hist-intro", title: "Multi-month deck", subtitle: input.periodHint, accent: "other" });
    slides.push({ key: "hist-table", title: "Month comparison table", accent: "table" });
    return slides;
  }

  if (input.previewKind === "dayBreakdown") {
    slides.push({ key: "day-table", title: "Daily totals table", subtitle: input.periodHint, accent: "table" });
    return slides;
  }

  for (const name of input.campaignNames.slice(0, 3)) {
    slides.push({ key: `camp-${name}`, title: name, subtitle: "Campaign slide", accent: "campaign" });
  }
  if (input.campaignNames.length > 3) {
    slides.push({
      key: "more-campaigns",
      title: `+${input.campaignNames.length - 3} campaigns`,
      accent: "other",
    });
  }

  slides.push(
    { key: "chart", title: "Last 30 days", subtitle: "Chart slide", accent: "chart" },
    { key: "combined", title: "Combined total", subtitle: input.periodHint ?? input.reportTypeLabel, accent: "table" },
    { key: "guide", title: "Metric guide", accent: "other" },
  );

  if (input.estimatedSlides > slides.length) {
    slides.push({
      key: "total",
      title: `${input.estimatedSlides} slides total`,
      subtitle: "Includes ad sets & continuations",
      accent: "other",
    });
  }

  return slides;
}

export function MiniDeckPreview({ slides }: { slides: SlideChip[] }) {
  if (slides.length === 0) return null;

  return (
    <section className="rounded-lg border border-dash-border bg-dash-card p-5">
      <h4 className="text-[16px] font-semibold text-white">Deck preview</h4>
      <p className="mt-1 text-[13px] text-dash-ink-secondary">Quick map of slide order — not a pixel-perfect PPT preview.</p>
      <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
        {slides.map((slide, index) => (
          <div
            key={slide.key}
            className={`flex h-[88px] w-[140px] shrink-0 flex-col justify-between rounded-md border border-dash-border border-l-4 bg-[#0f172a] p-3 ${accentBorder(slide.accent)}`}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wide text-dash-ink-muted">Slide {index + 1}</span>
            <div>
              <p className="truncate text-[13px] font-semibold text-white" title={slide.title}>
                {slide.title}
              </p>
              {slide.subtitle ? (
                <p className="truncate text-[11px] text-dash-ink-secondary" title={slide.subtitle}>
                  {slide.subtitle}
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
