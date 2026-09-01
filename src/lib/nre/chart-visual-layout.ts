import type { ShareDonutSegment } from "./share-report";
import { buildChartKpiLayout, toTitleCaseChartLabel } from "./chart-kpi-layout";

export interface ChartKpiCard {
  value: string;
  label: string;
  /** Secondary line under the value — CPR + spend for objective cards. */
  detail?: string;
}

export interface ChartKpiCardRows {
  mode: "single" | "multi";
  rows: ChartKpiCard[][];
  objectivesOmittedCount: number;
}

const OBJECTIVE_CARD_CAP = 4;

/** Top KPI card rows — single mode uses three tiles; multi uses account row + objective cards. */
export function buildChartKpiCardRows(snapshot: Parameters<typeof buildChartKpiLayout>[0]): ChartKpiCardRows {
  const layout = buildChartKpiLayout(snapshot);

  if (layout.mode === "single") {
    return {
      mode: "single",
      rows: [
        layout.accountTiles.map((tile) => ({
          value: tile.value,
          label: tile.label,
        })),
      ],
      objectivesOmittedCount: 0,
    };
  }

  const visibleObjectives = layout.objectiveBlocks.slice(0, OBJECTIVE_CARD_CAP);
  const omitted =
    layout.objectivesOmittedCount + Math.max(0, layout.objectiveBlocks.length - OBJECTIVE_CARD_CAP);

  return {
    mode: "multi",
    rows: [
      layout.accountTiles.map((tile) => ({
        value: tile.value,
        label: tile.label,
      })),
      visibleObjectives.map((obj) => ({
        value: obj.resultsValue,
        label: toTitleCaseChartLabel(obj.label),
        detail: `${obj.cprValue} · ${obj.spendFormatted} spent`,
      })),
    ],
    objectivesOmittedCount: omitted,
  };
}

export interface ChartCampaignBarRow {
  name: string;
  color: string;
  spendLabel: string;
  percentage: number;
}

/** Horizontal spend bars for the right side of the visual slide (from donut segments). */
export function buildChartCampaignBars(segments: ShareDonutSegment[]): ChartCampaignBarRow[] {
  return segments.map((seg) => ({
    name: seg.name,
    color: seg.color,
    spendLabel: seg.spendLabel,
    percentage: seg.percentage,
  }));
}

export interface MtdVisualBandMetrics {
  kpiBottomY: number;
  donutY: number;
  donutCy: number;
  barsY: number;
  barRowH: number;
  barsHeaderH: number;
}

/** Vertical geometry after KPI cards — keeps the 220px donut and aligns bars beside it. */
export function computeMtdVisualBandMetrics(
  cardRows: ChartKpiCardRows,
  segmentCount: number,
): MtdVisualBandMetrics {
  const titleBottom = 82;
  const singleRowH = 88;
  const accountRowH = 64;
  const objectiveRowH = 76;
  const rowGap = 10;

  let kpiBottomY: number;
  if (cardRows.mode === "single") {
    kpiBottomY = titleBottom + 10 + singleRowH;
  } else {
    kpiBottomY = titleBottom + 10 + accountRowH + rowGap + objectiveRowH;
  }

  const donutD = 220;
  const donutY = Math.max(200, kpiBottomY + 14);
  const donutCy = donutY + donutD / 2;
  const barsHeaderH = 22;
  const barsY = donutY + 4;
  const availableBarH = donutD - barsHeaderH - 8;
  const barRowH = segmentCount > 0 ? Math.min(40, Math.max(26, Math.floor(availableBarH / segmentCount))) : 32;

  return { kpiBottomY, donutY, donutCy, barsY, barRowH, barsHeaderH };
}
