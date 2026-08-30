/**
 * Creative performance slide builders — overview table, top creative,
 * video hook/hold, and fatigue alert slides. Built from scratch in OOXML
 * (same approach as comparison-slides.ts).
 */

import { backgroundImage, buildBlankSlideXml, resetShapeIdCounter, roundedCard, textBox } from "./shapes";
import type { TemplateBackgroundImage } from "./package";
import type {
  CreativeFatigueSlideData,
  CreativeOverviewSlideData,
  CreativeTopSlideData,
  CreativeVideoSlideData,
} from "../nre/creative-report-data";

export const CREATIVE_BG_REL_ID = "rId2";

const W = 960;
const TEXT = "FFFFFF";
const MUTED = "94a3b8";
const ACCENT = "f6ad55";
const CARD = "111f35";
const STROKE = "1e3a5f";
const WIN = "68d391";
const AVG = "f6ad55";
const FAT = "fc8181";
const LOW = "64748b";

function statusColor(label: string): string {
  if (label === "Winner") return WIN;
  if (label === "Fatigue") return FAT;
  if (label === "Low Spend") return LOW;
  return AVG;
}

function beginSlide(bg?: TemplateBackgroundImage): string[] {
  resetShapeIdCounter();
  const shapes: string[] = [];
  if (bg) shapes.push(backgroundImage({ relId: CREATIVE_BG_REL_ID, ...bg }));
  return shapes;
}

function finishSlide(shapes: string[]): string {
  return buildBlankSlideXml(shapes);
}

export function buildCreativeOverviewSlideXml(
  slide: CreativeOverviewSlideData,
  bg?: TemplateBackgroundImage,
): string {
  const shapes = beginSlide(bg);
  shapes.push(
    textBox({ x: 40, y: 36, w: 880, h: 36, text: "CREATIVE OVERVIEW", sizePt: 22, bold: true, colorHex: ACCENT, align: "l" }),
  );
  shapes.push(
    textBox({ x: 40, y: 72, w: 880, h: 24, text: slide.campaignName, sizePt: 14, colorHex: TEXT, align: "l" }),
  );
  shapes.push(
    textBox({ x: 40, y: 98, w: 880, h: 18, text: slide.dateRangeLine, sizePt: 10, colorHex: MUTED, align: "l" }),
  );

  const cols = [
    { x: 40, w: 220, label: "Ad Name" },
    { x: 270, w: 80, label: "Spend" },
    { x: 360, w: 70, label: "Results" },
    { x: 440, w: 90, label: "Cost/Result" },
    { x: 540, w: 60, label: "CTR" },
    { x: 610, w: 70, label: "Freq" },
    { x: 690, w: 90, label: "Status" },
  ];
  cols.forEach((c) => {
    shapes.push(textBox({ x: c.x, y: 112, w: c.w, h: 16, text: c.label, sizePt: 9, bold: true, colorHex: MUTED, align: "l" }));
  });

  slide.ads.slice(0, 8).forEach((ad, i) => {
    const y = 130 + i * 28;
    shapes.push(roundedCard({ x: 36, y: y - 2, w: 888, h: 24, fillHex: CARD, strokeHex: STROKE, radiusPt: 4 }));
    shapes.push(textBox({ x: cols[0].x, y, w: cols[0].w, h: 20, text: ad.adName.slice(0, 42), sizePt: 10, colorHex: TEXT, align: "l" }));
    shapes.push(textBox({ x: cols[1].x, y, w: cols[1].w, h: 20, text: ad.spendFormatted, sizePt: 10, colorHex: TEXT, align: "l" }));
    shapes.push(textBox({ x: cols[2].x, y, w: cols[2].w, h: 20, text: ad.resultsFormatted, sizePt: 10, colorHex: TEXT, align: "l" }));
    shapes.push(textBox({ x: cols[3].x, y, w: cols[3].w, h: 20, text: ad.cpr, sizePt: 10, colorHex: TEXT, align: "l" }));
    shapes.push(textBox({ x: cols[4].x, y, w: cols[4].w, h: 20, text: ad.ctr, sizePt: 10, colorHex: TEXT, align: "l" }));
    shapes.push(textBox({ x: cols[5].x, y, w: cols[5].w, h: 20, text: ad.frequency, sizePt: 10, colorHex: TEXT, align: "l" }));
    shapes.push(textBox({ x: cols[6].x, y, w: cols[6].w, h: 20, text: ad.statusLabel, sizePt: 10, bold: true, colorHex: statusColor(ad.statusLabel), align: "l" }));
  });

  return finishSlide(shapes);
}

