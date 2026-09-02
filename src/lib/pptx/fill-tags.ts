/**
 * Slide-level {{TAG}} filling — sits on top of ooxml.ts's single-tag
 * replaceTagRun to fill a whole slide's tag set, plus the specific style
 * overrides that reproduce the source's FINAL, after-all-passes-settle
 * appearance (see the long comment above buildCampaignOrAdSetSlideXml).
 */

import { additionalMetricsHeading } from "../nre/available-metrics";
import { buildCombinedTotalTableGrid, type CoverData, type Platform, type ReportType, type SlideData, type TableHeaderLabels, type TableRowData } from "../nre/report-data";
import { buildGoogleCombinedTotalTableGrid } from "../nre/google-report-data";
import {
  cloneShapeAsTag,
  ensureCardLabelValueGap,
  enforceMinFontSize,
  findCardIconRelId,
  forceRunStyle,
  hideCardSlot,
  insertShapeBeforeSpTreeClose,
  ptToEmu,
  replaceCardIcon,
  replaceCardLabel,
  replaceLiteralText,
  replaceTagRun,
  replaceTagRunWithSuffixes,
  setShapeNormAutofit,
  setShapeOffsetY,
  type StyleOverride,
} from "./ooxml";
import { textBox } from "./shapes";
import { fillCombinedTotalTable } from "./table-slide";
import type { TemplateSlide } from "./package";
import { emuToPt, estimateTextWidthPt, fitCardLabel, fitFontSizePt } from "./text-fit";
import { resolveMetricIconId, type MetricIconId } from "./metric-icons";

// Metric card label/value spacing fix — see ensureCardLabelValueGap's own
// doc comment in ooxml.ts. Applied to every one of the 8 card slots,
// unconditionally, regardless of label length.
const MIN_CARD_LABEL_VALUE_GAP_EMU = ptToEmu(4);

// ACCOUNT_NAME shape (ppt/slides/slide1.xml, cover template): cx="5300000"
// lIns="0" rIns="0" — keep in sync if the shape's width or insets ever
// change in templates/dark.pptx.
const ACCOUNT_NAME_MAX_WIDTH_PT = emuToPt(5300000);
const ACCOUNT_NAME_CANDIDATE_SIZES_PT = [30, 28, 24, 20, 18];

// CAMPAIGN_NAME shape (ppt/slides/slide2.xml, campaign/ad-set template):
// cx="11433300" lIns="91425" rIns="91425" — keep in sync with the template.
const CAMPAIGN_NAME_MAX_WIDTH_PT = emuToPt(11433300 - 91425 * 2);
// Fix 6 (round K, heading hierarchy) — ceiling raised from 18pt to 22pt: the
// campaign/ad-set name is now the single most prominent text on the slide
// (see buildCampaignOrAdSetSlideXml's own doc comment), out-sizing both the
// "(Campaign)"/"(Ad Set)" type label next to it and the report-type header
// above it. Floor stays 16pt (Fix 4, readability pass) — a name long enough
// to need the smaller candidates wraps instead of shrinking further.
const CAMPAIGN_NAME_CANDIDATE_SIZES_PT = [24, 22, 20, 18];
// Fixed, not part of the auto-shrink candidates above — the type label
// always renders at this size regardless of how long the name itself is.
const TYPE_LABEL_SIZE_PT = 17;
const CAMPAIGN_LABEL_COLOR = "f6ad55"; // amber — primary accent, matches the donut ring/summary-bar amber elsewhere in the deck
const AD_SET_LABEL_COLOR = "63b3ed"; // light blue — secondary accent, visually distinct from the campaign label at a glance
// Round L — the muted-grey report-type header ("YOUR WEEKLY/MONTHLY
// PERFORMANCE REPORT") reads at the SAME size as every other slide's own
// main heading (cover's REPORT_TITLE, the MTD chart title, the Combined
// Total and Metric Guide slide titles — see the matching color/size
// overrides in this file, chart-slide.ts, and legend-slide.ts), even
// though the campaign/ad-set name right below it is a hair smaller (22pt)
// — this is deliberate: the report-type line is uniform "chrome" repeated
// on every slide, while the name is the slide's own prominent identifier.
export const REPORT_HEADER_COLOR = "94a3b8"; // muted grey — used uniformly for every slide type's own main heading
export const REPORT_HEADER_SIZE_PT = 30;
/** MTD Visual Chart slide title — slightly smaller so long date ranges stay on one line. */
export const VISUAL_CHART_TITLE_SIZE_PT = 28;

