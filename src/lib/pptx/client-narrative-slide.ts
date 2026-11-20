import { buildBlankSlideXml, rectangle, resetShapeIdCounter, textBox } from "./shapes";
import { slideSurfacePalette } from "./slide-surface-palette";
import type { ClientNarrative } from "../nre/report-client-narrative";
export function clientNarrativeBody(narrative: ClientNarrative, light = false): string[] {
  const p = slideSurfacePalette(light);
  return [
    textBox({x: 40, y: 140, w: 880, h: 28, text: "CAMPAIGN SUMMARY", align: "l", sizePt: 19, bold: true, colorHex: p.heading}),
    textBox({x: 40, y: 180, w: 880, h: 100, text: narrative.summary, align: "l", sizePt: narrative.summary.length > 380 ? 16 : 18, colorHex: p.text}),
    textBox({x: 40, y: 300, w: 880, h: 28, text: "KEY INSIGHTS & UPDATES", align: "l", sizePt: 19, bold: true, colorHex: p.heading}),
    ...narrative.insights.slice(0, 3).map((text, index) => textBox({x: 40, y: 342 + index * 58, w: 880, h: 54, text: `• ${text}`, align: "l", sizePt: text.length > 300 ? 12 : text.length > 180 ? 14 : 16, colorHex: p.text})),
  ];
}
export function buildClientNarrativeSlide(title: string, subtitle: string, narrative: ClientNarrative, light = false): string {
  resetShapeIdCounter(); const p = slideSurfacePalette(light);
  return buildBlankSlideXml([
    rectangle({x: 0, y: 0, w: 960, h: 540, fillHex: light ? "F8FAFC" : "0D142B"}),
    textBox({x: 40, y: 25, w: 880, h: 58, text: title.length > 110 ? `${title.slice(0, 107)}…` : title, sizePt: 25, bold: true, colorHex: p.heading}),
    textBox({x: 40, y: 88, w: 880, h: 32, text: subtitle, sizePt: 13, colorHex: p.label}),
    ...clientNarrativeBody(narrative, light),
  ]);
}
