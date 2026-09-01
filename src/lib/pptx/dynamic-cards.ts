/**
 * Dynamic metric-card grid — builds the metric-card shapes for the dynamic
 * metric dictionary system's campaign/ad-set slides (see fill-tags.ts's
 * buildCampaignOrAdSetSlideXml, which strips the campaign template's fixed
 * 7-field card region via ooxml.ts's removeShapeContaining/
 * removeShapesInRegion and inserts this grid in its place, only when the
 * wizard's Metric Preview step supplied a selectedMetrics list).
 *
 * Fix 1 (product request): every visual constant below — the card's
 * roundRect corner radius/fill/shadow, the icon badge's gradient/shadow, the
 * icon picture's own drop shadow, and the label/value font families/colors
 * — is copied VERBATIM from templates/dark.pptx's own campaign-slide "full
 * card" shape group (ppt/slides/slide2.xml, the AD SPEND/REACH/IMPRESSIONS/
 * RESULTS cards, e.g. shape id=33: a `<p:grpSp>` of background + icon badge
 * + label textbox + value textbox — extracted by unzipping the template and
 * inspecting that group's raw XML). The only things that differ per card are
 * the label/value text and each shape's computed position/size.
 *
 * Positions are computed directly in absolute EMU (not via OOXML's group
 * child-coordinate auto-scale trick), confirmed by an empirical LibreOffice
 * render test to be the right call here: a group scaled non-uniformly (only
 * width shrunk, height held — exactly this grid's own resize case once
 * column count grows) visibly stretches a circular icon badge into an oval,
 * and does NOT shrink the rendered font size at all (text just wraps
 * instead) — so relying on it here would both distort the icon and let long
 * labels overflow. Recomputing each shape's own absolute position/size
 * (matching how every other shape in this codebase — shapes.ts's rectangle/
 * textBox/flatCard — already works) avoids both failure modes: the icon
 * badge is always given an equal width/height (so it's always a true
 * circle, never stretched), and label/value font sizes are explicitly
 * chosen per card via text-fit.ts's fitFontSizePt (with an 8pt floor for the
 * label, per the product spec) rather than left to any implicit transform.
 */

import { nextShapeId } from "./shapes";
import { ptToEmu, escapeXmlText } from "./ooxml";
import { fitFontSizePt, estimateTextWidthPt } from "./text-fit";
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
 * templates/dark.pptx's ppt/slides/slide2.xml: the 4 left-column cards span
 * x=38.12-267.03pt, y=102.55-486.26pt; the 3 middle-column pairs span
 * x=366.57-510.98pt. The AI-copy column (CAMPAIGN_SUMMARY/KEY_INSIGHTS/
 * DATE_RANGE) starts around x=512pt and is never touched by this grid.
 */
export const DEFAULT_CARD_REGION: CardRegionBox = { x: 38.12, y: 102.55, w: 472.86, h: 383.71 };

const CARD_GAP_PT = 12;
const CARD_INNER_PADDING_PT = 10;

// The template's own roundRect corner-radius "adj" value (OOXML's adj is a
// percentage, in 1/100000ths, of the shape's own shorter dimension — so
// reusing this literal value keeps every card's corner proportionally
// identical to the template's, whatever the card's own computed size is).
const CARD_CORNER_ADJ = 12280;

// Verbatim from the template card's background <p:sp> (id=34 in slide2.xml).
const CARD_BG_FILL = `<a:solidFill><a:schemeClr val="accent5"/></a:solidFill>`;
const CARD_BG_SHADOW =
  `<a:effectLst><a:outerShdw blurRad="190500" sx="99000" rotWithShape="0" algn="t" dir="5400000" dist="63500" sy="99000">` +
  `<a:srgbClr val="000000"><a:alpha val="20000"/></a:srgbClr></a:outerShdw></a:effectLst>`;

