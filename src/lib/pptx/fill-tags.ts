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
  enforceMinFontSize,
  findCardIconRelId,
  forceRunStyle,
  insertShapeBeforeSpTreeClose,
  replaceCardIcon,
  replaceCardLabel,
  replaceLiteralText,
  replaceTagRun,
  replaceTagRunWithSuffix,
  setShapeOffsetY,
  type StyleOverride,
} from "./ooxml";
import { fillCombinedTotalTable } from "./table-slide";
import type { TemplateSlide } from "./package";
import { emuToPt, fitFontSizePt } from "./text-fit";
import { resolveMetricIconId, type MetricIconId } from "./metric-icons";

// ACCOUNT_NAME shape (ppt/slides/slide1.xml, cover template): cx="5300000"
// lIns="0" rIns="0" — keep in sync if the shape's width or insets ever
// change in templates/dark.pptx.
const ACCOUNT_NAME_MAX_WIDTH_PT = emuToPt(5300000);
const ACCOUNT_NAME_CANDIDATE_SIZES_PT = [28, 24, 20, 18, 16];

// CAMPAIGN_NAME shape (ppt/slides/slide2.xml, campaign/ad-set template):
// cx="11433300" lIns="91425" rIns="91425" — keep in sync with the template.
const CAMPAIGN_NAME_MAX_WIDTH_PT = emuToPt(11433300 - 91425 * 2);
// Fix 4 (readability pass) — floor raised from 12pt to 16pt: a name long
// enough to need the smaller candidates now wraps instead of shrinking
// below the spec's stated minimum heading size.
const CAMPAIGN_NAME_CANDIDATE_SIZES_PT = [18, 16];

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

const DEFAULT_COMPARISON_REPORT_TITLE = "Comparison Performance Report";

export interface CoverSlideOptions {
  /** Optional custom title replacing the template's default "WEEKLY PERFORMANCE REPORT" — falls back to DEFAULT_REPORT_TITLE (or DEFAULT_MONTHLY_REPORT_TITLE/DEFAULT_COMPARISON_REPORT_TITLE — see `reportType`) when blank. Always rendered upper-cased to match the template's existing all-caps styling. */
  reportTitle?: string | null;
  /** Agency name from account settings — when set, adds a "Prepared by ..." line below the account name; when absent, the cover renders exactly as it does without this feature. */
  agencyName?: string | null;
  /**
   * Fix 8 — only affects the DEFAULT title text used when `reportTitle` is
   * blank/absent ("MONTHLY PERFORMANCE REPORT" instead of "WEEKLY
   * PERFORMANCE REPORT"); an explicit reportTitle always wins regardless.
   * Defaults to "WEEKLY". "COMPARISON" is a distinct, wizard/DB-level
   * report-type concept (see comparison-slides.ts's buildComparisonCoverSlideXml,
   * its only caller with this value) — separate from report-data.ts's own
   * `ReportType`, which stays WEEKLY/MONTHLY-only throughout the existing
   * engine this function otherwise serves unchanged.
   */
  reportType?: ReportType | "COMPARISON";
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