export function buildCreativeTopSlideXml(slide: CreativeTopSlideData, bg?: TemplateBackgroundImage): string {
  const shapes = beginSlide(bg);
  shapes.push(
    textBox({ x: 40, y: 36, w: 880, h: 36, text: "TOP PERFORMING CREATIVE", sizePt: 22, bold: true, colorHex: ACCENT, align: "l" }),
  );
  shapes.push(textBox({ x: 40, y: 80, w: 880, h: 28, text: slide.adName, sizePt: 16, bold: true, colorHex: TEXT, align: "l" }));
  shapes.push(textBox({ x: 40, y: 108, w: 400, h: 18, text: slide.campaignName, sizePt: 11, colorHex: MUTED, align: "l" }));
  shapes.push(textBox({ x: 40, y: 128, w: 400, h: 18, text: slide.dateRangeLine, sizePt: 10, colorHex: MUTED, align: "l" }));
  shapes.push(textBox({ x: 520, y: 108, w: 200, h: 24, text: slide.statusLabel, sizePt: 14, bold: true, colorHex: statusColor(slide.statusLabel), align: "l" }));

  const cards = [
    { label: "SPEND", value: slide.spend },
    { label: "RESULTS", value: slide.results },
    { label: "COST/RESULT", value: slide.cpr },
    { label: "CTR", value: slide.ctr },
    { label: "FREQUENCY", value: slide.frequency },
    { label: "CPM", value: slide.cpm },
  ];
  cards.forEach((c, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 40 + col * 156;
    const y = 170 + row * 88;
    shapes.push(roundedCard({ x, y, w: 140, h: 72, fillHex: CARD, strokeHex: STROKE, radiusPt: 6 }));
    shapes.push(textBox({ x: x + 10, y: y + 10, w: 120, h: 16, text: c.label, sizePt: 9, colorHex: MUTED, align: "l" }));
    shapes.push(textBox({ x: x + 10, y: y + 32, w: 120, h: 28, text: c.value, sizePt: 16, bold: true, colorHex: TEXT, align: "l" }));
  });

  return finishSlide(shapes);
}

export function buildCreativeVideoSlideXml(slide: CreativeVideoSlideData, bg?: TemplateBackgroundImage): string {
  const shapes = beginSlide(bg);
  shapes.push(
    textBox({ x: 40, y: 36, w: 880, h: 36, text: "VIDEO CREATIVE PERFORMANCE", sizePt: 22, bold: true, colorHex: ACCENT, align: "l" }),
  );
  shapes.push(textBox({ x: 40, y: 72, w: 880, h: 18, text: slide.dateRangeLine, sizePt: 10, colorHex: MUTED, align: "l" }));
  shapes.push(
    textBox({
      x: 40,
      y: 100,
      w: 880,
      h: 16,
      text: "Hook Rate = 3-second views ÷ Impressions  |  Hold Rate = ThruPlays ÷ 3-second views",
      sizePt: 9,
      colorHex: MUTED,
      align: "l",
    }),
  );

  slide.ads.slice(0, 6).forEach((ad, i) => {
    const y = 130 + i * 58;
    shapes.push(roundedCard({ x: 36, y, w: 888, h: 52, fillHex: CARD, strokeHex: STROKE, radiusPt: 6 }));
    shapes.push(textBox({ x: 48, y: y + 8, w: 320, h: 18, text: ad.adName.slice(0, 40), sizePt: 11, bold: true, colorHex: TEXT, align: "l" }));
    shapes.push(textBox({ x: 48, y: y + 28, w: 320, h: 16, text: ad.campaignName, sizePt: 9, colorHex: MUTED, align: "l" }));
    shapes.push(textBox({ x: 400, y: y + 16, w: 120, h: 20, text: `Hook ${ad.hookRate}`, sizePt: 12, colorHex: WIN, align: "l" }));
    shapes.push(textBox({ x: 540, y: y + 16, w: 120, h: 20, text: `Hold ${ad.holdRate}`, sizePt: 12, colorHex: ACCENT, align: "l" }));
    shapes.push(textBox({ x: 680, y: y + 16, w: 100, h: 20, text: ad.spend, sizePt: 11, colorHex: TEXT, align: "l" }));
  });

  return finishSlide(shapes);
}

export function buildCreativeFatigueSlideXml(slide: CreativeFatigueSlideData, bg?: TemplateBackgroundImage): string {
  const shapes = beginSlide(bg);
  shapes.push(
    textBox({ x: 40, y: 36, w: 880, h: 36, text: "CREATIVE FATIGUE ALERT", sizePt: 22, bold: true, colorHex: FAT, align: "l" }),
  );
  shapes.push(
    textBox({ x: 40, y: 72, w: 880, h: 20, text: "These ads may be experiencing audience fatigue", sizePt: 12, colorHex: MUTED, align: "l" }),
  );
  shapes.push(textBox({ x: 40, y: 94, w: 880, h: 18, text: slide.dateRangeLine, sizePt: 10, colorHex: MUTED, align: "l" }));

  slide.ads.slice(0, 5).forEach((ad, i) => {
    const y = 130 + i * 72;
    shapes.push(roundedCard({ x: 36, y, w: 888, h: 64, fillHex: CARD, strokeHex: STROKE, radiusPt: 6 }));
    shapes.push(textBox({ x: 48, y: y + 8, w: 400, h: 18, text: ad.adName, sizePt: 12, bold: true, colorHex: TEXT, align: "l" }));
    shapes.push(textBox({ x: 48, y: y + 28, w: 400, h: 16, text: ad.campaignName, sizePt: 10, colorHex: MUTED, align: "l" }));
    shapes.push(textBox({ x: 460, y: y + 12, w: 100, h: 18, text: `Freq ${ad.frequency}`, sizePt: 11, colorHex: FAT, align: "l" }));
    shapes.push(textBox({ x: 560, y: y + 12, w: 80, h: 18, text: `CTR ${ad.ctr}`, sizePt: 11, colorHex: TEXT, align: "l" }));
    shapes.push(textBox({ x: 48, y: y + 44, w: 860, h: 16, text: ad.recommendation, sizePt: 9, colorHex: MUTED, align: "l" }));
  });

  return finishSlide(shapes);
}

export function buildCreativeSlideRels(backgroundMediaTarget: string): string {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout2.xml"/>' +
    `<Relationship Id="${CREATIVE_BG_REL_ID}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${backgroundMediaTarget}"/>` +
    "</Relationships>"
  );
}
