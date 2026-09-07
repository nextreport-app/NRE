/**
 * Website Traffic (GA4) slide builders — separate from Meta/Google Ads render path.
 */

import { backgroundImage, buildBlankSlideXml, resetShapeIdCounter, roundedCard, textBox } from "./shapes";
import type { TemplateBackgroundImage, TemplateSlide } from "./package";
import { buildCampaignOrAdSetSlideXml, buildCoverSlideXml, type AiCopy } from "./fill-tags";
import type { CampaignSlideData } from "../nre/report-data";
import { websiteMetricsToDynamicSlots } from "../nre/website-metrics-to-slots";
import { geoColumnHeader, geoSlideTitle } from "../nre/website-report-config";
import type {
  WebsiteCampaignRow,
  WebsiteChannelRow,
  WebsiteDemographicRow,
  WebsiteDeviceRow,
  WebsiteGeoRow,
  WebsitePageRow,
  WebsiteReportData,
  WebsiteSourceRow,
} from "../nre/website-report-data";

export const WEBSITE_BG_REL_ID = "rId2";

const TEXT_COLOR = "FFFFFF";
const LABEL_COLOR = "94a3b8";
const HEADING_COLOR = "f6ad55";
const CARD_FILL = "111f35";
const CARD_STROKE = "1e3a5f";
const TABLE_HEADER_FILL = "0d1b2e";
const TABLE_ROW_FILL = CARD_FILL;
const TABLE_ALT_FILL = "16233d";

function buildWebsiteSlideRels(backgroundMediaTarget: string): string {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout2.xml"/>' +
    `<Relationship Id="${WEBSITE_BG_REL_ID}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${backgroundMediaTarget}"/>` +
    "</Relationships>"
  );
}

export function buildWebsiteCoverSlideXml(
  template: TemplateSlide,
  data: WebsiteReportData,
  options: { agencyName?: string | null; accountName: string },
): string {
  return buildCoverSlideXml(
    template,
    {
      accountName: options.accountName,
      reportDate: data.propertyName,
      dateRange: data.dateRangeLabel,
      healthBadge: "",
      healthScore: 0,
      budgetSummary: data.comparisonRangeLabel ? `Compared to ${data.comparisonRangeLabel}` : "",
    },
    { agencyName: options.agencyName, reportType: "WEBSITE" },
  );
}

function metricSlideData(title: string, dateRangeLine: string, cards: WebsiteReportData["overviewMetrics"]): CampaignSlideData {
  return {
    kind: "campaign",
    campaignName: title,
    resultLabel: "",
    costLabel: "",
    metrics: {
      spend: "—",
      reach: "—",
      impressions: "—",
      results: "—",
      ctr: "—",
      cpr: "—",
      cpc: "—",
    },
    dateRangeLine,
    avgFreq: 0,
    ai: {
      ctx: "",
      dateRange: dateRangeLine,
      spend: "—",
      reach: "—",
      impressions: "—",
      results: "—",
      cpr: "—",
      ctr: "—",
      cpc: "—",
      cpm: "—",
      resultLabel: "",
      costLabel: "",
      freq: 0,
      resultsNum: 0,
      hasResults: false,
      spendNum: 0,
      isInactive: false,
    },
    statusIndicator: null,
    dynamicMetrics: websiteMetricsToDynamicSlots(cards),
  };
}

const WEBSITE_AI: AiCopy = {
  summary: "Website traffic and engagement for this period are shown on the metric cards above.",
  insights: "Compare sessions, engagement rate, and conversions to see how visitors behaved on the site.",
};

export function buildWebsiteOverviewSlideXml(template: TemplateSlide, data: WebsiteReportData): string {
  const slide = metricSlideData("Traffic Overview", data.dateRangeLabel, data.overviewMetrics);
  return buildCampaignOrAdSetSlideXml(template, slide, WEBSITE_AI, "WEBSITE", "META", false, true);
}

