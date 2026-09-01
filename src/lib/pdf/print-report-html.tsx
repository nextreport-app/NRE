import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ShareReportView, ShareMtdOverviewSlide } from "@/components/share-report-view";
import type { ShareReportData, ShareChartData } from "@/lib/nre/share-report";
import { PRINT_REPORT_CSS, CHART_SLIDE_CAPTURE_CSS } from "./print-report-css";
import { appBaseUrl } from "./app-base-url";

/** Full HTML document for Puppeteer — no HTTP round trip to the live app. */
export function buildPrintReportHtml(share: ShareReportData): string {
  const body = renderToStaticMarkup(
    <ShareReportView data={share} mode="print" assetBaseUrl={appBaseUrl()} />,
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>${PRINT_REPORT_CSS}</style>
</head>
<body>${body}</body>
</html>`;
}

/** Chart-only HTML for PPT — renders the same React tree as the live share page. */
export function buildPrintChartSlideHtml(chart: ShareChartData): string {
  const body = renderToStaticMarkup(
    <div id="chart-slide-capture">
      <div className="chart-slide-card">
        <ShareMtdOverviewSlide chart={chart} />
      </div>
    </div>,
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=960" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>${CHART_SLIDE_CAPTURE_CSS}</style>
</head>
<body>${body}</body>
</html>`;
}
