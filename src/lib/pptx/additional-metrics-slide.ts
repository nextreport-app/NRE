import type { SlideData } from "../nre/report-data";
import type { DynamicMetricValue } from "../nre/dynamic-metrics";
import { paginateExtraMetrics } from "../nre/metric-pagination";
import type { TemplateBackgroundImage } from "./package";
import { backgroundImage, buildBlankSlideXml, resetShapeIdCounter, roundedCard, textBox } from "./shapes";
import { slideSurfacePalette } from "./slide-surface-palette";

/** Also removes the result/cost filler found in older frozen report archives. */
export function additionalMetricPages(slide: Pick<SlideData, "dynamicMetrics" | "additionalMetricsSlide">): DynamicMetricValue[][] {
  const seen = new Set(slide.dynamicMetrics.filter(Boolean).map(metric => metric!.key));
  const extras = (slide.additionalMetricsSlide ?? []).filter((metric): metric is DynamicMetricValue => {
    if (!metric || seen.has(metric.key)) return false;
    seen.add(metric.key);
    return true;
  });
  return paginateExtraMetrics(extras);
}

/** Balanced native, editable cards; no empty slots, borrowed KPIs or repeated AI copy. */
export function buildAdditionalMetricsSlideXml(slide: SlideData, metrics: DynamicMetricValue[], pageIndex: number, pageCount: number, background: TemplateBackgroundImage, isLightTemplate = false): string {
  resetShapeIdCounter();
  const palette = slideSurfacePalette(isLightTemplate);
  const shapes = [backgroundImage({ relId: "rId2", ...background })];
  const name = slide.kind === "adset" ? `${slide.campaignName} · ${slide.adSetName}` : slide.campaignName;
  const title = name.length > 165 ? `${name.slice(0, 162)}…` : name;
  shapes.push(textBox({ x: 40, y: 26, w: 880, h: 24, text: "ADDITIONAL METRICS", sizePt: 15, bold: true, colorHex: palette.heading, align: "l" }));
  shapes.push(textBox({ x: 40, y: 62, w: 880, h: 52, text: title, sizePt: 20, bold: true, colorHex: palette.text, align: "l" }));
  shapes.push(textBox({ x: 40, y: 123, w: 880, h: 30, text: `${slide.ai.dateRange} · ${slide.resultLabel}`, sizePt: 12, colorHex: palette.label, align: "l" }));
  const columns = metrics.length <= 3 ? metrics.length : metrics.length <= 4 ? 2 : metrics.length <= 6 ? 3 : 4;
  const rows = Math.ceil(metrics.length / columns);
  const gap = 16;
  const areaWidth = metrics.length === 1 ? 640 : 880;
  const width = (areaWidth - gap * (columns - 1)) / columns;
  const height = rows === 1 ? 236 : 136;
  const areaX = (960 - areaWidth) / 2;
  const top = rows === 1 ? 192 : 174;
  metrics.forEach((metric, index) => {
    const row = Math.floor(index / columns);
    const itemsInRow = Math.min(columns, metrics.length - row * columns);
    const rowOffset = (columns - itemsInRow) * (width + gap) / 2;
    const x = areaX + rowOffset + index % columns * (width + gap);
    const y = top + row * (height + gap);
    shapes.push(roundedCard({ x, y, w: width, h: height, fillHex: palette.cardFill, strokeHex: palette.cardStroke, radiusPt: 10 }));
    shapes.push(textBox({ x: x + 18, y: y + 22, w: width - 36, h: rows === 1 ? 66 : 46, text: metric.label, sizePt: Math.min(columns >= 4 ? 12 : 14, Math.max(9, (width - 36) * 2.5 / Math.max(1, metric.label.length))), bold: true, colorHex: palette.label, align: "ctr" }));
    const valueSize = Math.min(metrics.length === 1 ? 50 : 34, Math.max(17, (width - 36) / Math.max(1, metric.value.length) * 1.6));
    shapes.push(textBox({ x: x + 18, y: y + (rows === 1 ? 112 : 78), w: width - 36, h: rows === 1 ? 80 : 44, text: metric.value, sizePt: valueSize, bold: true, colorHex: palette.text, align: "ctr" }));
  });
  shapes.push(textBox({ x: 40, y: 493, w: 880, h: 22, text: `${metrics.length} additional ${metrics.length === 1 ? "metric" : "metrics"}${pageCount > 1 ? ` · ${pageIndex + 1} of ${pageCount}` : ""}`, sizePt: 11, colorHex: palette.label, align: "r" }));
  return buildBlankSlideXml(shapes);
}