export function buildWebsiteConversionSlideXml(template: TemplateSlide, data: WebsiteReportData): string {
  const title =
    data.clientKind === "ecommerce"
      ? "Ecommerce Performance"
      : data.clientKind === "lead_gen"
        ? "Conversions"
        : data.clientKind === "saas"
          ? "Product Sign-ups"
          : "Content Engagement";
  const slide = metricSlideData(title, data.dateRangeLabel, data.conversionMetrics);
  return buildCampaignOrAdSetSlideXml(template, slide, WEBSITE_AI, "WEBSITE", "META", false, true);
}

function truncateCell(text: string, max = 42): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function buildSimpleTableSlide(
  title: string,
  subtitle: string,
  columns: Array<{ header: string; widthPt: number; align?: "l" | "ctr" }>,
  rows: string[][],
  background: TemplateBackgroundImage,
): string {
  resetShapeIdCounter();
  const shapes: string[] = [];
  shapes.push(backgroundImage({ relId: WEBSITE_BG_REL_ID, ...background }));

  const MARGIN = 40;
  shapes.push(
    textBox({
      x: MARGIN,
      y: 28,
      w: 880,
      h: 28,
      text: title,
      sizePt: 22,
      bold: true,
      colorHex: HEADING_COLOR,
    }),
  );
  shapes.push(
    textBox({
      x: MARGIN,
      y: 56,
      w: 880,
      h: 18,
      text: subtitle,
      sizePt: 12,
      colorHex: LABEL_COLOR,
    }),
  );

  const tableTop = 88;
  const rowH = 34;
  const headerH = 36;
  let x = MARGIN;
  const totalW = columns.reduce((sum, c) => sum + c.widthPt, 0);

  columns.forEach((col) => {
    shapes.push(
      roundedCard({
        x,
        y: tableTop,
        w: col.widthPt,
        h: headerH,
        fillHex: TABLE_HEADER_FILL,
        strokeHex: CARD_STROKE,
        radiusPt: 6,
      }),
    );
    shapes.push(
      textBox({
        x: x + 8,
        y: tableTop + 10,
        w: col.widthPt - 16,
        h: 16,
        text: col.header,
        sizePt: 11,
        bold: true,
        colorHex: LABEL_COLOR,
        align: col.align ?? "l",
      }),
    );
    x += col.widthPt;
  });

  rows.forEach((row, rowIndex) => {
    const y = tableTop + headerH + rowIndex * rowH;
    let colX = MARGIN;
    const fill = rowIndex % 2 === 0 ? TABLE_ROW_FILL : TABLE_ALT_FILL;
    row.forEach((cell, colIndex) => {
      const col = columns[colIndex];
      shapes.push(
        roundedCard({
          x: colX,
          y,
          w: col.widthPt,
          h: rowH,
          fillHex: fill,
          strokeHex: CARD_STROKE,
          radiusPt: 4,
        }),
      );
      shapes.push(
        textBox({
          x: colX + 8,
          y: y + 9,
          w: col.widthPt - 16,
          h: 16,
          text: cell,
          sizePt: 11,
          colorHex: TEXT_COLOR,
          align: col.align ?? "l",
        }),
      );
      colX += col.widthPt;
    });
  });

  // Footnote width guard — table should fit 960pt slide
  if (totalW > 880) {
    throw new Error("Website table columns exceed slide width");
  }

  return buildBlankSlideXml(shapes);
}

export function buildWebsiteChannelTableSlideXml(data: WebsiteReportData, background: TemplateBackgroundImage): string {
  const columns = [
    { header: "CHANNEL", widthPt: 280, align: "l" as const },
    { header: "SESSIONS", widthPt: 140, align: "ctr" as const },
    { header: "ENGAGEMENT", widthPt: 160, align: "ctr" as const },
    { header: "CONVERSIONS", widthPt: 160, align: "ctr" as const },
  ];
  const rows = data.channels.map((row: WebsiteChannelRow) => [
    truncateCell(row.channel, 36),
    row.sessionsLabel,
    row.engagementRateLabel,
    row.conversionsLabel,
  ]);
  if (rows.length === 0) {
    rows.push(["No channel data", "—", "—", "—"]);
  }
  return buildSimpleTableSlide("Traffic Sources", data.dateRangeLabel, columns, rows, background);
}

