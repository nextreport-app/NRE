"use client";

/**
 * Fix 2 — Preview & Generate step's visual slide preview carousel. Replaces
 * the old plain-text collapsible "Slides Preview" list with real-looking
 * miniature slide mockups, built the same way as the homepage's own
 * SlideCarousel (home/report-preview-section.tsx): pure HTML/CSS, a
 * translateX sliding track for the transition, flanking prev/next buttons,
 * and dot indicators below.
 *
 * Important distinction from that homepage version: every slide here is
 * built from the wizard's OWN state (client name, selected campaigns/ad
 * sets, selected metric LABELS, real computed date ranges) — never from an
 * extra API call, and never showing a real metric VALUE. `data`/
 * `comparisonData` here are the wizard's already-fetched /preview response,
 * but only its structural fields (names, date ranges, chart month name,
 * table column headers) are read; every metric number renders as a "—"
 * placeholder on purpose, per product spec, even though the real computed
 * values already exist in that response.
 */

import { useState, type ReactNode } from "react";
import type { ComparisonReportData, ReportData } from "@/lib/nre/report-data";
import type { SelectedMetric } from "@/lib/nre/available-metrics";

const SLIDE_BG = "#0d1b2e";
const ACCENT = "#f6ad55";
const MUTED = "#94a3b8";
const CARD_BG = "#111f35";
const CARD_BORDER = "#22304a";
const MAX_SLIDES = 6;

import type { WizardReportType } from "@/lib/validators/report-wizard";

function reportTypeHeading(reportType: WizardReportType): string {
  if (reportType === "MONTHLY") return "MONTHLY PERFORMANCE REPORT";
  if (reportType === "DAILY") return "DAILY PERFORMANCE REPORT";
  if (reportType === "CREATIVE") return "CREATIVE PERFORMANCE REPORT";
  if (reportType === "COMPARISON") return "COMPARISON PERFORMANCE REPORT";
  return "WEEKLY PERFORMANCE REPORT";
}

function SlideLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[9px] font-medium uppercase tracking-wide sm:text-[10px]" style={{ color: MUTED }}>
      {children}
    </p>
  );
}

function SlideHeading({ children }: { children: ReactNode }) {
  return <h4 className="mt-1 text-[13px] font-bold text-white sm:text-base">{children}</h4>;
}

/** A single metric card as it appears on a preview campaign/ad-set slide — amber label, white dash value (never a real number here). */
function MetricCardMini({ label }: { label: string }) {
  return (
    <div
      className="flex min-h-[36px] flex-col items-center justify-center rounded-md p-1 text-center sm:min-h-[44px] sm:p-1.5"
      style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}
    >
      <p className="text-[6.5px] font-semibold uppercase leading-tight sm:text-[8px]" style={{ color: ACCENT }}>
        {label}
      </p>
      <p className="mt-0.5 text-[10px] font-bold text-white sm:text-xs">—</p>
    </div>
  );
}

function PlaceholderTextBox({ text }: { text: string }) {
  return (
    <div className="mt-2 rounded-md p-2" style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
      <p className="text-[9px] italic leading-snug sm:text-[10px]" style={{ color: MUTED }}>
        {text}
      </p>
    </div>
  );
}

function DonutPlaceholder() {
  return (
    <div
      className="mx-auto h-9 w-9 rounded-full sm:h-12 sm:w-12"
      style={{ border: "4px solid #334155" }}
      aria-hidden="true"
    />
  );
}

// ── Slide 1 — Cover ─────────────────────────────────────────────────────
function CoverSlide({
  platform,
  reportType,
  clientName,
  dateRangeText,
}: {
  platform: "META" | "GOOGLE";
  reportType: WizardReportType;
  clientName: string;
  dateRangeText: string;
}) {
  return (
    <div className="flex h-full flex-col justify-between">
      <div>
        <SlideLabel>{platform === "GOOGLE" ? "GOOGLE ADS" : "META ADS"}</SlideLabel>
        <SlideHeading>{reportTypeHeading(reportType)}</SlideHeading>
        <p className="mt-3 text-[12px] font-semibold text-white sm:text-sm">{clientName}</p>
        {dateRangeText && (
          <p className="mt-1 text-[10px] sm:text-xs" style={{ color: MUTED }}>
            {dateRangeText}
          </p>
        )}
      </div>
      <div>
        <p className="text-[10px] sm:text-xs" style={{ color: MUTED }}>
          🟡 Performance score: calculating...
        </p>
        <p className="mt-1 text-[10px] sm:text-xs" style={{ color: MUTED }}>
          Budget: —
        </p>
      </div>
    </div>
  );
}

