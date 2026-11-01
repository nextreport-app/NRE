import { fitFontSizePt } from "./text-fit";
import type { DailyExtraTable } from "../nre/daily-extra-metrics";
import type { TemplateBackgroundImage } from "./package";
import { backgroundImage, buildBlankSlideXml, resetShapeIdCounter, roundedCard, textBox } from "./shapes";
import { slideSurfacePalette } from "./slide-surface-palette";
/** Native editable tables, with bounded columns/rows for readable exports. */
export function buildDailyExtraSlide(table: DailyExtraTable, heading: string, page: number, pages: number, background: TemplateBackgroundImage, light = false): string {
  resetShapeIdCounter();
  const palette = slideSurfacePalette(light);
  const shapes = [backgroundImage({ relId: "rId2", ...background })];
  shapes.push(textBox({ x: 40, y: 24, w: 880, h: 32, text: `ADDITIONAL DAILY METRICS (${page + 1}/${pages})`, sizePt: 24, bold: true, colorHex: palette.heading }));
  shapes.push(textBox({ x: 40, y: 62, w: 880, h: 25, text: heading, sizePt: 15, colorHex: palette.label }));
  const dateWidth = 170, width = (880 - dateWidth) / Math.max(1, table.metrics.length);
  const headers = ["Date", ...table.metrics.map(metric => metric.label)];
  headers.forEach((label, index) => shapes.push(textBox({ x: index === 0 ? 40 : 40 + dateWidth + (index - 1) * width, y: 100, w: index === 0 ? dateWidth : width, h: 45, text: label, sizePt: fitFontSizePt(label, (index === 0 ? dateWidth : width) * 2.3, [13, 12, 11]), bold: true, colorHex: palette.label })));
  table.rows.forEach((row, index) => {
    const y = 150 + index * 40;
    shapes.push(roundedCard({ x: 40, y, w: 880, h: 37, fillHex: palette.cardFill, strokeHex: palette.cardStroke, radiusPt: 4 }));
    [row.date, ...row.values].forEach((value, column) => shapes.push(textBox({ x: column === 0 ? 45 : 40 + dateWidth + (column - 1) * width, y: y + 7, w: column === 0 ? dateWidth - 10 : width, h: 24, text: value, sizePt: fitFontSizePt(value, (column === 0 ? dateWidth : width) - 12, [15, 14, 13, 12]), bold: column > 0, colorHex: palette.text })));
  });
  shapes.push(textBox({ x: 40, y: 493, w: 880, h: 24, text: "Selected campaigns combined by day · N/A means unavailable in the CSV", sizePt: 11, colorHex: palette.label }));
  return buildBlankSlideXml(shapes);
}