export function buildWebsiteTopPagesSlideXml(data: WebsiteReportData, background: TemplateBackgroundImage): string {
  const columns = [
    { header: "PAGE", widthPt: 420, align: "l" as const },
    { header: "SESSIONS", widthPt: 160, align: "ctr" as const },
    { header: "ENGAGEMENT", widthPt: 160, align: "ctr" as const },
  ];
  const rows = data.topPages.map((row: WebsitePageRow) => [
    truncateCell(row.page, 52),
    row.sessionsLabel,
    row.engagementRateLabel,
  ]);
  if (rows.length === 0) {
    rows.push(["No page data", "—", "—"]);
  }
  return buildSimpleTableSlide("Top Landing Pages", data.dateRangeLabel, columns, rows, background);
}

export function buildWebsiteDeviceTableSlideXml(data: WebsiteReportData, background: TemplateBackgroundImage): string {
  const columns = [
    { header: "DEVICE", widthPt: 220, align: "l" as const },
    { header: "SESSIONS", widthPt: 140, align: "ctr" as const },
    { header: "ENGAGEMENT", widthPt: 160, align: "ctr" as const },
    { header: "CONVERSIONS", widthPt: 160, align: "ctr" as const },
  ];
  const rows = data.devices.map((row: WebsiteDeviceRow) => [
    truncateCell(row.device, 24),
    row.sessionsLabel,
    row.engagementRateLabel,
    row.conversionsLabel,
  ]);
  if (rows.length === 0) {
    rows.push(["No device data", "—", "—", "—"]);
  }
  return buildSimpleTableSlide("Device Breakdown", data.dateRangeLabel, columns, rows, background);
}

export function buildWebsiteGeoTableSlideXml(data: WebsiteReportData, background: TemplateBackgroundImage): string {
  const geoHeader = geoColumnHeader(data.geoDimension ?? "city").toUpperCase();
  const columns = [
    { header: geoHeader, widthPt: 260, align: "l" as const },
    { header: "SESSIONS", widthPt: 120, align: "ctr" as const },
    { header: "% OF TOTAL", widthPt: 120, align: "ctr" as const },
    { header: "CONVERSIONS", widthPt: 120, align: "ctr" as const },
    { header: "CONV. RATE", widthPt: 120, align: "ctr" as const },
  ];
  const rows = data.geoCities.map((row: WebsiteGeoRow) => [
    truncateCell(row.location, 28),
    row.sessionsLabel,
    row.shareLabel,
    row.conversionsLabel,
    row.conversionRateLabel,
  ]);
  if (rows.length === 0) {
    rows.push(["No location data", "—", "—", "—", "—"]);
  }
  return buildSimpleTableSlide(geoSlideTitle(data.geoDimension ?? "city"), data.dateRangeLabel, columns, rows, background);
}

function standardMetricColumns(nameHeader: string, nameWidth = 280) {
  return [
    { header: nameHeader, widthPt: nameWidth, align: "l" as const },
    { header: "SESSIONS", widthPt: 140, align: "ctr" as const },
    { header: "ENGAGEMENT", widthPt: 160, align: "ctr" as const },
    { header: "CONVERSIONS", widthPt: 160, align: "ctr" as const },
  ];
}

export function buildWebsiteCampaignTableSlideXml(data: WebsiteReportData, background: TemplateBackgroundImage): string {
  const columns = standardMetricColumns("CAMPAIGN", 300);
  const rows = data.campaigns.map((row: WebsiteCampaignRow) => [
    truncateCell(row.campaign, 40),
    row.sessionsLabel,
    row.engagementRateLabel,
    row.conversionsLabel,
  ]);
  if (rows.length === 0) rows.push(["No campaign data", "—", "—", "—"]);
  return buildSimpleTableSlide("Campaign Performance", data.dateRangeLabel, columns, rows, background);
}

export function buildWebsiteSourceTableSlideXml(data: WebsiteReportData, background: TemplateBackgroundImage): string {
  const columns = standardMetricColumns("SOURCE / MEDIUM", 320);
  const rows = data.sources.map((row: WebsiteSourceRow) => [
    truncateCell(row.label, 44),
    row.sessionsLabel,
    row.engagementRateLabel,
    row.conversionsLabel,
  ]);
  if (rows.length === 0) rows.push(["No source data", "—", "—", "—"]);
  return buildSimpleTableSlide("Traffic Sources (UTM)", data.dateRangeLabel, columns, rows, background);
}

