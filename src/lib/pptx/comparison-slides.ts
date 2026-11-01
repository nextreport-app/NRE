/**
 * Comparison report slide builders — a separate, parallel rendering path
 * from fill-tags.ts's template-based weekly/monthly slides (see
 * report-data.ts's own "Comparison reports" section header for why the data
 * layer is split the same way). Only the cover slide reuses the existing
 * template (via fill-tags.ts's buildCoverSlideXml, unmodified) with its
 * health-score line simply left blank; the campaign and summary slides are
 * built entirely from scratch in OOXML, the same approach chart-slide.ts
 * and legend-slide.ts already use for slides the template has no matching
 * layout for.
 */

import { comparisonTone, comparisonPercent } from "../nre/comparison-presentation";
import { setShapeExtCx, setShapeWrap, insertShapeBeforeSpTreeClose } from "./ooxml";
import { backgroundImage, buildBlankSlideXml, rectangle, resetShapeIdCounter, roundedCard, textBox } from "./shapes";
import type { TemplateBackgroundImage, TemplateSlide } from "./package";
import { buildCoverSlideXml } from "./fill-tags";
import type { ComparisonCampaignData, ComparisonChange, ComparisonReportData } from "../nre/report-data";
import { slideSurfacePalette, type SlideSurfacePalette } from "./slide-surface-palette";

/** Relationship id the comparison campaign/summary slides' own generated rels (see render.ts) register the copied background picture under — mirrors chart-slide.ts's CHART_BG_REL_ID. */
export const COMPARISON_BG_REL_ID = "rId2";

const CHANGE_UP_BG = "68d391";
const CHANGE_DOWN_BG = "fc8181";
const CHANGE_FLAT_BG = "64748b";
const CHANGE_NEW_BG = "f6ad55";

function changeBadgeColors(change: ComparisonChange, palette: SlideSurfacePalette, metric: string, label: string): { bg: string; text: string } {
  if (change.direction === "new") return { bg: CHANGE_NEW_BG, text: palette.changeDarkText };
  const tone = comparisonTone(metric, label, change.percent);
  if (tone === "positive") return { bg: CHANGE_UP_BG, text: palette.changeDarkText };
  if (tone === "negative") return { bg: CHANGE_DOWN_BG, text: palette.changeDarkText };
  return { bg: CHANGE_FLAT_BG, text: "FFFFFF" };
}

function changeBadgeText(change: ComparisonChange): string {
  if (change.direction === "new") return "NEW";
  const arrow = change.direction === "up" ? "↑" : change.direction === "down" ? "↓" : "→";
  return `${comparisonPercent(change.percent)} ${arrow}`;
}

/**
 * Comparison cover slide — "same as the regular cover slide but" (spec):
 * title becomes "COMPARISON PERFORMANCE REPORT" (via buildCoverSlideXml's
 * own reportType: "COMPARISON" branch — see fill-tags.ts), Period A/B
 * labels show where the date range normally would, and the health score
 * line is simply left blank (an empty ACCOUNT_HEALTH_BADGE tag fill reads
 * as no line at all — the badge emoji/text is part of the string value
 * itself, not a separate template decoration, so there's no leftover
 * bullet/icon to also strip). budgetSummary is blanked too: "Monthly Ad
 * Budget: X of Y used" has no clean meaning across two arbitrary
 * wizard-picked periods.
 */
export function buildComparisonCoverSlideXml(
  template: TemplateSlide,
  comparison: ComparisonReportData,
  options: { agencyName?: string | null; reportTitle?: string | null; isLightTemplate?: boolean } = {},
): string {
  const dates = `${comparison.periodALabel} vs ${comparison.periodBLabel}`;
  let xml = buildCoverSlideXml(
    template,
    {
      accountName: comparison.accountName,
      reportDate: dates,
      dateRange: "",
      healthBadge: "",
      healthScore: 0,
      budgetSummary: "",
    },
    { agencyName: options.agencyName, reportTitle: options.reportTitle, reportType: "COMPARISON", isLightTemplate: options.isLightTemplate },
  );
  if (comparison.comparisonLabel) {
    const ids = [...xml.matchAll(/<p:cNvPr id="(\d+)"/g)].map(match => Number(match[1]));
    resetShapeIdCounter(Math.max(1, ...ids));
    xml = insertShapeBeforeSpTreeClose(xml, textBox({ x: 40, y: 166, w: 455, h: 28, text: comparison.comparisonLabel, sizePt: 17, bold: true, colorHex: slideSurfacePalette(!!options.isLightTemplate).heading, align: "l" }));
  }
  return setShapeWrap(setShapeExtCx(xml, dates, 880 * 12700), dates, "none");
}