/**
 * Largest candidate size (checked largest-first) whose estimated width,
 * PLUS the fixed-size type-label text right after it on the same line,
 * still fits the shape — same idea as text-fit.ts's own fitFontSizePt, but
 * accounting for a second run (the type label) that never changes size
 * alongside the name that does.
 */
function fitNameSizePt(name: string, typeLabelText: string | null, maxWidthPt: number, candidateSizesPt: number[]): number {
  const labelWidthPt = typeLabelText ? estimateTextWidthPt(typeLabelText, TYPE_LABEL_SIZE_PT) : 0;
  for (const sizePt of candidateSizesPt) {
    if (estimateTextWidthPt(name, sizePt) + labelWidthPt <= maxWidthPt) return sizePt;
  }
  return candidateSizesPt[candidateSizesPt.length - 1];
}

function fillTags(xml: string, values: Record<string, string>, styleOverrides: Record<string, StyleOverride> = {}): string {
  let out = xml;
  for (const [tag, value] of Object.entries(values)) {
    out = replaceTagRun(out, `{{${tag}}}`, value, styleOverrides[tag]).xml;
  }
  return out;
}

// Fix 3 (permanent overflow fix) — hard render-time ceilings on the
// Campaign Summary / Key Insights text boxes, tighter than ai/prompts.ts's
// own upstream AI-response safety net (capSummary/capInsights, 400/500
// chars) and enforced at the point these strings actually get laid out on
// the campaign/ad-set slide, not just at AI-generation time. Reported
// symptom this fixes: Campaign Summary text touching the Key Insights
// heading below it, and Key Insights text getting cut off at the bottom of
// the slide.
const CAMPAIGN_SUMMARY_MAX_CHARS = 300;
const KEY_INSIGHTS_MAX_CHARS = 400;

/**
 * True when `text[index]` is a period that reads as a SENTENCE end — at the
 * end of the string, or followed by whitespace — rather than a decimal
 * point inside a number like "$2.50", which is always followed immediately
 * by another digit, never whitespace. A bare `lastIndexOf(".", limit)` would
 * happily cut a response off mid-value.
 */
function isSentenceEndingPeriod(text: string, index: number): boolean {
  if (text[index] !== ".") return false;
  const next = text[index + 1];
  return next === undefined || /\s/.test(next);
}

function lastSentenceEndAtOrBefore(text: string, limit: number): number {
  for (let i = Math.min(limit, text.length - 1); i >= 0; i--) {
    if (isSentenceEndingPeriod(text, i)) return i;
  }
  return -1;
}

/**
 * Truncates `raw` to at most `maxChars`, always ending on a complete
 * sentence (a real sentence-ending period, never mid-sentence) — never a
 * hard character cut except in the pathological case where the text has no
 * sentence boundary at all within that span, which only ever happens for
 * punctuation-free AI output.
 */
