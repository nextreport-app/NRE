import { normalizeShareChartSnapshot, toTitleCaseChartLabel } from "./chart-kpi-layout";
import type { ShareChartSnapshot } from "./share-report";

/** Hard cap on objectives stored in a snapshot — table renderer may show fewer. */
export const CHART_SNAPSHOT_OBJECTIVE_MAX = 20;

export type ChartMetricsRowKind = "header" | "total" | "objective" | "budget" | "footnote";

export interface ChartMetricsTableRow {
  kind: ChartMetricsRowKind;
  label: string;
  spend: string;
  results: string;
  cpr: string;
}

export interface ChartMetricsTableLayout {
  rowHeights: number[];
  bodyFontSize: number;
  headerFontSize: number;
}

export interface ChartMetricsTable {
  columns: readonly ["Objective", "Ad spend", "Results", "Cost per result"];
  rows: ChartMetricsTableRow[];
  layout: ChartMetricsTableLayout;
  objectivesOmittedCount: number;
}

const TABLE_COLUMNS = ["Objective", "Ad spend", "Results", "Cost per result"] as const;

/** Slide/table band height in px — shared by browser, SVG, and OOXML. */
export const CHART_METRICS_TABLE_MAX_HEIGHT = 352;

function pickRowMetrics(
  objectiveCount: number,
  isMulti: boolean,
  maxHeight: number,
): { visibleCount: number; objectiveRowH: number; headerH: number; budgetH: number; totalH: number; footnoteH: number } {
  const headerH = 28;
  const budgetH = 26;
  const totalH = isMulti ? 28 : 0;
  const footnoteH = 20;
  const minObjectiveRowH = 22;
  const maxObjectiveRowH = 34;

  for (let visible = objectiveCount; visible >= 1; visible--) {
    const omitted = objectiveCount - visible;
    const fixed = headerH + budgetH + totalH + (omitted > 0 ? footnoteH : 0);
    const available = maxHeight - fixed;
    const rowH = Math.floor(available / visible);
    if (rowH >= minObjectiveRowH) {
      return {
        visibleCount: visible,
        objectiveRowH: Math.min(maxObjectiveRowH, rowH),
        headerH,
        budgetH,
        totalH,
        footnoteH: omitted > 0 ? footnoteH : 0,
      };
    }
  }

  return {
    visibleCount: 1,
    objectiveRowH: minObjectiveRowH,
    headerH,
    budgetH,
    totalH,
    footnoteH: objectiveCount > 1 ? footnoteH : 0,
  };
}

/** Builds the MTD overview metrics table — adapts row height to objective count. */
export function buildChartMetricsTable(
  snapshot: ShareChartSnapshot,
  maxHeight = CHART_METRICS_TABLE_MAX_HEIGHT,
): ChartMetricsTable {
  const snap = normalizeShareChartSnapshot(snapshot);
  const objectives = (snap.objectives ?? []).map((obj) => ({
    label: toTitleCaseChartLabel(obj.label),
    resultsValue: obj.resultsValue,
    cprValue: obj.cprValue,
    spendFormatted: obj.spendFormatted,
  }));
  const isMulti = objectives.length >= 2;
  const metrics = pickRowMetrics(objectives.length, isMulti, maxHeight);
  const visibleObjectives = objectives.slice(0, metrics.visibleCount);
  const omitted = Math.max(0, objectives.length - metrics.visibleCount);

  const rows: ChartMetricsTableRow[] = [
    {
      kind: "header",
      label: TABLE_COLUMNS[0],
      spend: TABLE_COLUMNS[1],
      results: TABLE_COLUMNS[2],
      cpr: TABLE_COLUMNS[3],
    },
  ];

  if (isMulti) {
    rows.push({
      kind: "total",
      label: "All campaigns",
      spend: snap.mtdSpendLabel,
      results: "—",
      cpr: "—",
    });
  }

  for (const obj of visibleObjectives) {
    rows.push({
      kind: "objective",
      label: obj.label,
      spend: obj.spendFormatted,
      results: obj.resultsValue,
      cpr: obj.cprValue,
    });
  }

  rows.push({
    kind: "budget",
    label: "Budget used",
    spend: snap.budgetPctUsed ? `${snap.budgetPctUsed}` : "—",
    results: "—",
    cpr: "—",
  });

  if (omitted > 0) {
    rows.push({
      kind: "footnote",
      label: `+${omitted} more objective${omitted === 1 ? "" : "s"} on Combined Total slide`,
      spend: "",
      results: "",
      cpr: "",
    });
  }

  const rowHeights: number[] = [];
  for (const row of rows) {
    switch (row.kind) {
      case "header":
        rowHeights.push(metrics.headerH);
        break;
      case "total":
        rowHeights.push(metrics.totalH);
        break;
      case "budget":
        rowHeights.push(metrics.budgetH);
        break;
      case "footnote":
        rowHeights.push(metrics.footnoteH);
        break;
      default:
        rowHeights.push(metrics.objectiveRowH);
    }
  }

  const bodyFontSize = metrics.objectiveRowH <= 24 ? 11 : metrics.objectiveRowH <= 28 ? 12 : 13;
  const headerFontSize = 11;

  return {
    columns: TABLE_COLUMNS,
    rows,
    layout: { rowHeights, bodyFontSize, headerFontSize },
    objectivesOmittedCount: omitted,
  };
}
