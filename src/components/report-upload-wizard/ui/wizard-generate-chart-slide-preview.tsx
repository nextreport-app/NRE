"use client";

import { useMemo } from "react";
import type { ChartSlideData } from "@/lib/nre/report-data";
import { projectChartSlideToShareChart } from "@/lib/nre/share-chart-projection";
import { ShareMtdOverviewSlide } from "@/components/share-report-view";

/** Real last-30-days chart slide preview on wizard Step 4 (matches generated PPT / share page). */
export function WizardGenerateChartSlidePreview({
  chart,
  currencySymbol,
}: {
  chart: ChartSlideData;
  currencySymbol: string;
}) {
  const shareChart = useMemo(() => projectChartSlideToShareChart(chart, currencySymbol), [chart, currencySymbol]);

  if (!shareChart.visualSlide) return null;

  return (
    <section className="rounded-lg border border-dash-border bg-dash-card p-5">
      <h4 className="text-[16px] font-semibold text-dash-ink">Last 30 days chart slide</h4>
      <p className="mt-1 text-[13px] text-dash-ink-secondary">
        Included in your deck after campaign slides — preview uses your CSV numbers.
      </p>
      <div
        className="relative mx-auto mt-4 w-full max-w-[720px] overflow-hidden rounded-md shadow-[0_4px_20px_rgba(0,0,0,0.35)]"
        style={{ aspectRatio: "16 / 9", background: "#0d1b2e" }}
      >
        <div
          className="absolute left-1/2 top-0 w-[960px] max-w-none -translate-x-1/2 origin-top scale-[0.42] sm:scale-[0.48] md:scale-[0.52]"
          aria-hidden={false}
        >
          <ShareMtdOverviewSlide chart={shareChart} />
        </div>
      </div>
    </section>
  );
}
