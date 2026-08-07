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

import { backgroundImage, buildBlankSlideXml, rectangle, resetShapeIdCounter, roundedCard, textBox } from "./shapes";
import type { TemplateBackgroundImage, TemplateSlide } from "./package";
import { buildCoverSlideXml } from "./fill-tags";
import type { ComparisonCampaignData, ComparisonChange, ComparisonReportData } from "../nre/report-data";

/** Relationship id the comparison campaign/summary slides' own generated rels (see render.ts) register the copied background picture under — mirrors chart-slide.ts's CHART_BG_REL_ID. */
export const COMPARISON_BG_REL_ID = "rId2";

const TEXT_COLOR = "FFFFFF";
const LABEL_COLOR = "94a3b8"; // muted grey — same token used across the wizard's own design polish (B4)
const HEADING_COLOR = "f6ad55"; // amber accent, matching the deck's other accent usage (legend card terms, health badges, etc.)
const CARD_FILL = "111f35";
const CARD_STROKE = "1e3a5f";

const CHANGE_UP_BG = "68d391";
const CHANGE_DOWN_BG = "fc8181";
const CHANGE_FLAT_BG = "64748b";
const CHANGE_NEW_BG = "f6ad55";
const CHANGE_DARK_TEXT = "0d1b2e";

function changeBadgeColors(change: ComparisonChange): { bg: string; text: string } {
  switch (change.direction) {
    case "up":
      return { bg: CHANGE_UP_BG, text: CHANGE_DARK_TEXT };
    case "down":
      return { bg: CHANGE_DOWN_BG, text: CHANGE_DARK_TEXT };
    case "new":
      return { bg: CHANGE_NEW_BG, text: CHANGE_DARK_TEXT };
    case "flat":
    default:
      return { bg: CHANGE_FLAT_BG, text: TEXT_COLOR };
  }
}