// Verbatim from the template icon badge's circle <p:sp> (id=36) — same
// gradient stops/shadow, using prstGeom "ellipse" instead of the template's
// hand-drawn custGeom bezier circle (both render as an identical circle
// when width=height, which the badge always is here; ellipse is simpler to
// parameterize by size).
const ICON_BADGE_GRADIENT =
  `<a:gradFill><a:gsLst><a:gs pos="0"><a:schemeClr val="accent2"/></a:gs><a:gs pos="5000"><a:schemeClr val="accent2"/></a:gs>` +
  `<a:gs pos="34000"><a:schemeClr val="accent1"/></a:gs><a:gs pos="64000"><a:schemeClr val="accent3"/></a:gs>` +
  `<a:gs pos="90000"><a:schemeClr val="accent4"/></a:gs><a:gs pos="100000"><a:schemeClr val="accent4"/></a:gs></a:gsLst>` +
  `<a:lin ang="2700006" scaled="0"/></a:gradFill>`;
const ICON_BADGE_SHADOW = CARD_BG_SHADOW;

// Verbatim from the template icon <p:pic>'s own drop shadow (id=37) — a
// different, tighter shadow than the badge/card's.
const ICON_PIC_SHADOW =
  `<a:effectLst><a:outerShdw blurRad="177800" rotWithShape="0" algn="tl" dir="2700000" dist="114300">` +
  `<a:srgbClr val="000000"><a:alpha val="40000"/></a:srgbClr></a:outerShdw></a:effectLst>`;

// The template's own icon-to-badge size ratio (540001 / 581069 EMU, id=37's
// pic ext vs id=35's badge ext) — the icon picture sits slightly inset
// within its circular badge, not edge-to-edge.
const ICON_TO_BADGE_RATIO = 540001 / 581069;

const LABEL_CANDIDATE_SIZES_PT = [12.5, 11, 10, 9];
const VALUE_CANDIDATE_SIZES_PT = [23, 20, 18, 16, 14, 12];

function cardBackgroundXml(x: number, y: number, w: number, h: number): string {
  return (
    `<p:sp><p:nvSpPr><p:cNvPr id="${nextShapeId()}" name="Metric Card"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>` +
    `<p:spPr><a:xfrm><a:off x="${ptToEmu(x)}" y="${ptToEmu(y)}"/><a:ext cx="${ptToEmu(w)}" cy="${ptToEmu(h)}"/></a:xfrm>` +
    `<a:prstGeom prst="roundRect"><a:avLst><a:gd fmla="val ${CARD_CORNER_ADJ}" name="adj"/></a:avLst></a:prstGeom>` +
    `${CARD_BG_FILL}<a:ln><a:noFill/></a:ln>${CARD_BG_SHADOW}</p:spPr>` +
    `<p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody></p:sp>`
  );
}

