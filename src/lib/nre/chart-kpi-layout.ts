import type { ShareChartSnapshot, ShareChartSnapshotObjective } from "./share-report";

const KNOWN_METRIC_ACRONYMS = new Set(["LPV", "CPM", "1K"]);

export function toTitleCaseChartLabel(label: string): string {
  return label
    .split(" ")
    .map((w) => (KNOWN_METRIC_ACRONYMS.has(w) ? w : w.length > 0 ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

/** Back-compat for published share JSON before multi-objective chart snapshots. */
export function normalizeShareChartSnapshot(snapshot: ShareChartSnapshot): ShareChartSnapshot {
  if (snapshot.mode && (snapshot.objectives?.length ?? 0) > 0) return snapshot;
  return {
    ...snapshot,
    mode: "single",
    primarySpendFormatted: snapshot.primarySpendFormatted ?? snapshot.mtdSpendLabel,
    objectives: [
      {
        label: snapshot.primaryResultsLabel,
        resultsValue: snapshot.primaryResultsValue,
        cprValue: snapshot.primaryCprValue,
        cprLabel: snapshot.primaryCprLabel,
        spendFormatted: snapshot.primarySpendFormatted ?? snapshot.mtdSpendLabel,
      },
    ],
    objectivesOmittedCount: snapshot.objectivesOmittedCount ?? 0,
  };
}

export interface ChartKpiTile {
  value: string;
  label: string;
}

export interface ChartObjectiveBlock {
  label: string;
  resultsValue: string;
  cprValue: string;
  cprLabel: string;
  spendFormatted: string;
}

export interface ChartKpiLayout {
  mode: "single" | "multi";
  accountTiles: ChartKpiTile[];
  objectiveBlocks: ChartObjectiveBlock[];
  objectivesOmittedCount: number;
}

/** Shared KPI layout for browser, PPT SVG, and OOXML — keeps scopes consistent. */
export function buildChartKpiLayout(snapshot: ShareChartSnapshot): ChartKpiLayout {
  const snap = normalizeShareChartSnapshot(snapshot);

  if (snap.mode === "multi") {
    return {
      mode: "multi",
      accountTiles: [{ value: snap.mtdSpendLabel, label: "Ad spend this month" }],
      objectiveBlocks: (snap.objectives ?? []).map((obj) => ({
        label: obj.label,
        resultsValue: obj.resultsValue,
        cprValue: obj.cprValue,
        cprLabel: obj.cprLabel,
        spendFormatted: obj.spendFormatted,
      })),
      objectivesOmittedCount: snap.objectivesOmittedCount ?? 0,
    };
  }

  const primary = snap.objectives?.[0];
  return {
    mode: "single",
    accountTiles: [
      {
        value: primary?.spendFormatted ?? snap.primarySpendFormatted ?? snap.mtdSpendLabel ?? "",
        label: "Ad spend this month",
      },
      { value: primary?.resultsValue ?? snap.primaryResultsValue, label: primary?.label ?? snap.primaryResultsLabel },
      { value: primary?.cprValue ?? snap.primaryCprValue, label: primary?.cprLabel ?? snap.primaryCprLabel },
    ],
    objectiveBlocks: [],
    objectivesOmittedCount: 0,
  };
}

export function mapChartSnapshotObjective(obj: ShareChartSnapshotObjective): ShareChartSnapshotObjective {
  return {
    label: toTitleCaseChartLabel(obj.label),
    resultsValue: obj.resultsValue,
    cprValue: obj.cprValue,
    cprLabel: toTitleCaseChartLabel(obj.cprLabel),
    spendFormatted: obj.spendFormatted,
  };
}
