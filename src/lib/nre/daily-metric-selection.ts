export const DAILY_BASE_METRIC_KEYS = ["spend", "reach", "impressions", "ctr", "cpc_all", "objective_results", "objective_cost"] as const;
export const DAILY_BASE_METRICS = DAILY_BASE_METRIC_KEYS.map((key, index) => ({ key, label: ["Ad spend", "Reach", "Impressions", "CTR (All)", "CPC (All)", "Objective-specific results", "Cost per result"][index] }));
/** Date stays visible. Result/cost choices apply independently to every objective. */
export function dailyHiddenColumns(objectiveCount: number, excluded: readonly string[] = []): number[] {
  const hidden = new Set<number>();
  DAILY_BASE_METRIC_KEYS.slice(0,5).forEach((key,index) => { if (excluded.includes(key)) hidden.add(index+1); });
  for (let index=0;index<objectiveCount;index++) {
    if (excluded.includes("objective_results")) hidden.add(6+index*2);
    if (excluded.includes("objective_cost")) hidden.add(7+index*2);
  }
  return [...hidden];
}
export function projectDailyGrid(grid: string[][], objectiveCount: number, excluded: readonly string[] = []) {
  const hidden = new Set(dailyHiddenColumns(objectiveCount,excluded));
  return grid.map((row, rowIndex)=>row.filter((_,index)=>!hidden.has(index)).map((cell,index)=>rowIndex === 0 && index === 0 ? "Date" : cell));
}
