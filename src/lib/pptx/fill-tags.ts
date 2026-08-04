/**
 * Slide-level {{TAG}} filling — sits on top of ooxml.ts's single-tag
 * replaceTagRun to fill a whole slide's tag set, plus the specific style
 * overrides that reproduce the source's FINAL, after-all-passes-settle
 * appearance (see the long comment above buildCampaignOrAdSetSlideXml).
 */

import { buildCombinedTotalTableGrid, type CoverData, type Platform, type ReportType, type SlideData, type TableHeaderLabels, type TableRowData } from "../nre/report-data";
import { buildGoogleCombinedTotalTableGrid } from "../nre/google-report-data";
import {
  cloneShapeAsTag,
  forceRunStyle,
  insertShapeBeforeSpTreeClose,
  removeShapeContaining,
  removeShapesInRegion,
  replaceLiteralText,
  replaceTagRun,
  replaceTagRunWithSuffix,
  setShapeOffsetY,
  type StyleOverride,
} from "./ooxml";
import { fillCombinedTotalTable } from "./table-slide";
import type { TemplateSlide } from "./package";
import { emuToPt, fitFontSizePt } from "./text-fit";
import { buildDynamicCardShapes } from "./dynamic-cards";
import { resetShapeIdCounter } from "./shapes";

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

export const DEFAULT_REPORT_TITLE = "Weekly Performance Report";
const DEFAULT_MONTHLY_REPORT_TITLE = "Monthly Performance Report";

// PRESENTED_TO badge and ACCOUNT_NAME's own y offsets in the template
// (ppt/slides/slide1.xml) — shifted up by this much, together, only when a
// "Prepared by ..." line needs to be inserted between ACCOUNT_NAME and
// REPORT_DATE. Chosen so the new line gets the same ~33000 EMU gap on both
// sides that ACCOUNT_NAME and REPORT_DATE already have between each other
// (see the empirical cover-slide spacing fix) — when no agency name is set,
// neither shape is touched and the cover renders pixel-identical to today.
const PRESENTED_TO_Y = 5061635;
const ACCOUNT_NAME_Y = 5533973;
const ACCOUNT_NAME_HEIGHT_EMU = 400000;
const COVER_ROW_GAP_EMU = 32999; // the template's own existing ACCOUNT_NAME-to-REPORT_DATE gap
const PREPARED_BY_SHIFT_UP_EMU = 310000;
const PREPARED_BY_Y = ACCOUNT_NAME_Y - PREPARED_BY_SHIFT_UP_EMU + ACCOUNT_NAME_HEIGHT_EMU + COVER_ROW_GAP_EMU;

/**
 * PRESENTED_TO's actual top y at render time — shifted up when an agency
 * name is present (see buildCoverSlideXml above). Exported so other
 * cover-slide placement logic that needs to anchor to this shape (e.g.
 * render.ts's client/agency logo positioning, which sits directly above
 * it) reads the real, current position instead of duplicating — and
 * risking drifting out of sync with — this shift logic.
 */
export function presentedToTopY(hasAgencyName: boolean): number {
  return hasAgencyName ? PRESENTED_TO_Y - PREPARED_BY_SHIFT_UP_EMU : PRESENTED_TO_Y;
}

export interface CoverSlideOptions {
  /** Optional custom title replacing the template's default "WEEKLY PERFORMANCE REPORT" — falls back to DEFAULT_REPORT_TITLE (or DEFAULT_MONTHLY_REPORT_TITLE — see `reportType`) when blank. Always rendered upper-cased to match the template's existing all-caps styling. */
  reportTitle?: string | null;
  /** Agency name from account settings — when set, adds a "Prepared by ..." line below the account name; when absent, the cover renders exactly as it does without this feature. */
  agencyName?: string | null;
  /** Fix 8 — only affects the DEFAULT title text used when `reportTitle` is blank/absent ("MONTHLY PERFORMANCE REPORT" instead of "WEEKLY PERFORMANCE REPORT"); an explicit reportTitle always wins regardless. Defaults to "WEEKLY". */
  reportType?: ReportType;
}