const W = 960;

export interface ComparisonMetricRow {
  unavailable?: boolean;
  key: string;
  label: string;
  valueA: string;
  valueB: string;
  change: ComparisonChange;
}

/**
 * One comparison slide per campaign — two vertical card columns (Period A
 * left, Period B right) with a change badge floating between them for each
 * of the 4 metric rows (Ad Spend / Reach / [objective] / [cost per
 * objective]), per spec's mockup. Built from scratch (no matching template
 * layout exists for a two-column comparison card grid) — same from-scratch
 * OOXML approach as chart-slide.ts.
 */
export function buildComparisonCampaignSlideXml(
  campaign: ComparisonCampaignData,
  periodALabel: string,
  periodBLabel: string,
  background: TemplateBackgroundImage,
  isLightTemplate = false,
  periodTitles?: { a: string; b: string },
): string {
  const rows: ComparisonMetricRow[] = [
    { key: "spend", label: "AD SPEND", valueA: campaign.metricsA.spend.formatted, valueB: campaign.metricsB.spend.formatted, change: campaign.changes.spend },
    { key: "reach", label: "REACH", valueA: campaign.metricsA.reach.formatted, valueB: campaign.metricsB.reach.formatted, change: campaign.changes.reach },
    { key: "results", label: campaign.objective, valueA: campaign.metricsA.results.formatted, valueB: campaign.metricsB.results.formatted, change: campaign.changes.results },
    { key: "cpr", label: campaign.costLabel, valueA: campaign.metricsA.cpr.formatted, valueB: campaign.metricsB.cpr.formatted, change: campaign.changes.cpr },
  ];
  return buildComparisonMetricSlideXml(campaign.campaignName, rows, periodALabel, periodBLabel, background, isLightTemplate, undefined, periodTitles);
}

