/** One definition of objective cost units, shared by numeric aggregation and verification. */
export function objectiveRateScale(label: string): number {
  return label === "REACH" || label === "IMPRESSIONS" ? 1000 : 1;
}

export function objectiveRate(spend: number, count: number, label: string): number | null {
  return count > 0 ? spend / count * objectiveRateScale(label) : null;
}
