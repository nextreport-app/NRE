export const DAILY_BASE_METRIC_KEYS = ["spend", "reach", "impressions", "ctr", "cpc_all", "objective_results", "objective_cost"] as const;
export const DAILY_BASE_METRICS = DAILY_BASE_METRIC_KEYS.map((key, index) => ({ key, label: ["Ad spend", "Reach", "Impressions", "CTR (All)", "CPC (All)", "Objective-specific results", "Cost per result"][index] }));
export type DailyObjectiveLabels = { resultLabel: string; costLabel: string };
export function dailyObjectiveMetricKey(kind: "objective_results" | "objective_cost", resultLabel: string): string {
  return `${kind}:${encodeURIComponent(resultLabel.trim().toUpperCase().replace(/\s+/g, " "))}`;
}
/** Use the exact campaign-confirmed labels already used by Weekly and Monthly. */
export function dailyBaseMetrics(objectives: readonly DailyObjectiveLabels[]) {
  const unique = new Map<string, DailyObjectiveLabels>();
  for (const objective of objectives) if (objective.resultLabel?.trim()) unique.set(objective.resultLabel.trim().toUpperCase(), objective);
  return [...DAILY_BASE_METRICS.slice(0,5), ...(unique.size ? [...unique.values()].flatMap(objective => [
    { key: dailyObjectiveMetricKey("objective_results", objective.resultLabel), label: objective.resultLabel },
    { key: dailyObjectiveMetricKey("objective_cost", objective.resultLabel), label: objective.costLabel },
  ]) : [{ key: "objective_results", label: "Results" }, { key: "objective_cost", label: "Cost per result" }])];
}
export function dailyMetricIsExcluded(key: string, excluded: readonly string[] = []) {
  return excluded.includes(key) || (key.startsWith("objective_results:") && excluded.includes("objective_results")) || (key.startsWith("objective_cost:") && excluded.includes("objective_cost"));
}
/** Expand old group selections so restoring one objective does not restore every objective. */
export function expandDailyExclusions(excluded: readonly string[], metrics: readonly {key:string}[]) {
  return [...new Set(excluded.flatMap(key => key === "objective_results" || key === "objective_cost" ? metrics.filter(metric => metric.key === key || metric.key.startsWith(`${key}:`)).map(metric => metric.key) : [key]))];
}
type ObjectiveColumn = { label: string; costLabel: string };
/** Date stays visible. Result/cost choices are independent for each objective. */
export function dailyHiddenColumns(columns: number | readonly ObjectiveColumn[], excluded: readonly string[] = []): number[] {
  const hidden = new Set<number>();
  DAILY_BASE_METRIC_KEYS.slice(0,5).forEach((key,index) => { if (excluded.includes(key)) hidden.add(index+1); });
  const count = typeof columns === "number" ? columns : columns.length;
  for (let index=0;index<count;index++) {
    const label = typeof columns === "number" ? undefined : columns[index].label;
    if (excluded.includes("objective_results") || (label && dailyMetricIsExcluded(dailyObjectiveMetricKey("objective_results",label),excluded))) hidden.add(6+index*2);
    if (excluded.includes("objective_cost") || (label && dailyMetricIsExcluded(dailyObjectiveMetricKey("objective_cost",label),excluded))) hidden.add(7+index*2);
  }
  return [...hidden];
}
export function projectDailyGrid(grid: string[][], columns: number | readonly ObjectiveColumn[], excluded: readonly string[] = []) {
  const actualColumns = typeof columns === "number" ? Array.from({length:columns},(_,index)=>({label:grid[0]?.[6+index*2] ?? "",costLabel:grid[0]?.[7+index*2] ?? ""})) : columns;
  const hidden = new Set(dailyHiddenColumns(actualColumns,excluded));
  return grid.map((row, rowIndex)=>row.filter((_,index)=>!hidden.has(index)).map((cell,index)=>rowIndex === 0 && index === 0 ? "Date" : cell));
}