export function buildComparisonMetricSlideXml(
  campaignName: string,
  rows: ComparisonMetricRow[],
  periodALabel: string,
  periodBLabel: string,
  background: TemplateBackgroundImage,
  isLightTemplate = false,
  footer?: string,
  periodTitles?: { a: string; b: string },
): string {
  const palette = slideSurfacePalette(isLightTemplate);
  resetShapeIdCounter();
  const shapes: string[] = [];
  shapes.push(backgroundImage({ relId: COMPARISON_BG_REL_ID, ...background }));

  const MARGIN = 40;
  const TITLE_Y = 28;
  const TITLE_H = 32;
  shapes.push(
    textBox({
      x: MARGIN,
      y: TITLE_Y,
      w: W - MARGIN * 2,
      h: TITLE_H,
      text: `${campaignName} (Campaign)`,
      sizePt: 22,
      bold: true,
      colorHex: palette.text,
      align: "l",
    }),
  );

  const DIVIDER_Y = TITLE_Y + TITLE_H + 6;
  shapes.push(rectangle({ x: MARGIN, y: DIVIDER_Y, w: W - MARGIN * 2, h: 1, fillHex: palette.cardStroke }));

  // Column geometry — Period A (left), a narrow change-badge gutter
  // (center), Period B (right); see the file header's own layout note.
  const COL_W = 320;
  const BADGE_W = 140;
  const COL_GAP = 20;
  const contentW = COL_W * 2 + BADGE_W + COL_GAP * 2;
  const colAX = (W - contentW) / 2;
  const badgeX = colAX + COL_W + COL_GAP;
  const colBX = badgeX + BADGE_W + COL_GAP;

  const HEADER_Y = DIVIDER_Y + 18;
  const HEADER_H = 22;
  shapes.push(textBox({ x: colAX, y: HEADER_Y, w: COL_W, h: HEADER_H, text: periodTitles?.a ?? "PERIOD A", sizePt: 15, bold: true, colorHex: palette.heading }));
  shapes.push(textBox({ x: badgeX, y: HEADER_Y, w: BADGE_W, h: HEADER_H, text: "vs", sizePt: 13, colorHex: palette.label }));
  shapes.push(textBox({ x: colBX, y: HEADER_Y, w: COL_W, h: HEADER_H, text: periodTitles?.b ?? "PERIOD B", sizePt: 15, bold: true, colorHex: palette.heading }));

  const SUBHEADER_Y = HEADER_Y + HEADER_H + 2;
  const SUBHEADER_H = 16;
  shapes.push(textBox({ x: colAX, y: SUBHEADER_Y, w: COL_W, h: SUBHEADER_H, text: periodALabel, sizePt: 12, colorHex: palette.label }));
  shapes.push(textBox({ x: colBX, y: SUBHEADER_Y, w: COL_W, h: SUBHEADER_H, text: periodBLabel, sizePt: 12, colorHex: palette.label }));

  const ROWS_TOP = SUBHEADER_Y + SUBHEADER_H + 22;
  const CARD_H = 64;
  const ROW_GAP = 16;
  const CARD_PAD_X = 16;



  rows.forEach((row, i) => {
    const y = ROWS_TOP + i * (CARD_H + ROW_GAP);

    for (const [x, value] of [
      [colAX, row.valueA],
      [colBX, row.valueB],
    ] as const) {
      shapes.push(roundedCard({ x, y, w: COL_W, h: CARD_H, fillHex: palette.cardFill, strokeHex: palette.cardStroke, radiusPt: 6 }));
      shapes.push(
        textBox({
          x: x + CARD_PAD_X,
          y: y + 10,
          w: COL_W - CARD_PAD_X * 2,
          h: 16,
          text: row.label,
          sizePt: 12,
          bold: true,
          colorHex: palette.label,
        }),
      );
      shapes.push(
        textBox({
          x: x + CARD_PAD_X,
          y: y + 28,
          w: COL_W - CARD_PAD_X * 2,
          h: 28,
          text: value,
          sizePt: 22,
          bold: true,
          colorHex: palette.text,
        }),
      );
    }

    const { bg, text } = row.unavailable ? { bg: CHANGE_FLAT_BG, text: "FFFFFF" } : changeBadgeColors(row.change, palette, row.key, row.label);
    const BADGE_H = 30;
    const badgeY = y + (CARD_H - BADGE_H) / 2;
    shapes.push(roundedCard({ x: badgeX, y: badgeY, w: BADGE_W, h: BADGE_H, fillHex: bg, strokeHex: bg, radiusPt: 15 }));
    shapes.push(
      textBox({
        x: badgeX,
        y: badgeY + 6,
        w: BADGE_W,
        h: 18,
        text: row.unavailable ? "N/A" : changeBadgeText(row.change),
        sizePt: 13,
        bold: true,
        colorHex: text,
      }),
    );
  });

  if (footer) shapes.push(textBox({ x: 40, y: 505, w: 880, h: 17, text: footer, sizePt: 10, colorHex: palette.label }));
  return buildBlankSlideXml(shapes);
}

// ─────────────────────────── Summary table slide ────────────────────────────

function deltaText(change: ComparisonChange): string {
  return change.direction === "new" ? "NEW" : comparisonPercent(change.percent);
}

function deltaColor(change: ComparisonChange, palette: SlideSurfacePalette, metric: string): string {
  const tone = comparisonTone(metric, metric, change.percent);
  const light = palette.text === "0d1b2e";
  return tone === "positive" ? (light ? "15803d" : "68d391") : tone === "negative" ? (light ? "b91c1c" : "fc8181") : palette.label;
}