export function buildCoverSlideXml(template: TemplateSlide, cover: CoverData, options: CoverSlideOptions = {}): string {
  const accountNameSizePt = fitFontSizePt(cover.accountName, ACCOUNT_NAME_MAX_WIDTH_PT, ACCOUNT_NAME_CANDIDATE_SIZES_PT);
  const agencyName = options.agencyName?.trim();

  let xml = template.xml;
  if (agencyName) {
    const preparedByShape = cloneShapeAsTag(xml, "{{REPORT_DATE}}", "{{PREPARED_BY}}", PREPARED_BY_Y);
    xml = setShapeOffsetY(xml, "PRESENTED TO", PRESENTED_TO_Y - PREPARED_BY_SHIFT_UP_EMU);
    xml = setShapeOffsetY(xml, "{{ACCOUNT_NAME}}", ACCOUNT_NAME_Y - PREPARED_BY_SHIFT_UP_EMU);
    xml = insertShapeBeforeSpTreeClose(xml, preparedByShape);
  }

  const defaultTitle = options.reportType === "MONTHLY" ? DEFAULT_MONTHLY_REPORT_TITLE : DEFAULT_REPORT_TITLE;
  const reportTitle = (options.reportTitle?.trim() || defaultTitle).toUpperCase();

  return fillTags(
    xml,
    {
      ACCOUNT_NAME: cover.accountName,
      REPORT_TITLE: reportTitle,
      REPORT_DATE: cover.reportDate,
      DATE_RANGE: cover.dateRange,
      ACCOUNT_HEALTH_BADGE: cover.healthBadge,
      BUDGET_SUMMARY: cover.budgetSummary,
      ...(agencyName ? { PREPARED_BY: `Prepared by ${agencyName}` } : {}),
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
 *     non-bold — force that directly. Bumped from 13pt to 14pt (product
 *     decision, not a source-parity fix like the others in this list): text
 *     renders visibly smaller once Google Drive converts the .pptx to
 *     Slides, so every text size in this function is nudged up 1pt to
 *     compensate, landing closer to the intended size after that conversion.
 * Every other tag keeps the template's own run styling untouched, which
 * (unlike the Slides API) is guaranteed stable since we never re-parse or
 * re-serialize formatting — reusing the template's rPr verbatim.
 */
/**
 * Google Ads metric cards repurpose the same 7 static-text card slots the
 * Meta template already has (see buildCampaignOrAdSetSlideXml's own doc
 * comment) rather than a physically different template — "AD SPEND"/
 * "REACH"/"CPC (All)" are static (non-{{TAG}}) template text that needs
 * retexting to their Google Ads equivalents; "IMPRESSIONS" and "CTR (All)"
 * read the same for both platforms and are left untouched. RESULT_LABEL/
 * COST_LABEL are already dynamic {{TAG}}s (report-data.ts sets them to
 * "CONVERSIONS"/"COST PER CONVERSION" for Google), so the Conversions/
 * Cost-per-Conversion cards need no template changes at all.
 */
function applyGoogleAdsCardLabels(xml: string, platform: Platform): string {
  if (platform !== "GOOGLE") return xml;
  let out = replaceLiteralText(xml, "AD SPEND", "COST");
  out = replaceLiteralText(out, "REACH", "CLICKS");
  out = replaceLiteralText(out, "CPC (All)", "AVG. CPC (All)");
  return out;
}

// The 7 fixed metric-card tags the dynamic path strips (see
// ooxml.ts's removeShapeContaining) before inserting a generated grid in
// their place — RESULT_LABEL/COST_LABEL are nested inside the
// METRIC_RESULTS/METRIC_CPR shapes respectively, so removing those two also
// removes them; nothing separately targets RESULT_LABEL/COST_LABEL here.
const FIXED_METRIC_CARD_TAGS = [
  "{{METRIC_SPEND}}",
  "{{METRIC_REACH}}",
  "{{METRIC_IMPRESSIONS}}",
  "{{METRIC_RESULTS}}",
  "{{METRIC_CTR}}",
  "{{METRIC_CPR}}",
  "{{METRIC_CPC}}",
];

export function buildCampaignOrAdSetSlideXml(
  template: TemplateSlide,
  slide: SlideData,
  ai: AiCopy = FALLBACK_AI_COPY,
  reportType: ReportType = "WEEKLY",
  platform: Platform = "META",
): string {
  const adGroupOrSetLabel = platform === "GOOGLE" ? " (Ad Group)" : " (Ad Set)";
  const heading =
    slide.kind === "adset"
      ? slide.adSetName
        ? slide.adSetName + adGroupOrSetLabel
        : slide.campaignName
      : slide.campaignName + " (Campaign)";

  // Small "Paused"/"Inactive" badge right after the name — null (no badge
  // at all) for active campaigns/ad sets and whenever the CSV has no
  // delivery-status column to judge it from.
  const statusSuffix = slide.statusIndicator ? `  (${slide.statusIndicator})` : null;

  const useDynamicCards = !!slide.dynamicMetrics && slide.dynamicMetrics.length > 0;

  let xml: string;
  if (useDynamicCards) {
    // Dynamic metric dictionary path (Metric Preview wizard step) — the
    // fixed 7-field cards are replaced with a generated grid sized to the
    // selected metric count. DATE_RANGE/CAMPAIGN_SUMMARY/KEY_INSIGHTS live
    // in a separate, untouched region of the same template (the AI-copy
    // column) and still go through the normal tag-fill.
    xml = fillTags(
      template.xml,
      {
        DATE_RANGE: slide.dateRangeLine,
        CAMPAIGN_SUMMARY: ai.summary,
        KEY_INSIGHTS: ai.insights,
      },
      {
        CAMPAIGN_SUMMARY: { bold: false, sizePt: 14, fontFamily: "Poppins" },
        KEY_INSIGHTS: { bold: false, sizePt: 14, fontFamily: "Poppins" },
      },
    );
    for (const tag of FIXED_METRIC_CARD_TAGS) xml = removeShapeContaining(xml, tag);
    // The template also has an untagged decorative "ghost" shape (no
    // {{TAG}} text at all) sitting in the same region — see
    // ooxml.ts's removeShapesInRegion doc comment.
    xml = removeShapesInRegion(xml, { xMaxPt: 511, yMinPt: 95, yMaxPt: 495 });

    // Shape ids only need to be unique within this one slide, but the
    // module-global counter (shared with chart-slide.ts) starts low — reset
    // it above whatever ids remain in the template after stripping, or new
    // cards would collide with the template's own shape ids.
    const existingIds = [...xml.matchAll(/<p:cNvPr id="(\d+)"/g)].map((m) => Number(m[1]));
    resetShapeIdCounter((existingIds.length ? Math.max(...existingIds) : 1) + 1);

    const cardShapes = buildDynamicCardShapes(slide.dynamicMetrics!.map((m) => ({ label: m.label, value: m.value })));
    for (const shape of cardShapes) xml = insertShapeBeforeSpTreeClose(xml, shape);
  } else {
    xml = fillTags(
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
        CAMPAIGN_SUMMARY: { bold: false, sizePt: 14, fontFamily: "Poppins" },
        KEY_INSIGHTS: { bold: false, sizePt: 14, fontFamily: "Poppins" },
      },
    );
    xml = applyGoogleAdsCardLabels(xml, platform);
  }

  const campaignNameSizePt = fitFontSizePt(heading, CAMPAIGN_NAME_MAX_WIDTH_PT, CAMPAIGN_NAME_CANDIDATE_SIZES_PT);
  xml = replaceTagRunWithSuffix(
    xml,
    "{{CAMPAIGN_NAME}}",
    heading,
    statusSuffix,
    { sizePt: campaignNameSizePt },
    { sizePt: 12, bold: true, color: INACTIVE_TAG_COLOR },
  ).xml;
  const header = reportType === "MONTHLY" ? "YOUR MONTHLY PERFORMANCE REPORT" : "YOUR WEEKLY PERFORMANCE REPORT";
  xml = replaceLiteralText(xml, "YOUR WEEKLY PERFORMANCE REPORT", header);
  xml = forceRunStyle(xml, header, { bold: true });
  return xml;
}

/** Port of the isPaused branch's dedicated message slide (also a campaign-template clone). */
export function buildPausedSlideXml(
  template: TemplateSlide,
  accountName: string,
  pausedMessage: string,
  dateRangeFallback: string,
  reportType: ReportType = "WEEKLY",
  platform: Platform = "META",
): string {
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
      CAMPAIGN_SUMMARY: { bold: false, sizePt: 14, fontFamily: "Poppins" },
      KEY_INSIGHTS: { bold: false, sizePt: 14, fontFamily: "Poppins" },
    },
  );
  xml = applyGoogleAdsCardLabels(xml, platform);
  const header = reportType === "MONTHLY" ? "YOUR MONTHLY PERFORMANCE REPORT" : "YOUR WEEKLY PERFORMANCE REPORT";
  xml = replaceLiteralText(xml, "YOUR WEEKLY PERFORMANCE REPORT", header);
  xml = forceRunStyle(xml, header, { bold: true });
  return xml;
}

