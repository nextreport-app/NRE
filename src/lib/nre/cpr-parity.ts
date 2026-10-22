import { parseCellNum } from "./format";
import type { CampaignSlideData, ReportData, TableRowData } from "./report-data";

/** Currency-formatted CPR on slides/tables may omit decimals — allow ~2% or $0.05. */
export const CPR_PARITY_ABS_TOLERANCE = 0.05;
export const CPR_PARITY_REL_TOLERANCE = 0.02;

export function parseCprFromDisplay(display: string): number {
  return parseCellNum(display.replace(/[^0-9.-]/g, ""));
}

export function impliedCpr(spend: number, results: number): number {
  if (results <= 0 || spend <= 0) return 0;
  return spend / results;
}

export function cprCloseEnough(actual: number, expected: number): boolean {
  if (expected <= 0 && actual <= 0) return true;
  if (expected <= 0 || actual <= 0) return false;
  const diff = Math.abs(actual - expected);
  if (diff <= CPR_PARITY_ABS_TOLERANCE) return true;
  return diff / expected <= CPR_PARITY_REL_TOLERANCE;
}

/** Campaign slides must show CPR = Amount spent ÷ Results on the same slide (the recurring CPL bug). */
export function assertCampaignSlideCprParity(slide: CampaignSlideData): void {
  const spend = parseCellNum(slide.metrics.spend);
  const results = parseCellNum(slide.metrics.results);
  const cpr = parseCprFromDisplay(slide.metrics.cpr);
  if (results <= 0) return;
  if (slide.resultLabel === "REACH") return;
  const expected = impliedCpr(spend, results);
  if (!cprCloseEnough(cpr, expected)) {
    throw new Error(
      `${slide.campaignName}: ${slide.costLabel} ${slide.metrics.cpr} ≠ spend ÷ results (${spend}/${results} ≈ ${expected.toFixed(2)})`,
    );
  }
}

export function assertMtdResultColumnCprParity(
  mtdRow: TableRowData,
  resultLabel: string,
  spendBasis?: number,
): void {
  const col = mtdRow.resultColumns.find((c) => c.label === resultLabel);
  if (!col) return;
  const results = parseCellNum(col.value);
  if (results <= 0) return;
  if (resultLabel === "REACH") return;
  const spend = spendBasis ?? parseCellNum(mtdRow.spend);
  const cpr = parseCprFromDisplay(col.cprValue);
  const expected = impliedCpr(spend, results);
  if (!cprCloseEnough(cpr, expected)) {
    throw new Error(
      `MTD ${resultLabel}: ${col.cprValue} ≠ spend ÷ results (${spend}/${results} ≈ ${expected.toFixed(2)})`,
    );
  }
}

/** Last-30 chart campaign bars: CPR must match bar spend ÷ bar results. */
export function assertChartCampaignCprParity(report: ReportData, campaignName?: string): void {
  const chart = report.chart;
  if (!chart) return;
  for (const bar of chart.campaigns) {
    if (campaignName && bar.name !== campaignName) continue;
    if (bar.results <= 0) continue;
    if (bar.resLabel === "REACH") continue;
    const expected = impliedCpr(bar.spend, bar.results);
    if (!cprCloseEnough(bar.cpr, expected)) {
      throw new Error(
        `Chart ${bar.name}: CPR ${bar.cpr} ≠ spend ÷ results (${bar.spend}/${bar.results} ≈ ${expected.toFixed(2)})`,
      );
    }
  }
}