// ── Slide 2/3 — Campaign / Ad Set ──────────────────────────────────────
function MetricGridSlide({
  title,
  dateRangeLine,
  metricLabels,
}: {
  title: string;
  dateRangeLine: string;
  metricLabels: string[];
}) {
  return (
    <div className="flex h-full flex-col">
      <SlideHeading>{title}</SlideHeading>
      <p className="mt-0.5 text-[10px] sm:text-xs" style={{ color: MUTED }}>
        {dateRangeLine}
      </p>
      <div className="mt-2 grid grid-cols-4 gap-1 sm:mt-3 sm:gap-1.5">
        {metricLabels.slice(0, 8).map((label, i) => (
          <MetricCardMini key={`${label}-${i}`} label={label} />
        ))}
      </div>
      <PlaceholderTextBox text="Campaign summary will be generated..." />
    </div>
  );
}

// ── Slide 4 — MTD Chart ─────────────────────────────────────────────────
function ChartSlide({
  heading,
  subLabel,
  campaignNames,
}: {
  heading: string;
  subLabel: string;
  campaignNames: string[];
}) {
  return (
    <div className="flex h-full flex-col">
      <SlideHeading>{heading}</SlideHeading>
      {subLabel && (
        <p className="mt-0.5 text-[10px] sm:text-xs" style={{ color: MUTED }}>
          {subLabel}
        </p>
      )}
      <div className="mt-3 grid flex-1 grid-cols-4 items-start gap-2 sm:mt-4">
        {campaignNames.slice(0, 4).map((name) => (
          <div key={name} className="text-center">
            <DonutPlaceholder />
            <p className="mt-1 truncate text-[7.5px] font-medium text-white sm:text-[9px]">{name}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Slide 5 — Campaign Performance Overview (table) ─────────────────────
function TableSlide({
  columns,
  rows,
}: {
  columns: string[];
  rows: { label: string }[];
}) {
  return (
    <div className="flex h-full min-w-0 flex-col">
      <SlideHeading>CAMPAIGN PERFORMANCE OVERVIEW</SlideHeading>
      <div className="mt-2 min-w-0 flex-1 overflow-x-auto sm:mt-3">
        <table className="w-full min-w-[420px] border-collapse text-left text-[8px] sm:text-[9px]">
          <thead>
            <tr className="border-b" style={{ borderColor: CARD_BORDER, color: ACCENT }}>
              {columns.map((c) => (
                <th key={c} className="whitespace-nowrap py-1 pr-2 font-semibold uppercase tracking-wide">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b" style={{ borderColor: `${CARD_BORDER}99`, color: MUTED }}>
                <td className="whitespace-nowrap py-1 pr-2 font-medium text-white">{row.label}</td>
                {columns.slice(1).map((c) => (
                  <td key={c} className="whitespace-nowrap py-1 pr-2">
                    —
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Slide 6 — Metric Guide ───────────────────────────────────────────────
function LegendSlide({ entries }: { entries: string[] }) {
  return (
    <div className="flex h-full flex-col">
      <SlideHeading>METRIC ABBREVIATION GUIDE</SlideHeading>
      <div className="mt-2 flex-1 space-y-1 sm:mt-3 sm:space-y-1.5">
        {entries.map((label) => (
          <div
            key={label}
            className="flex items-center justify-between rounded-md px-2 py-1"
            style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}
          >
            <span className="text-[9px] font-semibold uppercase sm:text-[10px]" style={{ color: ACCENT }}>
              {label}
            </span>
            <span className="text-[9px] sm:text-[10px]" style={{ color: MUTED }}>
              —
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Comparison-flow slides (reduced set — the numbered spec above is
// written for the normal single-CSV flow; comparison reports have a
// structurally different slide set, so this mirrors the same visual shell
// with the fields comparison reports actually have) ──────────────────────
function ComparisonCampaignSlide({ campaignName, objective }: { campaignName: string; objective: string }) {
  return (
    <div className="flex h-full flex-col">
      <SlideHeading>{campaignName}</SlideHeading>
      <p className="mt-0.5 text-[10px] sm:text-xs" style={{ color: MUTED }}>
        {objective}
      </p>
      <div className="mt-3 grid flex-1 grid-cols-2 gap-2 sm:mt-4">
        <MetricCardMini label="SPEND" />
        <MetricCardMini label="REACH" />
        <MetricCardMini label="RESULTS" />
        <MetricCardMini label="COST PER RESULT" />
      </div>
      <PlaceholderTextBox text="Period A vs Period B comparison will be calculated on generation..." />
    </div>
  );
}

function ComparisonSummarySlide() {
  return (
    <div className="flex h-full flex-col">
      <SlideHeading>CAMPAIGN COMPARISON SUMMARY</SlideHeading>
      <PlaceholderTextBox text="Overall comparison summary will be generated..." />
    </div>
  );
}

// ── Slide descriptors + assembly ─────────────────────────────────────────

interface PreviewSlideDescriptor {
  key: string;
  render: () => ReactNode;
}

interface SlidePreviewCarouselProps {
  platform: "META" | "GOOGLE";
  reportType: WizardReportType;
  previewKind: "normal" | "comparison";
  clientName: string;
  data: ReportData | null;
  comparisonData: ComparisonReportData | null;
  selectedMetrics: SelectedMetric[];
}

function buildSlides({
  platform,
  reportType,
  previewKind,
  clientName,
  data,
  comparisonData,
  selectedMetrics,
}: SlidePreviewCarouselProps): { slides: PreviewSlideDescriptor[]; moreText: string | null } {
  if (previewKind === "comparison" && comparisonData) {
    const slides: PreviewSlideDescriptor[] = [
      {
        key: "cover",
        render: () => (
          <CoverSlide
            platform={platform}
            reportType={reportType}
            clientName={clientName}
            dateRangeText={`Period A: ${comparisonData.periodALabel}  vs  Period B: ${comparisonData.periodBLabel}`}
          />
        ),
      },
    ];
    const first = comparisonData.campaigns[0];
    if (first) {
      slides.push({
        key: "comparison-campaign",
        render: () => <ComparisonCampaignSlide campaignName={first.campaignName} objective={first.objective} />,
      });
    }
    slides.push({ key: "comparison-summary", render: () => <ComparisonSummarySlide /> });

    const extraCampaigns = Math.max(0, comparisonData.campaigns.length - (first ? 1 : 0));
    const moreText = extraCampaigns > 0 ? `+ ${extraCampaigns} more slides in your full report (${extraCampaigns} campaign comparison slides)` : null;
    return { slides: slides.slice(0, MAX_SLIDES), moreText };
  }

  if (!data) return { slides: [], moreText: null };

  const slides: PreviewSlideDescriptor[] = [
    {
      key: "cover",
      render: () => (
        <CoverSlide platform={platform} reportType={reportType} clientName={clientName} dateRangeText={data.cover.dateRange} />
      ),
    },
  ];

  const firstCampaign = data.campaignSlides[0];
  if (firstCampaign) {
    const labels =
      selectedMetrics.length > 0
        ? selectedMetrics.map((m) => m.label)
        : firstCampaign.dynamicMetrics.filter((m) => m !== null).map((m) => m.label);
    slides.push({
      key: "campaign",
      render: () => (
        <MetricGridSlide title={firstCampaign.campaignName} dateRangeLine={firstCampaign.dateRangeLine} metricLabels={labels} />
      ),
    });
  }

  const firstAdSet = data.adSetSlides[0];
  if (firstAdSet) {
    const labels =
      selectedMetrics.length > 0
        ? selectedMetrics.map((m) => m.label)
        : firstAdSet.dynamicMetrics.filter((m) => m !== null).map((m) => m.label);
    slides.push({
      key: "adset",
      render: () => (
        <MetricGridSlide
          title={`${firstAdSet.campaignName} — ${firstAdSet.adSetName}`}
          dateRangeLine={firstAdSet.dateRangeLine}
          metricLabels={labels}
        />
      ),
    });
  }

  if (data.chart) {
    const chart = data.chart;
    slides.push({
      key: "chart",
      render: () => (
        <ChartSlide
          heading="Last 30 days overview"
          subLabel={chart.periodSubLabel}
          campaignNames={chart.campaigns.map((c) => c.name)}
        />
      ),
    });
  }

  const resultColumns = data.tableHeaderLabels.resultColumns.flatMap((c) => [c.label, c.costLabel]);
  const columns = ["Month", "Ad Spend", "Reach", "Impressions", "CTR", "CPC", ...resultColumns];
  slides.push({
    key: "table",
    render: () => (
      <TableSlide columns={columns} rows={[{ label: data.periodRow.monthLabel }, { label: data.mtdRow.monthLabel }]} />
    ),
  });

  const legendLabels =
    selectedMetrics.length > 0
      ? selectedMetrics.map((m) => m.label)
      : firstCampaign
        ? firstCampaign.dynamicMetrics.filter((m) => m !== null).map((m) => m.label)
        : [];
  const uniqueLegendLabels = Array.from(new Set(legendLabels)).slice(0, 6);
  if (uniqueLegendLabels.length > 0) {
    slides.push({ key: "legend", render: () => <LegendSlide entries={uniqueLegendLabels} /> });
  }

  const extraCampaigns = Math.max(0, data.campaignSlides.length - (firstCampaign ? 1 : 0));
  const extraAdSets = Math.max(0, data.adSetSlides.length - (firstAdSet ? 1 : 0));
  const moreCount = extraCampaigns + extraAdSets;
  const moreText =
    moreCount > 0
      ? `+ ${moreCount} more slides in your full report (${extraCampaigns} campaign slides, ${extraAdSets} ad set slides)`
      : null;

  return { slides: slides.slice(0, MAX_SLIDES), moreText };
}

function ArrowIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={direction === "left" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
    </svg>
  );
}

/**
 * Visual replacement for the old text-only "Slides Preview" dropdown — a
 * real (if placeholder-valued) miniature slide carousel, built the same
 * pure-HTML/CSS way as the homepage's own carousel.
 */
export function SlidePreviewCarousel(props: SlidePreviewCarouselProps) {
  const [index, setIndex] = useState(0);
  const { slides, moreText } = buildSlides(props);
  const goTo = (i: number) => setIndex((i + slides.length) % slides.length);

  if (slides.length === 0) return null;

  return (
    <div className="mx-auto w-full max-w-[640px]">
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={() => goTo(index - 1)}
          aria-label="Previous slide"
          disabled={slides.length < 2}
          className="flex h-8 w-8 flex-none items-center justify-center rounded-full border border-dash-border text-dash-ink hover:bg-dash-border disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ArrowIcon direction="left" />
        </button>

        <div className="w-full min-w-0 overflow-hidden" style={{ borderRadius: "4px", boxShadow: "0 4px 20px rgba(0,0,0,0.4)" }}>
          <div
            className="flex transition-transform duration-300 ease-in-out"
            style={{ transform: `translateX(-${index * 100}%)` }}
          >
            {slides.map((slide) => (
              <div key={slide.key} className="w-full flex-none" style={{ aspectRatio: "16 / 9", background: SLIDE_BG }}>
                <div className="h-full w-full overflow-y-auto p-2.5 sm:p-4">{slide.render()}</div>
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => goTo(index + 1)}
          aria-label="Next slide"
          disabled={slides.length < 2}
          className="flex h-8 w-8 flex-none items-center justify-center rounded-full border border-dash-border text-dash-ink hover:bg-dash-border disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ArrowIcon direction="right" />
        </button>
      </div>

      {slides.length > 1 && (
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {slides.map((slide, i) => (
            <button
              key={slide.key}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Show slide ${i + 1}`}
              aria-current={i === index}
              className="h-1.5 w-1.5 rounded-full transition-colors"
              style={{ background: i === index ? ACCENT : "#334155" }}
            />
          ))}
        </div>
      )}

      <p className="mt-2 text-center text-[11px] text-dash-ink-secondary">
        Preview based on your selections — actual values will be calculated on generation
      </p>
      {moreText && <p className="mt-1 text-center text-[11px] text-dash-ink-secondary">{moreText}</p>}
    </div>
  );
}
