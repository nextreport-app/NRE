/**
 * Creative performance slide builders — overview table, top creative,
 * video hook/hold, and fatigue alert slides. Built from scratch in OOXML
 * (same approach as comparison-slides.ts).
 */

import { backgroundImage, buildBlankSlideXml, rectangle, resetShapeIdCounter, roundedCard, textBox } from "./shapes";
import type { TemplateBackgroundImage } from "./package";
import type {
  CreativeFatigueSlideData,
  CreativeOverviewSlideData,
  CreativeTopSlideData,
  CreativeVideoSlideData,
} from "../nre/creative-report-data";

export const CREATIVE_BG_REL_ID = "rId2";

const W = 960;
const H = 540;
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

function slideWithBg(bg: TemplateBackgroundImage | undefined, body: string): string {
  resetShapeIdCounter(1);
  const bgShape = bg ? backgroundImage(bg, CREATIVE_BG_REL_ID) : "";
  return buildBlankSlideXml(bgShape + body);
}

export function buildCreativeOverviewSlideXml(
  slide: CreativeOverviewSlideData,
  bg?: TemplateBackgroundImage,
): string {
  const rows = slide.ads.slice(0, 8);
  const rowH = 28;
  const startY = 130;
  const cols = [
    { x: 40, w: 220, label: "Ad Name" },
    { x: 270, w: 80, label: "Spend" },
    { x: 360, w: 70, label: "Results" },
    { x: 440, w: 90, label: "Cost/Result" },
    { x: 540, w: 60, label: "CTR" },
    { x: 610, w: 70, label: "Freq" },
    { x: 690, w: 90, label: "Status" },
  ];

  let body = textBox(40, 36, 880, 36, "CREATIVE OVERVIEW", { size: 22, bold: true, color: ACCENT });
  body += textBox(40, 72, 880, 24, slide.campaignName, { size: 14, color: TEXT });
  body += textBox(40, 98, 880, 18, slide.dateRangeLine, { size: 10, color: MUTED });

  cols.forEach((c) => {
    body += textBox(c.x, 112, c.w, 16, c.label, { size: 9, color: MUTED, bold: true });
  });

  rows.forEach((ad, i) => {
    const y = startY + i * rowH;
    body += roundedCard(36, y - 2, 888, rowH - 4, CARD, STROKE);
    body += textBox(cols[0].x, y, cols[0].w, 20, ad.adName.slice(0, 42), { size: 10, color: TEXT });
    body += textBox(cols[1].x, y, cols[1].w, 20, ad.spendFormatted, { size: 10, color: TEXT });
    body += textBox(cols[2].x, y, cols[2].w, 20, ad.resultsFormatted, { size: 10, color: TEXT });
    body += textBox(cols[3].x, y, cols[3].w, 20, ad.cpr, { size: 10, color: TEXT });
    body += textBox(cols[4].x, y, cols[4].w, 20, ad.ctr, { size: 10, color: TEXT });
    body += textBox(cols[5].x, y, cols[5].w, 20, ad.frequency, { size: 10, color: TEXT });
    body += textBox(cols[6].x, y, cols[6].w, 20, ad.statusLabel, { size: 10, color: statusColor(ad.statusLabel), bold: true });
  });

  return slideWithBg(bg, body);
}