function truncateToSentence(raw: string, maxChars: number): string {
  const text = raw.trim();
  if (text.length <= maxChars) return text;
  const cut = lastSentenceEndAtOrBefore(text, maxChars);
  return cut >= 0 ? text.slice(0, cut + 1) : text.slice(0, maxChars).trim() + ".";
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

const DEFAULT_DAILY_REPORT_TITLE = "Daily Performance Report";
const DEFAULT_CREATIVE_REPORT_TITLE = "Creative Performance Report";

const DEFAULT_COMPARISON_REPORT_TITLE = "Comparison Performance Report";

const GENERIC_REPORT_TITLES = new Set(
  [
    DEFAULT_REPORT_TITLE,
    DEFAULT_MONTHLY_REPORT_TITLE,
    DEFAULT_DAILY_REPORT_TITLE,
    DEFAULT_CREATIVE_REPORT_TITLE,
    DEFAULT_COMPARISON_REPORT_TITLE,
  ].map((t) => t.toUpperCase()),
);

/** Resolves the cover subtitle — custom titles win; generic defaults follow reportType. */
export function resolveCoverReportTitle(
  reportTitle: string | null | undefined,
  reportType?: ReportType | "COMPARISON",
): string {
  const defaultTitle =
    reportType === "MONTHLY"
      ? DEFAULT_MONTHLY_REPORT_TITLE
      : reportType === "DAILY"
        ? DEFAULT_DAILY_REPORT_TITLE
        : reportType === "CREATIVE"
          ? DEFAULT_CREATIVE_REPORT_TITLE
          : reportType === "COMPARISON"
            ? DEFAULT_COMPARISON_REPORT_TITLE
            : DEFAULT_REPORT_TITLE;
  const trimmed = reportTitle?.trim() ?? "";
  if (!trimmed || GENERIC_REPORT_TITLES.has(trimmed.toUpperCase())) {
    return defaultTitle.toUpperCase();
  }
  return trimmed.toUpperCase();
}

export interface CoverSlideOptions {
  /** Optional custom title replacing the template's default "WEEKLY PERFORMANCE REPORT" — falls back to DEFAULT_REPORT_TITLE (or DEFAULT_MONTHLY_REPORT_TITLE/DEFAULT_COMPARISON_REPORT_TITLE — see `reportType`) when blank. Always rendered upper-cased to match the template's existing all-caps styling. */
  reportTitle?: string | null;
  /** Agency name from account settings — when set, adds a "Prepared by ..." line below the account name; when absent, the cover renders exactly as it does without this feature. */
  agencyName?: string | null;
  /**
   * Fix 8 — only affects the DEFAULT title text used when `reportTitle` is
   * blank/absent or still set to another report type's generic default
   * ("MONTHLY PERFORMANCE REPORT" instead of "WEEKLY PERFORMANCE REPORT");
   * a truly custom reportTitle always wins regardless.
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

  const reportTitle = resolveCoverReportTitle(options.reportTitle, options.reportType);

  return fillTags(
    xml,
    {
      ACCOUNT_NAME: cover.accountName,
      REPORT_TITLE: reportTitle,
      REPORT_DATE: cover.reportDate,
      DATE_RANGE: cover.dateRange,
      ACCOUNT_HEALTH_BADGE: cover.healthBadge,
      BUDGET_SUMMARY: "",
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
      REPORT_DATE: { sizePt: 15 },
      ACCOUNT_HEALTH_BADGE: { sizePt: 15, bold: true },
      BUDGET_SUMMARY: { sizePt: 14 },
      // Round L — recolored to the same muted grey every other slide's own
      // main heading uses (the campaign/ad-set report-type header, the MTD
      // chart title, the Combined Total and Metric Guide slide titles),
      // replacing the template's own theme accent-4 (blue). Size stays the
      // template's native 20pt — Round L only asked to unify colors here,
      // not sizes, on the non-campaign slide types.
      REPORT_TITLE: { color: REPORT_HEADER_COLOR },
    },
  );
}

export interface AiCopy {
  summary: string;
  insights: string;
}

const FALLBACK_AI_COPY: AiCopy = {
  summary: "Campaign performance for this period is shown on the metric cards.",
  insights: "Use the numbers on this slide to decide the one next change worth making.",
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

function slideReportHeader(reportType: ReportType = "WEEKLY"): string {
  if (reportType === "MONTHLY") return "YOUR MONTHLY PERFORMANCE REPORT";
  if (reportType === "DAILY") return "YOUR DAILY PERFORMANCE REPORT";
  if (reportType === "CREATIVE") return "YOUR CREATIVE PERFORMANCE REPORT";
  return "YOUR WEEKLY PERFORMANCE REPORT";
}

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
  const isAdSetKind = slide.kind === "adset";
  const nameOnly = isAdSetKind ? slide.adSetName || slide.campaignName : slide.campaignName;
  const heading = useAdditionalMetricsSlide ? additionalMetricsHeading(nameOnly) : nameOnly;

  // Fix 6 (round K) — the "(Campaign)"/"(Ad Set)"/"(Ad Group)" type label is
  // its own colored run, not baked into the heading text, so it reads as a
  // visually distinct badge next to the name rather than part of the name
  // itself (amber for a campaign slide, blue for an ad-set slide). Never
  // shown on an "Additional Metrics" continuation slide (its own distinct
  // "[Name] — Additional Metrics" heading), nor on an ad-set slide that had
  // no real ad-set name to label (falls back to showing the bare campaign
  // name, which a "(Ad Set)" badge would misdescribe).
  const typeLabelText = useAdditionalMetricsSlide
    ? null
    : isAdSetKind
      ? slide.adSetName
        ? adGroupOrSetLabel
        : null
      : " (Campaign)";
  const typeLabelColor = isAdSetKind ? AD_SET_LABEL_COLOR : CAMPAIGN_LABEL_COLOR;

  // Small "Paused"/"Inactive" badge right after the name (and after the
  // type label, if present) — null (no badge at all) for active
  // campaigns/ad sets and whenever the CSV has no delivery-status column to
  // judge it from.
  const statusSuffix = slide.statusIndicator ? `  (${slide.statusIndicator})` : null;

  const dynamicSlots = useAdditionalMetricsSlide ? slide.additionalMetricsSlide : slide.dynamicMetrics;
  const useDynamicSlots = !!dynamicSlots && dynamicSlots.length > 0;

  // Fix 3 (permanent overflow fix) — truncate to the hard char caps (always
  // ending on a complete sentence), so Campaign Summary never touches the
  // Key Insights heading below it and Key Insights never gets cut off at
  // the bottom of the slide. Applies to both branches below and to
  // buildPausedSlideXml, across all 3 templates (the same template clone).
  const summaryText = truncateToSentence(ai.summary, CAMPAIGN_SUMMARY_MAX_CHARS);
  const insightsText = truncateToSentence(ai.insights, KEY_INSIGHTS_MAX_CHARS);
  // Fixed 14pt for both — no longer shrinks below 14pt for longer text (the
  // previous graduated reduction, -1pt past 250 characters, -2pt past 300,
  // could land Campaign Summary at 13pt/12pt within its own 300-char cap).
  // Overflow protection comes from the char-cap truncation above and the
  // CAMPAIGN_SUMMARY/KEY_INSIGHTS text boxes' own normAutofit (shrink-to-fit)
  // setting below, not from pre-shrinking the requested size here.
  const summarySizePt = 15;
  const insightsSizePt = 15;

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
    let templateXml = setShapeNormAutofit(template.xml, "{{CAMPAIGN_SUMMARY}}");
    templateXml = setShapeNormAutofit(templateXml, "{{KEY_INSIGHTS}}");
    xml = fillTags(
      templateXml,
      {
        DATE_RANGE: slide.dateRangeLine,
        CAMPAIGN_SUMMARY: summaryText,
        KEY_INSIGHTS: insightsText,
      },
      {
        // Fix 4 (readability pass), bumped further by Fix 5 (13pt -> still
        // 13pt, now also bold) — covers both the date-range line and the
        // "Ad Frequency: ..." line right below it, which share this same
        // tag run (see report-data.ts's freqLine, joined in with a literal
        // "\n" — replaceTagRun splits on it but keeps one shared rPr for
        // every resulting line). OOXML only has a binary bold toggle, not
        // numeric font weights, so "600/semibold" maps to `bold: true`.
        DATE_RANGE: { sizePt: 14, bold: true },
        CAMPAIGN_SUMMARY: { bold: false, sizePt: summarySizePt, fontFamily: "Poppins" },
        KEY_INSIGHTS: { bold: false, sizePt: insightsSizePt, fontFamily: "Poppins" },
      },
    );

    // Fix 4 (readability pass) floor, moved here (before any card-label
    // sizing below) rather than at the very end: it must run BEFORE the
    // label auto-shrink fix's own per-label sizePt overrides, since a
    // long label is deliberately sized below this 12pt floor — if the
    // floor ran last (as it used to, unconditionally, over the whole
    // slide) it would immediately undo that shrink. Running it here still
    // catches every card label untouched by the loop below (the "fewer
    // than 8 metrics assigned" dash case), same as before.
    xml = enforceMinFontSize(xml, 13);

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
        // Card label/value spacing fix — applied to every slot
        // unconditionally, including this dashed-out one, while `tag` is
        // still present in the xml to locate the value shape by (it gets
        // consumed by the replaceTagRun call right after).
        xml = ensureCardLabelValueGap(xml, tag, MIN_CARD_LABEL_VALUE_GAP_EMU);
        // Continuation slides hide unused card chrome so 1–3 extras do not
        // sit next to seven dashed empty slots. Primary slides still dash
        // unused slots (the default 8-card pack layout).
        if (useAdditionalMetricsSlide) {
          xml = hideCardSlot(
            xml,
            tag,
            CARD_SLOT_TAGS.filter((other) => other !== tag),
          );
          // Card XML is gone — do not dash leftover tags that no longer exist.
          if (!xml.includes(tag)) return;
        }
        // Unused physical slots must blank the leftover template label too
        // (slot 7 is static "CPC (All)"). A dash-only value used to leave
        // that CPC (All) title on client decks when the CSV had fewer than
        // 8 honest chips. Hidden continuation slots still consume the tags
        // so no raw {{TAG}} leaks if a viewer ignores hidden="1".
        if (labelTag) xml = replaceTagRun(xml, labelTag, "—").xml;
        else xml = replaceCardLabel(xml, tag, "—");
        xml = replaceTagRun(xml, tag, "—").xml;
        return;
      }
      // Metric card label overflow fix: shrink long labels by a fixed
      // amount based on character-count band, truncating with "..." past
      // 35 characters where even the largest reduction can't reliably
      // keep the label on one line.
      const { text: labelText, sizePt: labelSizePt } = fitCardLabel(metric.label);
      if (labelTag) {
        xml = replaceTagRun(xml, labelTag, labelText, { sizePt: labelSizePt }).xml;
      } else {
        xml = replaceCardLabel(xml, tag, labelText, { sizePt: labelSizePt });
      }
      const relId = nativeIconRelIds[resolveMetricIconId(metric)];
      if (relId) xml = replaceCardIcon(xml, tag, relId);
      xml = ensureCardLabelValueGap(xml, tag, MIN_CARD_LABEL_VALUE_GAP_EMU);
      xml = replaceTagRun(xml, tag, metric.value).xml;
    });
  } else {
    let templateXml = setShapeNormAutofit(template.xml, "{{CAMPAIGN_SUMMARY}}");
    templateXml = setShapeNormAutofit(templateXml, "{{KEY_INSIGHTS}}");
    xml = fillTags(
      templateXml,
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
        CAMPAIGN_SUMMARY: summaryText,
        KEY_INSIGHTS: insightsText,
      },
      {
        // Fix 5 — bumped alongside its dynamic-slots sibling above.
        DATE_RANGE: { sizePt: 14, bold: true },
        CAMPAIGN_SUMMARY: { bold: false, sizePt: summarySizePt, fontFamily: "Poppins" },
        KEY_INSIGHTS: { bold: false, sizePt: insightsSizePt, fontFamily: "Poppins" },
      },
    );
    xml = applyGoogleAdsCardLabels(xml, platform);
    // Fix 4 (readability pass) floor — this branch has no per-label
    // overrides at all, so (unlike the dynamic-slots branch above) there's
    // nothing for this to clobber; kept in the same relative position as
    // before this change.
    xml = enforceMinFontSize(xml, 13);
  }

  const campaignNameSizePt = fitNameSizePt(heading, typeLabelText, CAMPAIGN_NAME_MAX_WIDTH_PT, CAMPAIGN_NAME_CANDIDATE_SIZES_PT);
  xml = replaceTagRunWithSuffixes(xml, "{{CAMPAIGN_NAME}}", heading, { sizePt: campaignNameSizePt, bold: true }, [
    typeLabelText ? { text: typeLabelText, style: { sizePt: TYPE_LABEL_SIZE_PT, bold: false, color: typeLabelColor } } : null,
    statusSuffix ? { text: statusSuffix, style: { sizePt: 13, bold: true, color: INACTIVE_TAG_COLOR } } : null,
  ]).xml;
  // Round L — the report-type header stays muted grey (color is still
  // secondary to the bold-white campaign/ad-set name below it) but is now
  // the SAME 24pt size as every other slide's own main heading, not a
  // shrunken 14pt — see REPORT_HEADER_SIZE_PT's own doc comment.
  const header = slideReportHeader(reportType);
  xml = replaceLiteralText(xml, "YOUR WEEKLY PERFORMANCE REPORT", header);
  xml = forceRunStyle(xml, header, { bold: true, sizePt: REPORT_HEADER_SIZE_PT, color: REPORT_HEADER_COLOR });
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
  const summaryText = truncateToSentence(pausedMessage, CAMPAIGN_SUMMARY_MAX_CHARS);
  const insightsText = truncateToSentence(
    "Campaigns paused — no data recorded for this period. Awaiting instructions to resume.",
    KEY_INSIGHTS_MAX_CHARS,
  );
  let templateXml = setShapeNormAutofit(template.xml, "{{CAMPAIGN_SUMMARY}}");
  templateXml = setShapeNormAutofit(templateXml, "{{KEY_INSIGHTS}}");
  let xml = fillTags(
    templateXml,
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
      CAMPAIGN_SUMMARY: summaryText,
      KEY_INSIGHTS: insightsText,
    },
    {
      CAMPAIGN_NAME: { sizePt: 18 },
      CAMPAIGN_SUMMARY: { bold: false, sizePt: 14, fontFamily: "Poppins" },
      KEY_INSIGHTS: { bold: false, sizePt: 14, fontFamily: "Poppins" },
    },
  );
  xml = applyGoogleAdsCardLabels(xml, platform);
  const header = slideReportHeader(reportType);
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
  combinedTotalStory = "",
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
  const xml = fillCombinedTotalTable(template.xml, grid, {
    hideRowIndexes: [...(hidePeriodRow ? [1] : []), ...(hideMtdRow ? [2] : [])],
    hideColIndexes: headers.resultColumns.length <= 1 ? [8, 9] : [],
    isLightTemplate,
  });
  let out = forceRunStyle(xml, "MONTHLY CAMPAIGN PERFORMANCE OVERVIEW", { color: REPORT_HEADER_COLOR });
  if (combinedTotalStory.trim()) {
    out = insertShapeBeforeSpTreeClose(
      out,
      textBox({
        x: 40,
        y: 82,
        w: 880,
        h: 28,
        text: combinedTotalStory.trim(),
        sizePt: 16,
        colorHex: REPORT_HEADER_COLOR,
        align: "ctr",
      }),
    );
  }
  return out;
}
