/**
 * Slide-level {{TAG}} filling — sits on top of ooxml.ts's single-tag
 * replaceTagRun to fill a whole slide's tag set, plus the specific style
 * overrides that reproduce the source's FINAL, after-all-passes-settle
 * appearance (see the long comment above buildCampaignOrAdSetSlideXml).
 */

import { buildCombinedTotalTableGrid, type CoverData, type SlideData, type TableHeaderLabels, type TableRowData } from "../nre/report-data";
import { forceRunStyle, replaceTagRun, replaceTagRunWithSuffix, type StyleOverride } from "./ooxml";
import { fillCombinedTotalTable } from "./table-slide";
import type { TemplateSlide } from "./package";
import { emuToPt, fitFontSizePt } from "./text-fit";

// ACCOUNT_NAME shape (ppt/slides/slide1.xml, cover template): cx="5300000"
// lIns="0" rIns="0" — keep in sync if the shape's width or insets ever
// change in templates/dark.pptx.
const ACCOUNT_NAME_MAX_WIDTH_PT = emuToPt(5300000);
const ACCOUNT_NAME_CANDIDATE_SIZES_PT = [28, 24, 20, 18, 16];

// CAMPAIGN_NAME shape (ppt/slides/slide2.xml, campaign/ad-set template):
// cx="11433300" lIns="91425" rIns="91425" — keep in sync with the template.
const CAMPAIGN_NAME_MAX_WIDTH_PT = emuToPt(11433300 - 91425 * 2);
const CAMPAIGN_NAME_CANDIDATE_SIZES_PT = [18, 16, 14, 12];

function fillTags(xml: string, values: Record<string, string>, styleOverrides: Record<string, StyleOverride> = {}): string {
  let out = xml;
  for (const [tag, value] of Object.entries(values)) {
    out = replaceTagRun(out, `{{${tag}}}`, value, styleOverrides[tag]).xml;
  }
  return out;
}

export function buildCoverSlideXml(template: TemplateSlide, cover: CoverData): string {
  const accountNameSizePt = fitFontSizePt(cover.accountName, ACCOUNT_NAME_MAX_WIDTH_PT, ACCOUNT_NAME_CANDIDATE_SIZES_PT);
  return fillTags(
    template.xml,
    {
      ACCOUNT_NAME: cover.accountName,
      REPORT_DATE: cover.reportDate,
      DATE_RANGE: cover.dateRange,
      ACCOUNT_HEALTH_BADGE: cover.healthBadge,
      BUDGET_SUMMARY: cover.budgetSummary,
    },
    {
      ACCOUNT_NAME: { sizePt: accountNameSizePt },
    },
  );
}

export interface AiCopy {
  summary: string;
  insights: string;
}

const FALLBACK_AI_COPY: AiCopy = {
  summary: "[AI unavailable — check API keys]",
  insights: "[AI unavailable — check API keys]",
};

/** Same amber used for the MTD chart's "Paused"/"Inactive" indicator — one consistent color for "not active" across the whole deck. */
const INACTIVE_TAG_COLOR = "fbbf24";

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
 *     ever actually shipped) — 18pt is kept as the ceiling here too, via
 *     CAMPAIGN_NAME_CANDIDATE_SIZES_PT, auto-shrinking below it only when a
 *     long campaign/ad-set name would otherwise wrap (see text-fit.ts).
 *   - CAMPAIGN_SUMMARY/KEY_INSIGHTS are stored bold 12pt in the template;
 *     fixProseFormatting_ is the LAST pass in the pipeline and always forces
 *     13pt non-bold — force that directly.
 * Every other tag keeps the template's own run styling untouched, which
 * (unlike the Slides API) is guaranteed stable since we never re-parse or
 * re-serialize formatting — reusing the template's rPr verbatim.
 */
export function buildCampaignOrAdSetSlideXml(template: TemplateSlide, slide: SlideData, ai: AiCopy = FALLBACK_AI_COPY): string {
  const heading =
    slide.kind === "adset"
      ? slide.adSetName
        ? slide.adSetName + " (Ad Set)"
        : slide.campaignName
      : slide.campaignName + " (Campaign)";

  // Small "Paused"/"Inactive" badge right after the name — null (no badge
  // at all) for active campaigns/ad sets and whenever the CSV has no
  // delivery-status column to judge it from.
  const statusSuffix = slide.statusIndicator ? `  (${slide.statusIndicator})` : null;

  let xml = fillTags(
    template.xml,
    {
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
      CAMPAIGN_SUMMARY: { bold: false, sizePt: 13, fontFamily: "Poppins" },
      KEY_INSIGHTS: { bold: false, sizePt: 13, fontFamily: "Poppins" },
    },
  );
  const campaignNameSizePt = fitFontSizePt(heading, CAMPAIGN_NAME_MAX_WIDTH_PT, CAMPAIGN_NAME_CANDIDATE_SIZES_PT);
  xml = replaceTagRunWithSuffix(
    xml,
    "{{CAMPAIGN_NAME}}",
    heading,
    statusSuffix,
    { sizePt: campaignNameSizePt },
    { sizePt: 12, bold: true, color: INACTIVE_TAG_COLOR },
  ).xml;
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

/**
 * Fills the Combined Total table positionally (see table-slide.ts) rather
 * than by scanning for named {{TAG}} runs — a structure mismatch throws
 * immediately instead of a column silently going missing. Hides the Period
 * row (index 1) entirely when no Period CSV was uploaded — rather than a
 * row of dashes — and hides the second result-type columns (8-9) entirely
 * when the data only has one objective, rather than a blank dashed pair.
 */
export function buildTableSlideXml(
  template: TemplateSlide,
  periodRow: TableRowData,
  mtdRow: TableRowData,
  headers: TableHeaderLabels,
): string {
  const grid = buildCombinedTotalTableGrid(periodRow, mtdRow, headers);
  const hasSecondObjective = headers.result2Label !== "—";
  return fillCombinedTotalTable(template.xml, grid, {
    hideRowIndexes: periodRow.hasData ? [] : [1],
    hideColIndexes: hasSecondObjective ? [] : [8, 9],
  });
}
