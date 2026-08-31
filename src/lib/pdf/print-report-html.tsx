import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ShareReportView } from "@/components/share-report-view";
import type { ShareReportData } from "@/lib/nre/share-report";
import { PRINT_REPORT_CSS } from "./print-report-css";
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