/**
 * Fills the Combined Total table positionally (see table-slide.ts) rather
 * than by scanning for named {{TAG}} runs — a structure mismatch throws
 * immediately instead of a column silently going missing. Hides the Period
 * row (index 1) entirely when no Previous Month Data was uploaded — rather
 * than a row of dashes. Column count follows the number of distinct objectives
 * (Fix 1): exactly 1 hides the unused second result-type pair (8-9) rather
 * than showing a blank dashed pair; exactly 2 fits the template's native
 * width as-is; 3 or more GROWS the table (see table-slide.ts) instead of
 * dropping anything past the second objective.
 *
 * Also hides the MTD row (index 2) whenever periodRow.sameMonthAsCurrentMTD
 * is true — both rows would otherwise show near-identical same-month data
 * (e.g. a report generated on the 1st, before the new month's MTD Daily
 * CSV has any real data of its own yet), which read as confusing/redundant
 * rather than informative. Guarded on `!hidePeriodRow`: a Monthly report
 * already hides the Period row unconditionally and shows only the MTD row
 * (Fix 8) — sameMonthAsCurrentMTD can still be true there (it's a pure
 * data fact, computed independently of reportType), but hiding the MTD row
 * too in that case would leave zero data rows on the slide.
 */
export function buildTableSlideXml(
  template: TemplateSlide,
  periodRow: TableRowData,
  mtdRow: TableRowData,
  headers: TableHeaderLabels,
  reportType: ReportType = "WEEKLY",
  isLightTemplate = false,
  platform: Platform = "META",
): string {
  // Google Ads reports have their own static header words (Cost/Clicks/
  // Avg. CPC instead of Meta's Ad Spend/Reach/CPC (All)) — see
  // google-report-data.ts's buildGoogleCombinedTotalTableGrid, which fills
  // the SAME positional 3-row/N-column grid shape table-slide.ts expects,
  // just with different header text, so no other table-filling logic here
  // needs to change.
  const grid =
    platform === "GOOGLE" ? buildGoogleCombinedTotalTableGrid(mtdRow, headers) : buildCombinedTotalTableGrid(periodRow, mtdRow, headers);
  // Row 1 (Period) is hidden whenever there's nothing to show it (no
  // Previous Month Data uploaded) — and ALWAYS for a Monthly report,
  // regardless of whether Previous Month Data exists: "the Combined Total
  // slide shows only one data row (MTD) with no weekly column distinction"
  // (Fix 8) — a Monthly report has no separate weekly/period comparison at
  // all, only the month itself.
  const hidePeriodRow = reportType === "MONTHLY" || !periodRow.hasData;
  const hideMtdRow = !hidePeriodRow && periodRow.sameMonthAsCurrentMTD;
  return fillCombinedTotalTable(template.xml, grid, {
    hideRowIndexes: [...(hidePeriodRow ? [1] : []), ...(hideMtdRow ? [2] : [])],
    hideColIndexes: headers.resultColumns.length <= 1 ? [8, 9] : [],
    isLightTemplate,
  });
}