export function buildWebsiteAudienceSlideXml(data: WebsiteReportData, background: TemplateBackgroundImage): string {
  const columns = standardMetricColumns("AUDIENCE", 240);
  const rows = data.audience.map((row) => [
    truncateCell(row.segment, 24),
    row.sessionsLabel,
    row.engagementRateLabel,
    row.conversionsLabel,
  ]);
  if (rows.length === 0) rows.push(["No audience data", "—", "—", "—"]);
  return buildSimpleTableSlide("New vs Returning", data.dateRangeLabel, columns, rows, background);
}

export function buildWebsiteTechTableSlideXml(
  data: WebsiteReportData,
  background: TemplateBackgroundImage,
  title: string,
  nameHeader: string,
  rows: Array<{ name: string; sessionsLabel: string; engagementRateLabel: string; conversionsLabel: string }>,
): string {
  const columns = standardMetricColumns(nameHeader, 260);
  const tableRows = rows.map((row) => [
    truncateCell(row.name, 32),
    row.sessionsLabel,
    row.engagementRateLabel,
    row.conversionsLabel,
  ]);
  if (tableRows.length === 0) tableRows.push([`No ${nameHeader.toLowerCase()} data`, "—", "—", "—"]);
  return buildSimpleTableSlide(title, data.dateRangeLabel, columns, tableRows, background);
}

function buildCompactTableBlock(
  shapes: string[],
  opts: {
    title: string;
    x: number;
    y: number;
    w: number;
    columns: Array<{ header: string; widthPt: number; align?: "l" | "ctr" }>;
    rows: string[][];
  },
) {
  const rowH = 28;
  const headerH = 30;
  shapes.push(
    textBox({
      x: opts.x,
      y: opts.y,
      w: opts.w,
      h: 20,
      text: opts.title,
      sizePt: 14,
      bold: true,
      colorHex: HEADING_COLOR,
    }),
  );
  const tableTop = opts.y + 24;
  let x = opts.x;
  opts.columns.forEach((col) => {
    shapes.push(
      roundedCard({
        x,
        y: tableTop,
        w: col.widthPt,
        h: headerH,
        fillHex: TABLE_HEADER_FILL,
        strokeHex: CARD_STROKE,
        radiusPt: 4,
      }),
    );
    shapes.push(
      textBox({
        x: x + 6,
        y: tableTop + 8,
        w: col.widthPt - 12,
        h: 14,
        text: col.header,
        sizePt: 9,
        bold: true,
        colorHex: LABEL_COLOR,
        align: col.align ?? "l",
      }),
    );
    x += col.widthPt;
  });
  opts.rows.slice(0, 6).forEach((row, rowIndex) => {
    const y = tableTop + headerH + rowIndex * rowH;
    let colX = opts.x;
    const fill = rowIndex % 2 === 0 ? TABLE_ROW_FILL : TABLE_ALT_FILL;
    row.forEach((cell, colIndex) => {
      const col = opts.columns[colIndex]!;
      shapes.push(
        roundedCard({ x: colX, y, w: col.widthPt, h: rowH, fillHex: fill, strokeHex: CARD_STROKE, radiusPt: 3 }),
      );
      shapes.push(
        textBox({
          x: colX + 6,
          y: y + 7,
          w: col.widthPt - 12,
          h: 14,
          text: cell,
          sizePt: 9,
          colorHex: TEXT_COLOR,
          align: col.align ?? "l",
        }),
      );
      colX += col.widthPt;
    });
  });
}