/** Icon badge — the circular gradient shape, plus a separate `<p:pic>` entry for the real template icon on top of it (centered at the same point) when a relationship id resolved for this metric's icon. Returns 1 shape (badge only) or 2 (badge + pic) — kept as separate array entries, one shape per string, matching the rest of this module. */
function iconBadgeXml(centerXPt: number, centerYPt: number, diameterPt: number, relId?: string): string[] {
  const r = diameterPt / 2;
  const badgeX = ptToEmu(centerXPt - r);
  const badgeY = ptToEmu(centerYPt - r);
  const badgeSize = ptToEmu(diameterPt);

  const badge =
    `<p:sp><p:nvSpPr><p:cNvPr id="${nextShapeId()}" name="Metric Icon Badge"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>` +
    `<p:spPr><a:xfrm><a:off x="${badgeX}" y="${badgeY}"/><a:ext cx="${badgeSize}" cy="${badgeSize}"/></a:xfrm>` +
    `<a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom>${ICON_BADGE_GRADIENT}<a:ln><a:noFill/></a:ln>${ICON_BADGE_SHADOW}</p:spPr>` +
    `<p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody></p:sp>`;

  if (!relId) return [badge];

  const picDiameterPt = diameterPt * ICON_TO_BADGE_RATIO;
  const picR = picDiameterPt / 2;
  const picX = ptToEmu(centerXPt - picR);
  const picY = ptToEmu(centerYPt - picR);
  const picSize = ptToEmu(picDiameterPt);
  const pic =
    `<p:pic><p:nvPicPr><p:cNvPr id="${nextShapeId()}" name="Metric Icon"/><p:cNvPicPr preferRelativeResize="0"/><p:nvPr/></p:nvPicPr>` +
    `<p:blipFill rotWithShape="1"><a:blip r:embed="${relId}"><a:alphaModFix/></a:blip><a:srcRect b="0" l="0" r="0" t="0"/><a:stretch/></p:blipFill>` +
    `<p:spPr><a:xfrm><a:off x="${picX}" y="${picY}"/><a:ext cx="${picSize}" cy="${picSize}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln>${ICON_PIC_SHADOW}</p:spPr></p:pic>`;

  return [badge, pic];
}

function labelTextXml(x: number, y: number, w: number, h: number, text: string, sizePt: number): string {
  return (
    `<p:sp><p:nvSpPr><p:cNvPr id="${nextShapeId()}" name="Metric Label"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>` +
    `<p:spPr><a:xfrm><a:off x="${ptToEmu(x)}" y="${ptToEmu(y)}"/><a:ext cx="${ptToEmu(w)}" cy="${ptToEmu(h)}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr>` +
    `<p:txBody><a:bodyPr anchorCtr="0" anchor="t" bIns="0" lIns="0" rIns="0" tIns="0" wrap="square"><a:noAutofit/></a:bodyPr><a:lstStyle/>` +
    `<a:p><a:pPr algn="ctr"/><a:r><a:rPr b="0" i="0" sz="${Math.round(sizePt * 100)}" u="none" cap="none" strike="noStrike">` +
    `<a:solidFill><a:schemeClr val="lt1"/></a:solidFill><a:latin typeface="Poppins Medium"/><a:ea typeface="Poppins Medium"/>` +
    `<a:cs typeface="Poppins Medium"/><a:sym typeface="Poppins Medium"/></a:rPr><a:t>${escapeXmlText(text)}</a:t></a:r></a:p></p:txBody></p:sp>`
  );
}

function valueTextXml(x: number, y: number, w: number, h: number, text: string, sizePt: number): string {
  return (
    `<p:sp><p:nvSpPr><p:cNvPr id="${nextShapeId()}" name="Metric Value"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>` +
    `<p:spPr><a:xfrm><a:off x="${ptToEmu(x)}" y="${ptToEmu(y)}"/><a:ext cx="${ptToEmu(w)}" cy="${ptToEmu(h)}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr>` +
    `<p:txBody><a:bodyPr anchorCtr="0" anchor="t" bIns="0" lIns="0" rIns="0" tIns="0" wrap="square"><a:noAutofit/></a:bodyPr><a:lstStyle/>` +
    `<a:p><a:pPr algn="ctr"/><a:r><a:rPr b="1" i="0" sz="${Math.round(sizePt * 100)}" u="none" cap="none" strike="noStrike">` +
    `<a:solidFill><a:schemeClr val="lt1"/></a:solidFill><a:latin typeface="Poppins"/><a:ea typeface="Poppins"/>` +
    `<a:cs typeface="Poppins"/><a:sym typeface="Poppins"/></a:rPr><a:t>${escapeXmlText(text)}</a:t></a:r></a:p></p:txBody></p:sp>`
  );
}