export function buildCreativeTopSlideXml(slide: CreativeTopSlideData, bg?: TemplateBackgroundImage): string {
  let body = textBox(40, 36, 880, 36, "TOP PERFORMING CREATIVE", { size: 22, bold: true, color: ACCENT });
  body += textBox(40, 80, 880, 28, slide.adName, { size: 16, bold: true, color: TEXT });
  body += textBox(40, 108, 400, 18, slide.campaignName, { size: 11, color: MUTED });
  body += textBox(40, 128, 400, 18, slide.dateRangeLine, { size: 10, color: MUTED });
  body += textBox(520, 108, 200, 24, slide.statusLabel, { size: 14, bold: true, color: statusColor(slide.statusLabel) });

  const cards = [
    { label: "SPEND", value: slide.spend },
    { label: "RESULTS", value: slide.results },
    { label: "COST/RESULT", value: slide.cpr },
    { label: "CTR", value: slide.ctr },
    { label: "FREQUENCY", value: slide.frequency },
    { label: "CPM", value: slide.cpm },
  ];
  const cardW = 140;
  const cardH = 72;
  cards.forEach((c, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 40 + col * (cardW + 16);
    const y = 170 + row * (cardH + 16);
    body += roundedCard(x, y, cardW, cardH, CARD, STROKE);
    body += textBox(x + 10, y + 10, cardW - 20, 16, c.label, { size: 9, color: MUTED });
    body += textBox(x + 10, y + 32, cardW - 20, 28, c.value, { size: 16, bold: true, color: TEXT });
  });

  return slideWithBg(bg, body);
}

export function buildCreativeVideoSlideXml(slide: CreativeVideoSlideData, bg?: TemplateBackgroundImage): string {
  let body = textBox(40, 36, 880, 36, "VIDEO CREATIVE PERFORMANCE", { size: 22, bold: true, color: ACCENT });
  body += textBox(40, 72, 880, 18, slide.dateRangeLine, { size: 10, color: MUTED });
  body += textBox(40, 100, 880, 16, "Hook Rate = 3-second views ÷ Impressions  |  Hold Rate = ThruPlays ÷ 3-second views", {
    size: 9,
    color: MUTED,
  });

  const rows = slide.ads.slice(0, 6);
  rows.forEach((ad, i) => {
    const y = 130 + i * 58;
    body += roundedCard(36, y, 888, 52, CARD, STROKE);
    body += textBox(48, y + 8, 320, 18, ad.adName.slice(0, 40), { size: 11, bold: true, color: TEXT });
    body += textBox(48, y + 28, 320, 16, ad.campaignName, { size: 9, color: MUTED });
    body += textBox(400, y + 16, 120, 20, `Hook ${ad.hookRate}`, { size: 12, color: WIN });
    body += textBox(540, y + 16, 120, 20, `Hold ${ad.holdRate}`, { size: 12, color: ACCENT });
    body += textBox(680, y + 16, 100, 20, ad.spend, { size: 11, color: TEXT });
  });

  return slideWithBg(bg, body);
}

export function buildCreativeFatigueSlideXml(slide: CreativeFatigueSlideData, bg?: TemplateBackgroundImage): string {
  let body = textBox(40, 36, 880, 36, "CREATIVE FATIGUE ALERT", { size: 22, bold: true, color: FAT });
  body += textBox(40, 72, 880, 20, "These ads may be experiencing audience fatigue", { size: 12, color: MUTED });
  body += textBox(40, 94, 880, 18, slide.dateRangeLine, { size: 10, color: MUTED });

  slide.ads.slice(0, 5).forEach((ad, i) => {
    const y = 130 + i * 72;
    body += roundedCard(36, y, 888, 64, CARD, STROKE);
    body += textBox(48, y + 8, 400, 18, ad.adName, { size: 12, bold: true, color: TEXT });
    body += textBox(48, y + 28, 400, 16, ad.campaignName, { size: 10, color: MUTED });
    body += textBox(460, y + 12, 100, 18, `Freq ${ad.frequency}`, { size: 11, color: FAT });
    body += textBox(560, y + 12, 80, 18, `CTR ${ad.ctr}`, { size: 11, color: TEXT });
    body += textBox(48, y + 44, 860, 16, ad.recommendation, { size: 9, color: MUTED });
  });

  return slideWithBg(bg, body);
}

export function buildCreativeSlideRels(backgroundMediaTarget: string): string {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout2.xml"/>' +
    `<Relationship Id="${CREATIVE_BG_REL_ID}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${backgroundMediaTarget}"/>` +
    "</Relationships>"
  );
}
