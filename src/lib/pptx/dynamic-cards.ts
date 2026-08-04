/**
 * Dynamic metric-card grid — builds the flat-card shapes for the dynamic
 * metric dictionary system's campaign/ad-set slides (see
 * fill-tags.ts's buildCampaignOrAdSetSlideXml, which strips the campaign
 * template's fixed 7-field card region via ooxml.ts's removeShapeContaining
 * and inserts this grid in its place, only when the wizard's Metric
 * Preview step supplied a selectedMetrics list).
 *
 * Card anatomy (product fix — the first version left 80% of each card
 * empty, text confined to the top-left corner): a thin colored accent bar
 * across the top (amber for a primary metric, blue for a secondary one —
 * the same primary/secondary distinction the dictionary already tracks),
 * then the metric's real template icon (see metric-icons.ts), label, and
 * value stacked and vertically centered in the remaining card height, so a
 * tall 2-row card doesn't read as mostly blank.
 */

import { flatCard, nextShapeId, rectangle, textBox } from "./shapes";
import { buildPictureShapeXml } from "./embed-image";
import { ptToEmu } from "./ooxml";
import { fitFontSizePt } from "./text-fit";
import { resolveMetricIconId, type MetricIconId } from "./metric-icons";

export interface CardMetric {
  key: string;
  label: string;
  value: string;
  type: "primary" | "secondary";
  format: "currency" | "number" | "percentage" | "duration" | "ratio" | "text";
  perUnitOf?: string;
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
const CARD_PADDING_PT = 8;

const ACCENT_BAR_H_PT = 6;
const ACCENT_COLOR_PRIMARY_HEX = "f6ad55";
const ACCENT_COLOR_SECONDARY_HEX = "4a90d9";

const ICON_SIZE_PT = 22;
const ICON_LABEL_GAP_PT = 6;
const LABEL_H_PT = 14;
const LABEL_CANDIDATE_SIZES_PT = [11, 10, 9, 8];
const LABEL_COLOR_HEX = "94a3b8";
const LABEL_VALUE_GAP_PT = 4;
const VALUE_H_PT = 32;
const VALUE_CANDIDATE_SIZES_PT = [24, 20, 18, 16, 14, 12];
const VALUE_COLOR_HEX = "ffffff";

/**
 * Always exactly 2 rows — `cols = Math.ceil(n / 2)` reproduces the product
 * spec's 4→2×2 / 6→3×2 / 8→4×2 rule and interpolates the same way for the
 * in-between 5/7-metric cases. Row-major fill, so card order left-to-right
 * then top-to-bottom matches `metrics`' own order (priority-descending —
 * see metric-selector.ts).
 *
 * `iconRelIds` maps each of metric-icons.ts's 7 extracted icon ids to the
 * relationship id render.ts registered it under in this slide's own
 * `template.campaign.rels` — see render.ts's icon-embedding step, which
 * runs once per render (not once per card), reusing one relationship per
 * distinct icon across every card on every campaign/ad-set slide. Icons
 * are skipped (card still renders, just without one) if this is omitted —
 * defensive only; every real render call always supplies it whenever any
 * slide has dynamicMetrics.
 */
export function buildDynamicCardShapes(
  metrics: CardMetric[],
  iconRelIds?: Partial<Record<MetricIconId, string>>,
  region: CardRegionBox = DEFAULT_CARD_REGION,
): string[] {
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

    shapes.push(
      rectangle({
        x,
        y,
        w: cardW,
        h: ACCENT_BAR_H_PT,
        fillHex: metric.type === "primary" ? ACCENT_COLOR_PRIMARY_HEX : ACCENT_COLOR_SECONDARY_HEX,
      }),
    );

    // Icon + label + value are stacked and vertically centered as one group
    // within the card's interior (below the accent bar) — the fix for the
    // original layout, which left the bottom ~80% of every card empty.
    const stackH = ICON_SIZE_PT + ICON_LABEL_GAP_PT + LABEL_H_PT + LABEL_VALUE_GAP_PT + VALUE_H_PT;
    const interiorY = y + ACCENT_BAR_H_PT;
    const interiorH = cardH - ACCENT_BAR_H_PT;
    const stackY = interiorY + Math.max(0, (interiorH - stackH) / 2);

    const iconId = resolveMetricIconId(metric);
    const relId = iconRelIds?.[iconId];
    if (relId) {
      const iconX = x + (cardW - ICON_SIZE_PT) / 2;
      shapes.push(
        buildPictureShapeXml({
          id: nextShapeId(),
          name: `MetricIcon ${iconId}`,
          relId,
          x: ptToEmu(iconX),
          y: ptToEmu(stackY),
          cx: ptToEmu(ICON_SIZE_PT),
          cy: ptToEmu(ICON_SIZE_PT),
        }),
      );
    }

    const textMaxWidthPt = cardW - CARD_PADDING_PT * 2;
    const labelText = metric.label.toUpperCase();
    const labelSizePt = fitFontSizePt(labelText, textMaxWidthPt, LABEL_CANDIDATE_SIZES_PT);
    const labelY = stackY + ICON_SIZE_PT + ICON_LABEL_GAP_PT;
    shapes.push(
      textBox({
        x: x + CARD_PADDING_PT,
        y: labelY,
        w: textMaxWidthPt,
        h: LABEL_H_PT,
        text: labelText,
        sizePt: labelSizePt,
        colorHex: LABEL_COLOR_HEX,
        align: "ctr",
      }),
    );

    const valueSizePt = fitFontSizePt(metric.value, textMaxWidthPt, VALUE_CANDIDATE_SIZES_PT);
    const valueY = labelY + LABEL_H_PT + LABEL_VALUE_GAP_PT;
    shapes.push(
      textBox({
        x: x + CARD_PADDING_PT,
        y: valueY,
        w: textMaxWidthPt,
        h: VALUE_H_PT,
        text: metric.value,
        sizePt: valueSizePt,
        bold: true,
        colorHex: VALUE_COLOR_HEX,
        align: "ctr",
      }),
    );
  });

  return shapes;
}
