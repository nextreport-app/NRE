/**
 * Dynamic metric-card grid — builds the flat-card shapes for the dynamic
 * metric dictionary system's campaign/ad-set slides (see
 * fill-tags.ts's buildCampaignOrAdSetSlideXml, which strips the campaign
 * template's fixed 7-field card region via ooxml.ts's removeShapeContaining
 * and inserts this grid in its place, only when the wizard's Metric
 * Preview step supplied a selectedMetrics list).
 *
 * Simplified flat card style (product decision, not a from-scratch replica
 * of the template's roundRect-with-icon-badge cards — see
 * ooxml.ts's removeShapeContaining doc comment for the reasoning): solid
 * background, thin stroke, uppercase label, bold value. No gradient/icon/
 * shadow.
 */

import { flatCard, textBox } from "./shapes";
import { fitFontSizePt } from "./text-fit";

export interface CardMetric {
  label: string;
  value: string;
}

export interface CardRegionBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The campaign template's metric-card region (left "full card" column +
 * middle "pair" column together) — measured directly from
 * templates/dark.pptx's ppt/slides/slide2.xml: the 4 left-column cards
 * span x=38.12-267.03pt, y=102.55-486.26pt; the 3 middle-column pairs span
 * x=366.57-510.98pt. The AI-copy column (CAMPAIGN_SUMMARY/KEY_INSIGHTS/
 * DATE_RANGE) starts around x=512pt and is never touched by this grid.
 */
export const DEFAULT_CARD_REGION: CardRegionBox = { x: 38.12, y: 102.55, w: 472.86, h: 383.71 };

const CARD_GAP_PT = 12;
const CARD_FILL_HEX = "111f35";
const CARD_STROKE_HEX = "1e3a5f";
const CARD_STROKE_WIDTH_PT = 1;
const CARD_CORNER_RADIUS_PT = 6;
const CARD_PADDING_PT = 12;
const LABEL_HEIGHT_PT = 16;
const LABEL_CANDIDATE_SIZES_PT = [10, 9, 8];
const LABEL_COLOR_HEX = "94a3b8";
const VALUE_GAP_PT = 4;
const VALUE_HEIGHT_PT = 28;
const VALUE_CANDIDATE_SIZES_PT = [20, 18, 16, 14, 12];
const VALUE_COLOR_HEX = "ffffff";

/**
 * Always exactly 2 rows — `cols = Math.ceil(n / 2)` reproduces the product
 * spec's 4→2×2 / 6→3×2 / 8→4×2 rule and interpolates the same way for the
 * in-between 5/7-metric cases. Row-major fill, so card order left-to-right
 * then top-to-bottom matches `metrics`' own order — the wizard's chosen
 * card order (see report-upload-wizard.tsx's Metric Preview step).
 */
export function buildDynamicCardShapes(metrics: CardMetric[], region: CardRegionBox = DEFAULT_CARD_REGION): string[] {
  if (metrics.length === 0) return [];

  const cols = Math.ceil(metrics.length / 2);
  const rows = 2;
  const cardW = (region.w - CARD_GAP_PT * (cols - 1)) / cols;
  const cardH = (region.h - CARD_GAP_PT * (rows - 1)) / rows;

  const shapes: string[] = [];
  metrics.forEach((metric, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = region.x + col * (cardW + CARD_GAP_PT);
    const y = region.y + row * (cardH + CARD_GAP_PT);

    shapes.push(
      flatCard({
        x,
        y,
        w: cardW,
        h: cardH,
        fillHex: CARD_FILL_HEX,
        strokeHex: CARD_STROKE_HEX,
        strokeWidthPt: CARD_STROKE_WIDTH_PT,
        cornerRadiusPt: CARD_CORNER_RADIUS_PT,
      }),
    );
    const labelMaxWidthPt = cardW - CARD_PADDING_PT * 2;
    const labelText = metric.label.toUpperCase();
    const labelSizePt = fitFontSizePt(labelText, labelMaxWidthPt, LABEL_CANDIDATE_SIZES_PT);
    shapes.push(
      textBox({
        x: x + CARD_PADDING_PT,
        y: y + CARD_PADDING_PT,
        w: labelMaxWidthPt,
        h: LABEL_HEIGHT_PT,
        text: labelText,
        sizePt: labelSizePt,
        colorHex: LABEL_COLOR_HEX,
        align: "l",
      }),
    );
    const valueMaxWidthPt = cardW - CARD_PADDING_PT * 2;
    const valueSizePt = fitFontSizePt(metric.value, valueMaxWidthPt, VALUE_CANDIDATE_SIZES_PT);
    shapes.push(
      textBox({
        x: x + CARD_PADDING_PT,
        y: y + CARD_PADDING_PT + LABEL_HEIGHT_PT + VALUE_GAP_PT,
        w: valueMaxWidthPt,
        h: VALUE_HEIGHT_PT,
        text: metric.value,
        sizePt: valueSizePt,
        bold: true,
        colorHex: VALUE_COLOR_HEX,
        align: "l",
      }),
    );
  });

  return shapes;
}