function changeBadgeText(change: ComparisonChange): string {
  if (change.direction === "new") return "NEW";
  const arrow = change.direction === "up" ? "↑" : change.direction === "down" ? "↓" : "→";
  const pct = change.percent ?? 0;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${Math.round(pct)}% ${arrow}`;
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
  options: { agencyName?: string | null; reportTitle?: string | null } = {},
): string {
  return buildCoverSlideXml(
    template,
    {
      accountName: comparison.accountName,
      reportDate: `${comparison.periodALabel}   vs   ${comparison.periodBLabel}`,
      dateRange: "",
      healthBadge: "",
      healthScore: 0,
      budgetSummary: "",
    },
    { agencyName: options.agencyName, reportTitle: options.reportTitle, reportType: "COMPARISON" },
  );
}

const W = 960;
const H = 540;

interface MetricRowSpec {
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
): string {
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
      text: `${campaign.campaignName} (Campaign)`,
      sizePt: 22,
      bold: true,
      colorHex: TEXT_COLOR,
      align: "l",
    }),
  );

  const DIVIDER_Y = TITLE_Y + TITLE_H + 6;
  shapes.push(rectangle({ x: MARGIN, y: DIVIDER_Y, w: W - MARGIN * 2, h: 1, fillHex: CARD_STROKE }));

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
  shapes.push(textBox({ x: colAX, y: HEADER_Y, w: COL_W, h: HEADER_H, text: "PERIOD A", sizePt: 15, bold: true, colorHex: HEADING_COLOR }));
  shapes.push(textBox({ x: badgeX, y: HEADER_Y, w: BADGE_W, h: HEADER_H, text: "vs", sizePt: 13, colorHex: LABEL_COLOR }));
  shapes.push(textBox({ x: colBX, y: HEADER_Y, w: COL_W, h: HEADER_H, text: "PERIOD B", sizePt: 15, bold: true, colorHex: HEADING_COLOR }));

  const SUBHEADER_Y = HEADER_Y + HEADER_H + 2;
  const SUBHEADER_H = 16;
  shapes.push(textBox({ x: colAX, y: SUBHEADER_Y, w: COL_W, h: SUBHEADER_H, text: periodALabel, sizePt: 12, colorHex: LABEL_COLOR }));
  shapes.push(textBox({ x: colBX, y: SUBHEADER_Y, w: COL_W, h: SUBHEADER_H, text: periodBLabel, sizePt: 12, colorHex: LABEL_COLOR }));

  const ROWS_TOP = SUBHEADER_Y + SUBHEADER_H + 22;
  const CARD_H = 64;
  const ROW_GAP = 16;
  const CARD_PAD_X = 16;

  const rows: MetricRowSpec[] = [
    { label: "AD SPEND", valueA: campaign.metricsA.spend.formatted, valueB: campaign.metricsB.spend.formatted, change: campaign.changes.spend },
    { label: "REACH", valueA: campaign.metricsA.reach.formatted, valueB: campaign.metricsB.reach.formatted, change: campaign.changes.reach },
    { label: campaign.objective, valueA: campaign.metricsA.results.formatted, valueB: campaign.metricsB.results.formatted, change: campaign.changes.results },
    { label: campaign.costLabel, valueA: campaign.metricsA.cpr.formatted, valueB: campaign.metricsB.cpr.formatted, change: campaign.changes.cpr },
  ];

  rows.forEach((row, i) => {
    const y = ROWS_TOP + i * (CARD_H + ROW_GAP);

    for (const [x, value] of [
      [colAX, row.valueA],
      [colBX, row.valueB],
    ] as const) {
      shapes.push(roundedCard({ x, y, w: COL_W, h: CARD_H, fillHex: CARD_FILL, strokeHex: CARD_STROKE, radiusPt: 6 }));
      shapes.push(
        textBox({
          x: x + CARD_PAD_X,
          y: y + 10,
          w: COL_W - CARD_PAD_X * 2,
          h: 16,
          text: row.label,
          sizePt: 12,
          bold: true,
          colorHex: LABEL_COLOR,
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
          colorHex: TEXT_COLOR,
        }),
      );
    }

    const { bg, text } = changeBadgeColors(row.change);
    const BADGE_H = 30;
    const badgeY = y + (CARD_H - BADGE_H) / 2;
    shapes.push(roundedCard({ x: badgeX, y: badgeY, w: BADGE_W, h: BADGE_H, fillHex: bg, strokeHex: bg, radiusPt: 15 }));
    shapes.push(
      textBox({
        x: badgeX,
        y: badgeY + 6,
        w: BADGE_W,
        h: 18,
        text: changeBadgeText(row.change),
        sizePt: 13,
        bold: true,
        colorHex: text,
      }),
    );
  });

  return buildBlankSlideXml(shapes);
}

// ─────────────────────────── Summary table slide ────────────────────────────

const TABLE_HEADER_FILL = "0d1b2e";
const TABLE_PERIOD_A_FILL = "16233d"; // slightly lighter than Period B's card fill, per spec
const TABLE_PERIOD_B_FILL = CARD_FILL;
const TABLE_NAME_FILL = CARD_FILL;
const TABLE_TOTAL_FILL = CARD_STROKE;
const DELTA_UP_TEXT = "68d391";
const DELTA_DOWN_TEXT = "fc8181";

function deltaText(change: ComparisonChange): string {
  if (change.direction === "new") return "NEW";
  const pct = change.percent ?? 0;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${Math.round(pct)}%`;
}

function deltaColor(change: ComparisonChange): string {
  if (change.direction === "up") return DELTA_UP_TEXT;
  if (change.direction === "down") return DELTA_DOWN_TEXT;
  return TEXT_COLOR;
}

interface TableCol {
  header: string;
  widthPt: number;
  fill: string;
  align: "l" | "ctr";
}

const TABLE_COLS: TableCol[] = [
  { header: "CAMPAIGN", widthPt: 220, fill: TABLE_NAME_FILL, align: "l" },
  { header: "SPEND A", widthPt: 105, fill: TABLE_PERIOD_A_FILL, align: "ctr" },
  { header: "SPEND B", widthPt: 105, fill: TABLE_PERIOD_B_FILL, align: "ctr" },
  { header: "Δ%", widthPt: 75, fill: TABLE_NAME_FILL, align: "ctr" },
  { header: "RESULTS A", widthPt: 105, fill: TABLE_PERIOD_A_FILL, align: "ctr" },
  { header: "RESULTS B", widthPt: 105, fill: TABLE_PERIOD_B_FILL, align: "ctr" },
  { header: "Δ%", widthPt: 75, fill: TABLE_NAME_FILL, align: "ctr" },
];

function tableCellXml(x: number, y: number, w: number, h: number, text: string, fill: string, textColor: string, bold: boolean, align: "l" | "ctr"): string {
  return (
    rectangle({ x, y, w, h, fillHex: fill }) +
    textBox({ x: x + 6, y: y + h / 2 - 8, w: w - 12, h: 16, text, sizePt: 12, bold, colorHex: textColor, align })
  );
}

