/**
 * Shared table cell rendering for MTD overview SVG + OOXML exports.
 */

import type { ChartMetricsTable, ChartMetricsTableRow } from "../nre/chart-metrics-table";

const MTD_TABLE_COL_FRACS = [0.4, 0.22, 0.16, 0.22] as const;

export interface MetricsTableColors {
  ink: string;
  inkMuted: string;
  accent: string;
  headerBg: string;
  rowBg: string;
  rowAltBg: string;
  border: string;
}

export const METRICS_TABLE_COLORS_DARK: MetricsTableColors = {
  ink: "ffffff",
  inkMuted: "94a3b8",
  accent: "f6ad55",
  headerBg: "1a2740",
  rowBg: "131d30",
  rowAltBg: "162033",
  border: "1e293b",
};

export const METRICS_TABLE_COLORS_LIGHT: MetricsTableColors = {
  ink: "0d1b2e",
  inkMuted: "64748b",
  accent: "d97706",
  headerBg: "e2e8f0",
  rowBg: "f8fafc",
  rowAltBg: "f1f5f9",
  border: "cbd5e1",
};

export function metricsTableColumnXs(tableX: number, tableW: number): number[] {
  const widths = MTD_TABLE_COL_FRACS.map((f) => Math.round(tableW * f));
  const xs = [tableX];
  for (let i = 0; i < widths.length - 1; i++) {
    xs.push(xs[i]! + widths[i]!);
  }
  return xs;
}

export function metricsTableColumnWidths(tableW: number): number[] {
  return MTD_TABLE_COL_FRACS.map((f) => Math.round(tableW * f));
}

export function metricsTableRowCells(row: ChartMetricsTableRow): [string, string, string, string] {
  return [row.label, row.spend, row.results, row.cpr];
}

export function metricsTableRowFill(
  row: ChartMetricsTableRow,
  index: number,
  colors: MetricsTableColors,
): string {
  if (row.kind === "header") return colors.headerBg;
  if (row.kind === "total") return colors.rowAltBg;
  if (row.kind === "footnote") return colors.rowBg;
  return index % 2 === 0 ? colors.rowBg : colors.rowAltBg;
}

export function metricsTableRowWeight(row: ChartMetricsTableRow): boolean {
  return row.kind === "header" || row.kind === "total";
}

export function metricsTableTextColor(row: ChartMetricsTableRow, colors: MetricsTableColors): string {
  if (row.kind === "header") return colors.accent;
  if (row.kind === "footnote") return colors.inkMuted;
  return colors.ink;
}

export function metricsTableAlign(col: number): "l" | "r" {
  return col === 0 ? "l" : "r";
}

export function metricsTableFontSize(table: ChartMetricsTable, row: ChartMetricsTableRow): number {
  if (row.kind === "header") return table.layout.headerFontSize;
  if (row.kind === "footnote") return Math.max(9, table.layout.bodyFontSize - 1);
  return table.layout.bodyFontSize;
}

export function metricsTableTotalHeight(table: ChartMetricsTable): number {
  return table.layout.rowHeights.reduce((sum, h) => sum + h, 0);
}