  const defaultTitle =
    options.reportType === "MONTHLY"
      ? DEFAULT_MONTHLY_REPORT_TITLE
      : options.reportType === "COMPARISON"
        ? DEFAULT_COMPARISON_REPORT_TITLE
        : DEFAULT_REPORT_TITLE;
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
      // Fix 3 (readability pass) — the template's own defaults for these
      // three lines (12pt/11pt/12pt) read too small once Google Drive
      // converts the .pptx to Slides; bumped to the specified sizes, with
      // ACCOUNT_HEALTH_BADGE (the "Weekly/Monthly Performance Score" line)
      // also forced bold so it stands out the way a score line should.
      // Every other cover-slide line (REPORT_TITLE 20pt, PRESENTED_TO/
      // PREPARED_BY 12pt, ACCOUNT_NAME 16-28pt) is already at or above the
      // spec's stated 12pt floor and is left untouched.
      REPORT_DATE: { sizePt: 14 },
      ACCOUNT_HEALTH_BADGE: { sizePt: 14, bold: true },
      BUDGET_SUMMARY: { sizePt: 13 },
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

// The campaign template's 8 fixed card slots, in their physical
// left-to-right/top-to-bottom order (Spend/Reach/Impressions/Results/CTR/
// Cost per Result/CPC/[slot 8] — see ppt/slides/slide2.xml). Which METRIC
// now fills each physical position is decided upstream, entirely
// automatically — slot-assignment.ts's buildMetaSlots/buildGoogleSlots map
// each campaign's own objective onto the 8 slots, with no wizard step
// required (an optional wizard override can also supply this array) — and
// arrives here as slide.dynamicMetrics, already in slot order — this module
// only ever retargets each slot's own label/value/icon in place, never
// moves, removes, or adds a shape.
//
// Slot 8 is structurally different from slots 1-7: it was added (Part 1) by
// cloning the CPC card into the template's own already-empty 8th grid
// position, and — since it has no fixed default metric the way slots 1-7
// do — BOTH its label and value are {{TAG}} placeholders in the template
// (METRIC_8_LABEL/METRIC_8_VALUE), rather than a static label string that
// gets retexted in place via replaceCardLabel.
const CARD_SLOT_TAGS = [
  "{{METRIC_SPEND}}",
  "{{METRIC_REACH}}",
  "{{METRIC_IMPRESSIONS}}",
  "{{METRIC_RESULTS}}",
  "{{METRIC_CTR}}",
  "{{METRIC_CPR}}",
  "{{METRIC_CPC}}",
  "{{METRIC_8_VALUE}}",
] as const;

// Each slot's own label tag, where the template's default label is itself a
// {{TAG}} rather than static text — null for a slot whose default label is
// plain static text (Spend/Reach/Impressions/CTR/CPC's own "AD SPEND"/
// "REACH"/"IMPRESSIONS"/"CTR (All)"/"CPC (All)"), which gets retexted in
// place via replaceCardLabel instead. Results/Cost per Result are the two
// exceptions among slots 1-7 — the ORIGINAL (non-dynamic) pipeline needed
// their labels to vary by objective ("WEBSITE LEADS"/"COST PER LEAD" vs.
// "PURCHASES"/"COST PER PURCHASE", etc.), so the template itself stores
// {{RESULT_LABEL}}/{{COST_LABEL}} tags there, not literal text. A slot with
// a real labelTag here MUST be filled directly via replaceTagRun rather
// than replaceCardLabel — and, just as importantly, MUST be explicitly
// dashed out (not left as a raw unfilled tag) when no metric is assigned to
// it, which replaceCardLabel's "no-op if the value tag isn't found" fallback
// can't do for a tag it was never pointed at in the first place.
const CARD_SLOT_LABEL_TAGS: (string | null)[] = [null, null, null, "{{RESULT_LABEL}}", null, "{{COST_LABEL}}", null, "{{METRIC_8_LABEL}}"];

// Each slot's own native icon category, in the same order — read once (via
// findCardIconRelId) to discover that icon's relationship id before any
// slot's tag text changes, so a slot whose assigned metric maps to a
// DIFFERENT icon category can borrow another slot's icon relationship
// instead of leaving its own (now mismatched) template icon in place. Slot
// 8 was cloned from the CPC card, so it inherits CPC's icon as its own
// native default.
const CARD_SLOT_DEFAULT_ICON: MetricIconId[] = ["spend", "reach", "impressions", "results", "ctr", "cost", "cpc", "cpc"];

export function buildCampaignOrAdSetSlideXml(
  template: TemplateSlide,
  slide: SlideData,
  ai: AiCopy = FALLBACK_AI_COPY,
  reportType: ReportType = "WEEKLY",
  platform: Platform = "META",
  /**
   * Part 4 — true for a campaign/ad-set's second "Additional Metrics" slide
   * (present only when slide.additionalMetricsSlide is set, i.e. the
   * wizard's selectedMetrics exceeded 8 for this campaign): swaps the
   * heading for "[Name] — Additional Metrics" and fills the 8 card slots
   * from slide.additionalMetricsSlide instead of slide.dynamicMetrics.
   * DATE_RANGE/CAMPAIGN_SUMMARY/KEY_INSIGHTS are unaffected — the
   * continuation slide reuses the same AI copy as the primary slide rather
   * than triggering a second AI call for the same campaign.
   */
  useAdditionalMetricsSlide = false,
): string {
  const adGroupOrSetLabel = platform === "GOOGLE" ? " (Ad Group)" : " (Ad Set)";
  const heading = useAdditionalMetricsSlide
    ? (slide.kind === "adset" ? slide.adSetName || slide.campaignName : slide.campaignName) + " — Additional Metrics"
    : slide.kind === "adset"
      ? slide.adSetName
        ? slide.adSetName + adGroupOrSetLabel
        : slide.campaignName
      : slide.campaignName + " (Campaign)";

  // Small "Paused"/"Inactive" badge right after the name — null (no badge
  // at all) for active campaigns/ad sets and whenever the CSV has no
  // delivery-status column to judge it from.
  const statusSuffix = slide.statusIndicator ? `  (${slide.statusIndicator})` : null;

  const dynamicSlots = useAdditionalMetricsSlide ? slide.additionalMetricsSlide : slide.dynamicMetrics;
  const useDynamicSlots = !!dynamicSlots && dynamicSlots.length > 0;

  let xml: string;
  if (useDynamicSlots) {
    // Metric Preview wizard's 7-slot system — the campaign template's own 7
    // fixed card shapes are kept completely untouched (same icons,
    // gradients, shadows, layout); only the label/value/icon each slot
    // shows changes, driven by dynamicSlots' own slot order. No shapes are
    // stripped or inserted — this is a pure in-place retext/re-icon of the
    // template's existing shapes. DATE_RANGE/CAMPAIGN_SUMMARY/KEY_INSIGHTS
    // live in a separate, untouched region of the same template (the
    // AI-copy column) and still go through the normal tag-fill.
    xml = fillTags(
      template.xml,
      {
        DATE_RANGE: slide.dateRangeLine,
        CAMPAIGN_SUMMARY: ai.summary,
        KEY_INSIGHTS: ai.insights,
      },
      {
        // Fix 4 (readability pass), bumped further by Fix 5 (13pt -> still
        // 13pt, now also bold) — covers both the date-range line and the
        // "Ad Frequency: ..." line right below it, which share this same
        // tag run (see report-data.ts's freqLine, joined in with a literal
        // "\n" — replaceTagRun splits on it but keeps one shared rPr for
        // every resulting line). OOXML only has a binary bold toggle, not
        // numeric font weights, so "600/semibold" maps to `bold: true`.
        DATE_RANGE: { sizePt: 13, bold: true },
        CAMPAIGN_SUMMARY: { bold: false, sizePt: 14, fontFamily: "Poppins" },
        KEY_INSIGHTS: { bold: false, sizePt: 14, fontFamily: "Poppins" },
      },
    );

    // Discover every slot's own native icon relationship id BEFORE any
    // slot's {{METRIC_*}} tag text is touched — findCardIconRelId locates
    // it relative to that still-untouched tag.
    const nativeIconRelIds: Partial<Record<MetricIconId, string>> = {};
    CARD_SLOT_TAGS.forEach((tag, i) => {
      const relId = findCardIconRelId(xml, tag);
      if (relId) nativeIconRelIds[CARD_SLOT_DEFAULT_ICON[i]] = relId;
    });

    CARD_SLOT_TAGS.forEach((tag, i) => {
      const metric = dynamicSlots![i];
      const labelTag = CARD_SLOT_LABEL_TAGS[i];
      // Fewer than 8 metrics assigned (a CSV with under 8 classifiable
      // columns, or a wizard selection/continuation slide with fewer than
      // 8 metrics — see Part 4) — the static-label slots (Spend/Reach/
      // Impressions/CTR/CPC) simply keep their own template label as-is,
      // showing only a dash for the value. The three slots whose label is
      // itself a {{TAG}} (Results/Cost per Result/slot 8) have no static
      // text to fall back to, so their own label tag gets dashed out too —
      // otherwise it would render as a raw, unfilled {{RESULT_LABEL}}/
      // {{COST_LABEL}}/{{METRIC_8_LABEL}} placeholder.
      if (!metric) {
        xml = replaceTagRun(xml, tag, "—").xml;
        if (labelTag) xml = replaceTagRun(xml, labelTag, "—").xml;
        return;
      }
      if (labelTag) {
        xml = replaceTagRun(xml, labelTag, metric.label).xml;
      } else {
        xml = replaceCardLabel(xml, tag, metric.label);
      }
      const relId = nativeIconRelIds[resolveMetricIconId(metric)];
      if (relId) xml = replaceCardIcon(xml, tag, relId);
      xml = replaceTagRun(xml, tag, metric.value).xml;
    });
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
        METRIC_8_LABEL: "—",
        METRIC_8_VALUE: "—",
        DATE_RANGE: slide.dateRangeLine,
        CAMPAIGN_SUMMARY: ai.summary,
        KEY_INSIGHTS: ai.insights,
      },
      {
        // Fix 5 — bumped alongside its dynamic-slots sibling above.
        DATE_RANGE: { sizePt: 13, bold: true },
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
  // Fix 4 (readability pass) — floor pass for anything not already covered
  // above by an explicit sizePt override: catches the template's own
  // static card labels ("AD SPEND"/"REACH"/"IMPRESSIONS"/"CTR (All)"/
  // "CPC (All)", plus {{RESULT_LABEL}}/{{COST_LABEL}} once retexted),
  // stored at 11.5pt in templates/dark.pptx and never routed through a
  // styleOverride (replaceCardLabel only swaps their text, not their
  // styling).
  return enforceMinFontSize(xml, 12);
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
      METRIC_8_LABEL: "—",
      METRIC_8_VALUE: "—",
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