/** Three readable metric sections replace the cramped, seven-column grid. */
export function buildComparisonSummarySlideXml(
  comparison: ComparisonReportData,
  background: TemplateBackgroundImage,
  isLightTemplate = false,
  options?: { campaigns: ComparisonCampaignData[]; includeTotal: boolean; page: number; pages: number },
): string {
  const palette = slideSurfacePalette(isLightTemplate);
  resetShapeIdCounter();
  const shapes = [backgroundImage({ relId: COMPARISON_BG_REL_ID, ...background })];
  shapes.push(textBox({ x: 40, y: 20, w: 880, h: 32, text: `CAMPAIGN COMPARISON SUMMARY${options && options.pages > 1 ? ` (${options.page + 1}/${options.pages})` : ""}`, sizePt: 25, bold: true, colorHex: palette.heading }));
  shapes.push(textBox({ x: 40, y: 56, w: 880, h: 24, text: `Period A: ${comparison.periodALabel}   vs   Period B: ${comparison.periodBLabel}`, sizePt: 16, colorHex: palette.label }));
  const campaigns = options?.campaigns ?? comparison.campaigns;
  const includeTotal = options?.includeTotal ?? true;
  const objectives = new Set(comparison.campaigns.map(campaign => campaign.objective.trim().toUpperCase()));
  const sameObjective = objectives.size <= 1;
  const overlappingReach = comparison.campaigns.length > 1 && [...objectives].some(objective => objective === "REACH" || objective === "UNIQUE REACH");
  const comparableResultsTotal = sameObjective && !overlappingReach;
  const scaledCostTotal = comparison.campaigns.length > 1 && /(?:1k|1,?000|thousand)/i.test(comparison.campaigns[0]?.costLabel ?? "");
  const totalSource = comparison.campaigns.length === 1 ? comparison.campaigns[0] : comparison.totals;
  const sections = [
    { key: "spend" as const, label: "AD SPEND" },
    { key: "results" as const, label: sameObjective ? comparison.campaigns[0]?.objective ?? "RESULTS" : "RESULTS" },
    { key: "cpr" as const, label: sameObjective ? comparison.campaigns[0]?.costLabel ?? "COST PER RESULT" : "COST PER RESULT" },
  ];
  const columns = [{ x: 40, w: 400, align: "l" as const }, { x: 440, w: 180, align: "ctr" as const }, { x: 620, w: 180, align: "ctr" as const }, { x: 800, w: 120, align: "ctr" as const }];
  const rowHeight = 30;
  const rowCount = campaigns.length + (includeTotal ? 1 : 0);
  if (rowCount > 3) throw new Error("Paginate comparison summaries before rendering more than three rows.");
  const sectionHeight = 20 + 26 + rowCount * rowHeight + 8;
  const cell = (column: number, y: number, height: number, text: string, fill: string, color: string, bold: boolean, header = false) => {
    const col = columns[column];
    shapes.push(rectangle({ x: col.x, y, w: col.w, h: height, fillHex: fill }));
    shapes.push(textBox({ x: col.x + 10, y: y + (height - 24) / 2, w: col.w - 20, h: 24, text, sizePt: header ? 14 : column === 0 ? 15 : 17, colorHex: color, bold, align: col.align }));
  };
  sections.forEach((section, index) => {
    const top = 94 + index * sectionHeight;
    shapes.push(textBox({ x: 40, y: top, w: 880, h: 20, text: section.label, sizePt: 16, bold: true, colorHex: palette.heading, align: "l" }));
    ["CAMPAIGN", comparison.periodATitle ?? "PERIOD A", comparison.periodBTitle ?? "PERIOD B", "CHANGE"].forEach((label, column) => cell(column, top + 20, 26, label, palette.tableHeaderFill, isLightTemplate ? palette.tableHeaderLabel : palette.text, true, true));
    const draw = (name: string, a: string, b: string, change: ComparisonChange, row: number, total: boolean, comparable = true) => {
      const y = top + 46 + row * rowHeight;
      const fill = total ? palette.tableTotalFill : row % 2 ? palette.tablePeriodBFill : palette.tablePeriodAFill;
      const values = [name.length > 48 ? name.slice(0, 48) + "…" : name, comparable ? a : "N/A", comparable ? b : "N/A", comparable ? deltaText(change) : "N/A"];
      values.forEach((value, column) => cell(column, y, rowHeight, value, fill, column === 3 && comparable ? deltaColor(change, palette, section.key) : palette.text, total || column > 0));
    };
    campaigns.forEach((campaign, row) => draw(!sameObjective && section.key !== "spend" ? `${campaign.campaignName.slice(0, Math.max(12, 45 - campaign.objective.slice(0, 24).length))} · ${campaign.objective.slice(0, 24)}` : campaign.campaignName, campaign.metricsA[section.key].formatted, campaign.metricsB[section.key].formatted, campaign.changes[section.key], row, false));
    if (includeTotal) draw("TOTAL — ALL CAMPAIGNS", totalSource.metricsA[section.key].formatted, totalSource.metricsB[section.key].formatted, totalSource.changes[section.key], campaigns.length, true, section.key === "spend" || (comparableResultsTotal && (section.key !== "cpr" || !scaledCostTotal)));
  });
  const note = !sameObjective ? "Different campaign objectives: combined results and cost per result are not comparable." : overlappingReach ? "Campaign reach can overlap; combined reach results and cost per result are not comparable." : scaledCostTotal ? "Combined cost per result is unavailable for this cost unit; refer to each campaign’s cost above." : options && options.pages > 1 ? "Account totals appear on the final summary page." : "Cost per result = spend ÷ results. Lower costs are favourable; spend changes are neutral.";
  shapes.push(textBox({ x: 40, y: 521, w: 800, h: 15, text: note, sizePt: 11, colorHex: palette.label }));
  return buildBlankSlideXml(shapes);
}
