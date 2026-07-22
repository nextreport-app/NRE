/**
 * Slide-level {{TAG}} filling — sits on top of ooxml.ts's single-tag
 * replaceTagRun to fill a whole slide's tag set, plus the specific style
 * overrides that reproduce the source's FINAL, after-all-passes-settle
 * appearance (see the long comment above buildCampaignOrAdSetSlideXml).
 */

import type { CoverData, SlideData, TableHeaderLabels, TableRowData } from "../nre/report-data";
import { forceRunStyle, replaceTagRun, type StyleOverride } from "./ooxml";
import type { TemplateSlide } from "./package";

function fillTags(xml: string, values: Record<string, string>, styleOverrides: Record<string, StyleOverride> = {}): string {
  let out = xml;
  for (const [tag, value] of Object.entries(values)) {
    out = replaceTagRun(out, `{{${tag}}}`, value, styleOverrides[tag]).xml;
  }
  return out;
}

export function buildCoverSlideXml(template: TemplateSlide, cover: CoverData): string {
  return fillTags(template.xml, {
    ACCOUNT_NAME: cover.accountName,
    REPORT_DATE: cover.reportDate,
    DATE_RANGE: cover.dateRange,
    ACCOUNT_HEALTH_BADGE: cover.healthBadge,
    BUDGET_SUMMARY: cover.budgetSummary,
  });
}

export interface AiCopy {
  summary: string;
  insights: string;
}

const FALLBACK_AI_COPY: AiCopy = {
  summary: "[AI unavailable — check API keys]",
  insights: "[AI unavailable — check API keys]",
};

/**
 * Campaign-summary and ad-set slides share the same template clone.
 *
 * Style overrides here reproduce the source's FINAL rendered state — not its
 * raw template defaults — because the Apps Script applies several
 * post-processing passes (restoreHeadingFonts_, fixProseFormatting_) after
 * the initial tag fill that this template's own placeholder styling doesn't
 * reflect:
 *   - "YOUR WEEKLY PERFORMANCE REPORT" is stored unbolded in the template,
 *     but restoreHeadingFonts_ always forces it bold — force it here too.
 *   - The campaign/ad-set name line is stored at 28pt in the template
 *     (shrinkTitle_'s 14-20pt length-based sizing computes something, but
 *     restoreHeadingFonts_ runs afterward and unconditionally resets every
 *     non-title heading paragraph to 18pt — so 18pt is the only value that
 *     ever actually ships) — force 18pt directly, skip the superseded
 *     length-based calculation entirely.
 *   - CAMPAIGN_SUMMARY/KEY_INSIGHTS are stored bold 12pt in the template;
 *     fixProseFormatting_ is the LAST pass in the pipeline and always forces
 *     13pt non-bold — force that directly.
 * Every other tag keeps the template's own run styling untouched, which
 * (unlike the Slides API) is guaranteed stable since we never re-parse or
 * re-serialize formatting — reusing the template's rPr verbatim.
 */
export function buildCampaignOrAdSetSlideXml(template: TemplateSlide, slide: SlideData, ai: AiCopy = FALLBACK_AI_COPY): string {
  const heading =
    slide.kind === "adset" ? (slide.adSetName ? slide.adSetName + " (Ad Set)" : slide.campaignName) : slide.campaignName;

  let xml = fillTags(
    template.xml,
    {
      CAMPAIGN_NAME: heading,
      RESULT_LABEL: slide.resultLabel,
      COST_LABEL: slide.costLabel,
      METRIC_SPEND: slide.metrics.spend,
      METRIC_REACH: slide.metrics.reach,
      METRIC_IMPRESSIONS: slide.metrics.impressions,
      METRIC_RESULTS: slide.metrics.results,
      METRIC_CTR: slide.metrics.ctr,
      METRIC_CPR: slide.metrics.cpr,
      METRIC_CPC: slide.metrics.cpc,
      DATE_RANGE: slide.dateRangeLine,
      CAMPAIGN_SUMMARY: ai.summary,
      KEY_INSIGHTS: ai.insights,
    },
    {
      CAMPAIGN_NAME: { sizePt: 18 },
      CAMPAIGN_SUMMARY: { bold: false, sizePt: 13, fontFamily: "Poppins" },
      KEY_INSIGHTS: { bold: false, sizePt: 13, fontFamily: "Poppins" },
    },
  );
  xml = forceRunStyle(xml, "YOUR WEEKLY PERFORMANCE REPORT", { bold: true });
  return xml;
}

/** Port of the isPaused branch's dedicated message slide (also a campaign-template clone). */
export function buildPausedSlideXml(template: TemplateSlide, accountName: string, pausedMessage: string, dateRangeFallback: string): string {
  let xml = fillTags(
    template.xml,
    {
      CAMPAIGN_NAME: "All Campaigns — Paused",
      RESULT_LABEL: "RESULTS",
      COST_LABEL: "COST PER RESULT",
      METRIC_SPEND: "0",
      METRIC_REACH: "0",
      METRIC_IMPRESSIONS: "0",
      METRIC_RESULTS: "0",
      METRIC_CTR: "—",
      METRIC_CPR: "—",
      METRIC_CPC: "—",
      DATE_RANGE: dateRangeFallback,
      CAMPAIGN_SUMMARY: pausedMessage,
      KEY_INSIGHTS: "Campaigns paused — no data recorded for this period. Awaiting instructions to resume.",
    },
    {
      CAMPAIGN_NAME: { sizePt: 18 },
      CAMPAIGN_SUMMARY: { bold: false, sizePt: 13, fontFamily: "Poppins" },
      KEY_INSIGHTS: { bold: false, sizePt: 13, fontFamily: "Poppins" },
    },
  );
  xml = forceRunStyle(xml, "YOUR WEEKLY PERFORMANCE REPORT", { bold: true });
  return xml;
}

function tableRowTagValues(prefix: "PERIOD" | "MTD", row: TableRowData): Record<string, string> {
  return {
    [`${prefix}_MONTH`]: row.monthLabel,
    [`${prefix}_SPEND`]: row.spend,
    [`${prefix}_REACH`]: row.reach,
    [`${prefix}_IMPRESSIONS`]: row.impressions,
    [`${prefix}_CTR`]: row.ctr,
    [`${prefix}_CPC`]: row.cpc,
    [`${prefix}_RESULT1`]: row.result1,
    [`${prefix}_CPR1`]: row.cpr1,
    [`${prefix}_RESULT2`]: row.result2,
    [`${prefix}_CPR2`]: row.cpr2,
  };
}

export function buildTableSlideXml(
  template: TemplateSlide,
  periodRow: TableRowData,
  mtdRow: TableRowData,
  headers: TableHeaderLabels,
): string {
  return fillTags(template.xml, {
    ...tableRowTagValues("PERIOD", periodRow),
    ...tableRowTagValues("MTD", mtdRow),
    PERIOD_RESULT1_LABEL: headers.result1Label,
    PERIOD_CPR1_LABEL: headers.cpr1Label,
    PERIOD_RESULT2_LABEL: headers.result2Label,
    PERIOD_CPR2_LABEL: headers.cpr2Label,
  });
}
