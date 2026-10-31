import { backgroundImage, buildBlankSlideXml, resetShapeIdCounter, roundedCard, textBox } from "./shapes";
import { slideSurfacePalette } from "./slide-surface-palette";
import type { TemplateBackgroundImage } from "./package";
import type { ComparisonExtraMetric } from "../nre/comparison-extra-metrics";
import { COMPARISON_BG_REL_ID } from "./comparison-slides";

export function buildComparisonExtraSlide(input: { campaignName: string; metrics: ComparisonExtraMetric[]; periodALabel: string; periodBLabel: string; page: number; pages: number; background: TemplateBackgroundImage; isLightTemplate: boolean }): string {
  resetShapeIdCounter();
  const palette = slideSurfacePalette(input.isLightTemplate);
  const shapes = [backgroundImage({ relId: COMPARISON_BG_REL_ID, ...input.background })];
  shapes.push(textBox({ x: 40, y: 24, w: 880, h: 28, text: "ADDITIONAL COMPARISON METRICS", sizePt: 21, bold: true, colorHex: palette.heading }));
  shapes.push(textBox({ x: 40, y: 57, w: 880, h: 24, text: input.campaignName, sizePt: 16, bold: true, colorHex: palette.text }));
  const columns = [{ x: 40, w: 290, label: "METRIC" }, { x: 340, w: 200, label: "PERIOD A" }, { x: 550, w: 200, label: "PERIOD B" }, { x: 760, w: 160, label: "CHANGE" }];
  for (const col of columns) shapes.push(textBox({ x: col.x + 10, y: 95, w: col.w - 20, h: 20, text: col.label, sizePt: 12, bold: true, colorHex: palette.label }));
  shapes.push(textBox({ x: 350, y: 119, w: 190, h: 35, text: input.periodALabel, sizePt: 11, colorHex: palette.label }));
  shapes.push(textBox({ x: 560, y: 119, w: 190, h: 35, text: input.periodBLabel, sizePt: 11, colorHex: palette.label }));
  const height = Math.min(110, 310 / Math.max(1, input.metrics.length));
  const top = input.metrics.length <= 2 ? 205 : 167;
  input.metrics.forEach((metric, index) => {
    const y = top + index * height;
    shapes.push(roundedCard({ x: 40, y, w: 880, h: height - 6, radiusPt: 5, fillHex: palette.cardFill, strokeHex: palette.cardStroke }));
    const percent = metric.percent === null ? "N/A" : `${metric.percent > 0 ? "+" : ""}${metric.percent.toFixed(1)}%`;
    [metric.label, metric.formattedA, metric.formattedB, percent].forEach((text, column) => shapes.push(textBox({ x: columns[column].x + 10, y: y + (height - 6) / 2 - 12, w: columns[column].w - 20, h: 30, text, sizePt: column === 0 ? 12 : 17, bold: column > 0, colorHex: palette.text })));
  });
  shapes.push(textBox({ x: 40, y: 505, w: 880, h: 17, text: `Additional metrics · ${input.page + 1} of ${input.pages} · N/A: unavailable value or zero comparison baseline`, sizePt: 10, colorHex: palette.label }));
  return buildBlankSlideXml(shapes);
}
