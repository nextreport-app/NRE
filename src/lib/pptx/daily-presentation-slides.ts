import type {
  DailySummaryMetric,
  DailyTrendPage,
} from "../nre/daily-report-presentation";
import type { TemplateBackgroundImage } from "./package";
import {
  backgroundImage,
  buildBlankSlideXml,
  rectangle,
  resetShapeIdCounter,
  roundedCard,
  textBox,
} from "./shapes";
import { slideSurfacePalette } from "./slide-surface-palette";
import { fitFontSizePt } from "./text-fit";
import { formatMetricValue } from "../nre/format";
export function buildDailySummarySlide(
  metrics: DailySummaryMetric[],
  heading: string,
  note: string,
  page: number,
  pages: number,
  background: TemplateBackgroundImage,
  light = false,
) {
  resetShapeIdCounter();
  const palette = slideSurfacePalette(light);
  const shapes = [
    backgroundImage({ relId: "rId2", ...background }),
    textBox({
      x: 40,
      y: 25,
      w: 880,
      h: 34,
      text: `SELECTED PERIOD TOTALS${pages > 1 ? ` (${page + 1}/${pages})` : ""}`,
      sizePt: 25,
      bold: true,
      colorHex: palette.heading,
    }),
    textBox({
      x: 40,
      y: 68,
      w: 880,
      h: 30,
      text: heading,
      sizePt: 15,
      colorHex: palette.label,
    }),
  ];
  const columns = Math.min(4, metrics.length),
    rows = Math.ceil(metrics.length / columns),
    width = (880 - (columns - 1) * 16) / columns,
    height = rows === 1 ? 270 : 150;
  metrics.forEach((metric, index) => {
    const row = Math.floor(index / columns),
      count = Math.min(columns, metrics.length - row * columns),
      x =
        40 +
        (880 - (count * width + (count - 1) * 16)) / 2 +
        (index % columns) * (width + 16),
      y = 125 + row * (height + 16);
    shapes.push(
      roundedCard({
        x,
        y,
        w: width,
        h: height,
        fillHex: palette.cardFill,
        strokeHex: palette.cardStroke,
        radiusPt: 10,
      }),
    );
    shapes.push(
      textBox({
        x: x + 12,
        y: y + 20,
        w: width - 24,
        h: 50,
        text: metric.label,
        sizePt: fitFontSizePt(metric.label, (width - 24) * 2, [14, 13, 12]),
        bold: true,
        colorHex: palette.label,
      }),
    );
    shapes.push(
      textBox({
        x: x + 12,
        y: y + 85,
        w: width - 24,
        h: 45,
        text: metric.value,
        sizePt: fitFontSizePt(metric.value, width - 24, [32, 28, 24, 20, 18]),
        bold: true,
        colorHex: palette.text,
      }),
    );
  });
  shapes.push(
    textBox({
      x: 40,
      y: 473,
      w: 880,
      h: 50,
      text: note,
      sizePt: 11,
      colorHex: palette.label,
      align: "l",
    }),
  );
  return buildBlankSlideXml(shapes);
}
export function buildDailyTrendSlide(
  page: DailyTrendPage,
  heading: string,
  index: number,
  count: number,
  currencySymbol: string,
  background: TemplateBackgroundImage,
  light = false,
) {
  resetShapeIdCounter();
  const palette = slideSurfacePalette(light);
  const shapes = [
    backgroundImage({ relId: "rId2", ...background }),
    textBox({
      x: 40,
      y: 24,
      w: 880,
      h: 34,
      text: `DAILY PERFORMANCE TREND${count > 1 ? ` (${index + 1}/${count})` : ""}`,
      sizePt: 25,
      bold: true,
      colorHex: palette.heading,
    }),
    textBox({
      x: 40,
      y: 66,
      w: 880,
      h: 24,
      text: heading,
      sizePt: 14,
      colorHex: palette.label,
    }),
  ];
  const display = (
    value: number,
    format: (typeof page.series)[number]["format"],
  ) =>
    format === "number"
      ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(
          value,
        )
      : formatMetricValue(value, format, currencySymbol);
  const dateLabel = (iso: string) =>
    new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${iso}T12:00:00Z`));
  page.series.forEach((series, seriesIndex) => {
    const top = page.series.length === 1 ? 120 : 110 + seriesIndex * 190,
      plotHeight = page.series.length === 1 ? 250 : 105,
      baseline = top + 50 + plotHeight,
      plotX = 125,
      plotWidth = 780;
    const max = Math.max(1, ...series.points.map((point) => point.value ?? 0));
    const step = plotWidth / Math.max(1, series.points.length),
      barWidth = Math.min(65, step * 0.7),
      color = seriesIndex === 0 ? "f6ad55" : "38bdf8";
    shapes.push(
      textBox({
        x: 40,
        y: top - 3,
        w: 880,
        h: 25,
        text: series.label,
        sizePt: 15,
        bold: true,
        colorHex: palette.text,
        align: "l",
      }),
    );
    for (const fraction of [0, 0.5, 1]) {
      const y = baseline - fraction * plotHeight;
      shapes.push(
        rectangle({
          x: plotX,
          y,
          w: plotWidth,
          h: 0.5,
          fillHex: palette.cardStroke,
        }),
      );
      shapes.push(
        textBox({
          x: 40,
          y: y - 7,
          w: 72,
          h: 18,
          text: display(max * fraction, series.format),
          sizePt: 10,
          colorHex: palette.label,
          align: "r",
        }),
      );
    }
    series.points.forEach((point, pointIndex) => {
      const x = plotX + pointIndex * step + (step - barWidth) / 2;
      if (point.value !== null) {
        const height = (point.value / max) * plotHeight;
        shapes.push(
          rectangle({
            x,
            y: baseline - Math.max(1, height),
            w: barWidth,
            h: Math.max(1, height),
            fillHex: color,
          }),
        );
        if (series.points.length <= 10)
          shapes.push(
            textBox({
              x: plotX + pointIndex * step,
              y: baseline - height - 19,
              w: step,
              h: 18,
              text: display(point.value, series.format),
              sizePt: 11,
              bold: true,
              colorHex: palette.text,
            }),
          );
      } else
        shapes.push(
          textBox({
            x,
            y: baseline - 18,
            w: barWidth,
            h: 18,
            text: "—",
            sizePt: 11,
            colorHex: palette.label,
          }),
        );
      const interval = Math.ceil(series.points.length / 8);
      if (
        pointIndex % interval === 0 ||
        pointIndex === series.points.length - 1
      )
        shapes.push(
          textBox({
            x: plotX + pointIndex * step - 12,
            y: baseline + 7,
            w: step + 24,
            h: 25,
            text: dateLabel(point.dateIso),
            sizePt: 10,
            colorHex: palette.label,
          }),
        );
    });
  });
  shapes.push(
    textBox({
      x: 40,
      y: 511,
      w: 880,
      h: 18,
      text: "Gaps indicate missing CSV observations; zero means an exported zero. Each metric has its own scale.",
      sizePt: 10,
      colorHex: palette.label,
    }),
  );
  return buildBlankSlideXml(shapes);
}
