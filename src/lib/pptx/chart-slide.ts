/**
 * MTD performance chart slide — a from-scratch OOXML port of
 * addVisualScorecardSlide_ from meta_ads_report_v4.js (one donut circle per
 * campaign: outer colored ring + inner dark circle showing spend, with
 * results/CPR below, and a spend-proportion bar along the bottom).
 *
 * All coordinates are in points, matching the source's Slides API calls
 * 1:1 — the source's own comments confirm the page is 960x540pt, identical
 * to this template's slide size, so no coordinate rescaling is needed.
 */

import { fmtNumber } from "../nre/format";
import type { ChartSlideData } from "../nre/report-data";
import { buildBlankSlideXml, ellipse, rectangle, resetShapeIdCounter, textBox } from "./shapes";

const BG_COLOR = "0d1b2e"; // dark navy, per product owner spec
const LABEL_COLOR = "7ab0cc";
const WHITE = "FFFFFF";

// Keys that never actually occur in getResultLabels()'s output vocabulary
// (FORM LEADS/WEB LEADS/LPV/CONV) are kept for source fidelity even though
// they're unreachable — see objective.ts's getResultLabels for the real set.
const TYPE_COLOR: Record<string, string> = {
  LEADS: "f6ad55",
  "FORM LEADS": "f6ad55",
  "WEB LEADS": "fc8181",
  CLICKS: "63b3ed",
  REACH: "68d391",
  LPV: "b794f4",
  CONV: "76e4f7",
};
const DEFAULT_COLOR = "a0aec0";

function cprShortForChart(label: string): string {
  return label.replace("COST PER 1K ", "CP 1K ");
}

export function buildChartSlideXml(chart: ChartSlideData, currencySymbol: string): string {
  resetShapeIdCounter();

  const W = 960;
  const H = 540;
  const shapes: string[] = [];

  shapes.push(rectangle({ x: 0, y: 0, w: W, h: H, fillHex: BG_COLOR }));
  shapes.push(
    textBox({
      x: 0,
      y: 8,
      w: W,
      h: 34,
      text: (chart.periodLabel === "MTD" ? "MTD" : "WEEKLY") + " CAMPAIGN PERFORMANCE",
      sizePt: 28,
      bold: true,
      colorHex: WHITE,
    }),
  );

  const activeCount = chart.campaigns.filter((d) => d.spend > 0).length;
  shapes.push(
    textBox({
      x: 0,
      y: 44,
      w: W,
      h: 24,
      text:
        `Total ${chart.periodLabel} Spend:  ` +
        currencySymbol +
        Math.round(chart.totalAllSpend).toLocaleString("en-US") +
        `     ·     ${activeCount} Active Campaign${activeCount === 1 ? "" : "s"}`,
      sizePt: 18,
      bold: false,
      colorHex: WHITE,
    }),
  );

  const n = chart.campaigns.length;
  if (n === 0) return buildBlankSlideXml(shapes);

  const MARGIN = 20;
  const COL_W = Math.floor((W - MARGIN * (n + 1)) / n);
  const CIRCLE_D = Math.min(COL_W - 20, 200);
  const INNER_D = Math.round(CIRCLE_D * 0.7);
  const CIRC_Y = 158;

  chart.campaigns.forEach((d, ci) => {
    const col = TYPE_COLOR[d.resLabel] || DEFAULT_COLOR;
    const colX = MARGIN + ci * (COL_W + MARGIN);
    const cx = colX + Math.floor(COL_W / 2);
    const circX = cx - Math.floor(CIRCLE_D / 2);

    const displayName = d.name.length > 40 ? d.name.slice(0, 40) + "…" : d.name;
    shapes.push(
      textBox({ x: colX, y: CIRC_Y - 36, w: COL_W, h: 28, text: displayName, sizePt: 14, colorHex: WHITE }),
    );

    const circTopY = CIRC_Y + 18;
    shapes.push(ellipse({ x: circX, y: circTopY, d: CIRCLE_D, fillHex: col }));

    const innerOffset = Math.floor((CIRCLE_D - INNER_D) / 2);
    shapes.push(ellipse({ x: circX + innerOffset, y: circTopY + innerOffset, d: INNER_D, fillHex: BG_COLOR }));

    const centerY = circTopY + Math.floor(CIRCLE_D / 2);
    const textBoxW = INNER_D - 10;
    const textBoxX = cx - Math.floor(textBoxW / 2);

    shapes.push(
      textBox({
        x: textBoxX,
        y: centerY - 22,
        w: textBoxW,
        h: 24,
        text: currencySymbol + Math.round(d.spend).toLocaleString("en-US"),
        sizePt: n <= 2 ? 20 : 16,
        bold: true,
        colorHex: WHITE,
      }),
    );
    shapes.push(
      textBox({ x: textBoxX, y: centerY + 4, w: textBoxW, h: 12, text: "AD SPEND", sizePt: 11, colorHex: LABEL_COLOR }),
    );

    const belowY = circTopY + CIRCLE_D + 10;
    shapes.push(rectangle({ x: cx - 30, y: belowY, w: 60, h: 1, fillHex: col }));

    shapes.push(
      textBox({
        x: colX,
        y: belowY + 6,
        w: COL_W,
        h: 28,
        text: fmtNumber(d.results),
        sizePt: n <= 2 ? 28 : 24,
        bold: true,
        colorHex: WHITE,
      }),
    );
    shapes.push(
      textBox({ x: colX, y: belowY + 36, w: COL_W, h: 12, text: d.resLabel, sizePt: 11, colorHex: LABEL_COLOR }),
    );

    const cprTxt = d.cpr > 0 ? currencySymbol + d.cpr.toFixed(2) : "—";
    shapes.push(
      textBox({
        x: colX,
        y: belowY + 52,
        w: COL_W,
        h: 24,
        text: cprTxt,
        sizePt: n <= 2 ? 20 : 17,
        bold: true,
        colorHex: WHITE,
      }),
    );
    shapes.push(
      textBox({
        x: colX,
        y: belowY + 76,
        w: COL_W,
        h: 12,
        text: cprShortForChart(d.cprLabel),
        sizePt: 11,
        colorHex: LABEL_COLOR,
      }),
    );
  });

  // Spend proportion bar along the very bottom.
  const barY = H - 12;
  let barOffset = 0;
  chart.campaigns.forEach((d) => {
    const pct = chart.totalAllSpend > 0 ? d.spend / chart.totalAllSpend : 1 / n;
    const segW = Math.max(Math.round(W * pct), 2);
    const col = TYPE_COLOR[d.resLabel] || DEFAULT_COLOR;
    shapes.push(rectangle({ x: barOffset, y: barY, w: segW, h: 8, fillHex: col }));
    barOffset += segW;
  });

  return buildBlankSlideXml(shapes);
}