/**
 * Always exactly 2 rows — `cols = Math.ceil(n / 2)` reproduces the product
 * spec's 4→2×2 / 6→3×2 / 8→4×2 / 12→6×2 rule and interpolates the same way
 * for the in-between 5/7/9/11-metric cases (Fix 3 — never more than
 * MAX_CARDS_PER_SLIDE metrics reach this function; see dynamic-metrics.ts's
 * buildDynamicMetricCards for the top-12-by-priority cap and "never a
 * continued slide" guarantee). Row-major fill, so card order left-to-right
 * then top-to-bottom matches `metrics`' own order (priority-descending —
 * see metric-selector.ts).
 *
 * `iconRelIds` maps each of metric-icons.ts's 7 extracted icon ids to the
 * relationship id render.ts registered it under in this slide's own
 * `template.campaign.rels` — see render.ts's icon-embedding step, which
 * runs once per render (not once per card), reusing one relationship per
 * distinct icon across every card on every campaign/ad-set slide. Icons are
 * skipped (card still renders, just without one) if this is omitted —
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

    shapes.push(cardBackgroundXml(x, y, cardW, cardH));

    const textX = x + CARD_INNER_PADDING_PT;
    const textW = cardW - CARD_INNER_PADDING_PT * 2;
    const labelText = metric.label.toUpperCase();
    const labelSizePt = fitFontSizePt(labelText, textW, LABEL_CANDIDATE_SIZES_PT);
    const valueSizePt = fitFontSizePt(metric.value, textW, VALUE_CANDIDATE_SIZES_PT);

    // fitFontSizePt picks the largest candidate that WOULD fit on one line,
    // but at the narrow end of the grid (6 columns — cards ~69pt wide) even
    // its smallest (floor) candidate often still doesn't, since the floor
    // exists to satisfy the product's "never below 8pt" requirement, not to
    // guarantee a single line. Left at a fixed one-line box height, that
    // wrapped 2nd/3rd line would visually overlap the value text below it
    // (a real bug, caught by rendering the actual 12-metric/6-column case
    // through LibreOffice) — so each box's own height is sized to the
    // number of lines its own text is actually expected to wrap to, and the
    // value box is positioned AFTER the label's real (possibly multi-line)
    // height, not a guessed fixed one.
    const labelLines = Math.min(3, Math.max(1, Math.ceil(estimateTextWidthPt(labelText, labelSizePt) / textW)));
    const valueLines = Math.min(2, Math.max(1, Math.ceil(estimateTextWidthPt(metric.value, valueSizePt) / textW)));
    const labelLineH = labelSizePt * 1.3;
    const valueLineH = valueSizePt * 1.3;
    const labelH = labelLines * labelLineH;
    const valueH = valueLines * valueLineH;

    // Icon badge, label, and value are stacked and vertically centered as
    // one block within the card (matches the template's own full-card
    // layout — icon above label above value — which scales down to narrow
    // columns far more gracefully than the template's side-by-side "full
    // card" arrangement would).
    const badgeDiameterPt = Math.max(14, Math.min(cardH * 0.34, cardW * 0.4, 36));
    const gapIconLabel = 6;
    const gapLabelValue = 2;
    const stackH = badgeDiameterPt + gapIconLabel + labelH + gapLabelValue + valueH;
    const stackTop = y + Math.max(0, (cardH - stackH) / 2);

    const badgeCenterX = x + cardW / 2;
    const badgeCenterY = stackTop + badgeDiameterPt / 2;
    const iconId = resolveMetricIconId(metric);
    const relId = iconRelIds?.[iconId];
    for (const shape of iconBadgeXml(badgeCenterX, badgeCenterY, badgeDiameterPt, relId)) shapes.push(shape);

    const labelY = stackTop + badgeDiameterPt + gapIconLabel;
    shapes.push(labelTextXml(textX, labelY, textW, labelH, labelText, labelSizePt));

    const valueY = labelY + labelH + gapLabelValue;
    shapes.push(valueTextXml(textX, valueY, textW, valueH, metric.value, valueSizePt));
  });

  return shapes;
}