/**
 * Single-slide "all campaigns side by side" summary — built as a grid of
 * rectangle cells + text boxes rather than a real DrawingML `<a:tbl>`
 * table: visually identical (solid fills, aligned columns/rows) but far
 * less schema-fragile to hand-generate, and every other from-scratch slide
 * in this codebase (chart/legend) already uses the same
 * shapes-composed-into-a-grid approach rather than raw `<a:tbl>` markup.
 */
export function buildComparisonSummarySlideXml(comparison: ComparisonReportData, background: TemplateBackgroundImage): string {
  resetShapeIdCounter();
  const shapes: string[] = [];
  shapes.push(backgroundImage({ relId: COMPARISON_BG_REL_ID, ...background }));

  const TITLE_Y = 24;
  shapes.push(
    textBox({ x: 0, y: TITLE_Y, w: W, h: 32, text: "CAMPAIGN COMPARISON SUMMARY", sizePt: 24, bold: true, colorHex: HEADING_COLOR }),
  );
  shapes.push(
    textBox({
      x: 0,
      y: TITLE_Y + 34,
      w: W,
      h: 20,
      text: `Period A: ${comparison.periodALabel}   vs   Period B: ${comparison.periodBLabel}`,
      sizePt: 14,
      colorHex: LABEL_COLOR,
    }),
  );

  const tableW = TABLE_COLS.reduce((sum, c) => sum + c.widthPt, 0);
  const tableX = (W - tableW) / 2;
  const tableTop = TITLE_Y + 34 + 20 + 20;
  const bottomMargin = 24;
  const availableH = H - tableTop - bottomMargin;

  const dataRowCount = comparison.campaigns.length + 1; // +1 for TOTAL
  const totalRows = dataRowCount + 1; // +1 for header
  const rowH = Math.min(34, Math.max(20, availableH / totalRows));

  let y = tableTop;
  let x = tableX;
  TABLE_COLS.forEach((col) => {
    shapes.push(tableCellXml(x, y, col.widthPt, rowH, col.header, TABLE_HEADER_FILL, TEXT_COLOR, true, col.align));
    x += col.widthPt;
  });
  y += rowH;

  comparison.campaigns.forEach((c) => {
    x = tableX;
    const cells: [string, string, "l" | "ctr"][] = [
      [c.campaignName.length > 28 ? c.campaignName.slice(0, 28) + "…" : c.campaignName, TABLE_NAME_FILL, "l"],
      [c.metricsA.spend.formatted, TABLE_PERIOD_A_FILL, "ctr"],
      [c.metricsB.spend.formatted, TABLE_PERIOD_B_FILL, "ctr"],
      [deltaText(c.changes.spend), TABLE_NAME_FILL, "ctr"],
      [c.metricsA.results.formatted, TABLE_PERIOD_A_FILL, "ctr"],
      [c.metricsB.results.formatted, TABLE_PERIOD_B_FILL, "ctr"],
      [deltaText(c.changes.results), TABLE_NAME_FILL, "ctr"],
    ];
    cells.forEach(([text, fill, align], i) => {
      const col = TABLE_COLS[i];
      const isDeltaCol = i === 3 || i === 6;
      const textColor = isDeltaCol ? deltaColor(i === 3 ? c.changes.spend : c.changes.results) : TEXT_COLOR;
      shapes.push(tableCellXml(x, y, col.widthPt, rowH, text, fill, textColor, isDeltaCol, align));
      x += col.widthPt;
    });
    y += rowH;
  });

  // TOTAL row
  x = tableX;
  const totals = comparison.totals;
  const totalCells: [string, "l" | "ctr"][] = [
    ["TOTAL", "l"],
    [totals.metricsA.spend.formatted, "ctr"],
    [totals.metricsB.spend.formatted, "ctr"],
    [deltaText(totals.changes.spend), "ctr"],
    [totals.metricsA.results.formatted, "ctr"],
    [totals.metricsB.results.formatted, "ctr"],
    [deltaText(totals.changes.results), "ctr"],
  ];
  totalCells.forEach(([text, align], i) => {
    const col = TABLE_COLS[i];
    const isDeltaCol = i === 3 || i === 6;
    const textColor = isDeltaCol ? deltaColor(i === 3 ? totals.changes.spend : totals.changes.results) : TEXT_COLOR;
    shapes.push(tableCellXml(x, y, col.widthPt, rowH, text, TABLE_TOTAL_FILL, textColor, true, align));
    x += col.widthPt;
  });

  return buildBlankSlideXml(shapes);
}