export function buildWebsiteDemographicsSlideXml(data: WebsiteReportData, background: TemplateBackgroundImage): string {
  resetShapeIdCounter();
  const shapes: string[] = [];
  shapes.push(backgroundImage({ relId: WEBSITE_BG_REL_ID, ...background }));
  const MARGIN = 40;
  shapes.push(
    textBox({
      x: MARGIN,
      y: 28,
      w: 880,
      h: 28,
      text: "Demographics",
      sizePt: 22,
      bold: true,
      colorHex: HEADING_COLOR,
    }),
  );
  shapes.push(
    textBox({
      x: MARGIN,
      y: 56,
      w: 880,
      h: 18,
      text: data.dateRangeLabel,
      sizePt: 12,
      colorHex: LABEL_COLOR,
    }),
  );
  if (data.demographicsNote) {
    shapes.push(
      textBox({
        x: MARGIN,
        y: 76,
        w: 880,
        h: 16,
        text: data.demographicsNote,
        sizePt: 10,
        colorHex: LABEL_COLOR,
      }),
    );
  }

  const demoCols = [
    { header: "SEGMENT", widthPt: 160, align: "l" as const },
    { header: "SESSIONS", widthPt: 100, align: "ctr" as const },
    { header: "CONVERSIONS", widthPt: 110, align: "ctr" as const },
    { header: "CONV. RATE", widthPt: 100, align: "ctr" as const },
  ];
  const ageRows = data.ageGroups.map((row: WebsiteDemographicRow) => [
    truncateCell(row.segment, 20),
    row.sessionsLabel,
    row.conversionsLabel,
    row.conversionRateLabel,
  ]);
  if (ageRows.length === 0) ageRows.push(["No age data", "—", "—", "—"]);

  const genderRows = data.genders.map((row: WebsiteDemographicRow) => [
    truncateCell(row.segment, 20),
    row.sessionsLabel,
    row.conversionsLabel,
    row.conversionRateLabel,
  ]);
  if (genderRows.length === 0) genderRows.push(["No gender data", "—", "—", "—"]);

  buildCompactTableBlock(shapes, {
    title: "Age Groups",
    x: MARGIN,
    y: 100,
    w: 420,
    columns: demoCols,
    rows: ageRows,
  });
  buildCompactTableBlock(shapes, {
    title: "Gender",
    x: 480,
    y: 100,
    w: 420,
    columns: demoCols,
    rows: genderRows,
  });

  return buildBlankSlideXml(shapes);
}

export function buildWebsiteTimeTableSlideXml(
  data: WebsiteReportData,
  background: TemplateBackgroundImage,
  title: string,
  nameHeader: string,
  rows: WebsiteReportData["dayOfWeek"],
): string {
  const columns = [
    { header: nameHeader, widthPt: 220, align: "l" as const },
    { header: "SESSIONS", widthPt: 140, align: "ctr" as const },
    { header: "ENGAGEMENT", widthPt: 160, align: "ctr" as const },
    { header: "CONVERSIONS", widthPt: 140, align: "ctr" as const },
    { header: "CONV. RATE", widthPt: 120, align: "ctr" as const },
  ];
  const tableRows = rows.map((row) => [
    truncateCell(row.label, 20),
    row.sessionsLabel,
    row.engagementRateLabel,
    row.conversionsLabel,
    row.conversionRateLabel,
  ]);
  if (tableRows.length === 0) tableRows.push([`No ${nameHeader.toLowerCase()} data`, "—", "—", "—", "—"]);
  return buildSimpleTableSlide(title, data.dateRangeLabel, columns, tableRows, background);
}

export function buildWebsiteConversionEventsSlideXml(data: WebsiteReportData, background: TemplateBackgroundImage): string {
  const columns = [
    { header: "EVENT", widthPt: 300, align: "l" as const },
    { header: "COUNT", widthPt: 120, align: "ctr" as const },
    { header: "SESSIONS", widthPt: 120, align: "ctr" as const },
    { header: "RATE", widthPt: 120, align: "ctr" as const },
  ];
  const rows = data.conversionEvents.map((row) => [
    truncateCell(row.event, 40),
    row.countLabel,
    row.sessionsLabel,
    row.conversionRateLabel,
  ]);
  if (rows.length === 0) rows.push(["No conversion events", "—", "—", "—"]);
  return buildSimpleTableSlide("Conversion Events", data.dateRangeLabel, columns, rows, background);
}

export { buildWebsiteSlideRels };
