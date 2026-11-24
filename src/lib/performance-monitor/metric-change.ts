import { comparisonTone } from "../nre/comparison-presentation";
/** Use the same metric semantics as comparison reports, independent of alert severity. */
export function metricChange(
  current: number | null | undefined,
  previous: number | null | undefined,
  key: string,
  label: string,
  fresh = true,
) {
  const neutral = "neutral" as const;
  if (
    current == null ||
    previous == null ||
    !Number.isFinite(current) ||
    !Number.isFinite(previous)
  )
    return { label: "Unavailable", tone: neutral };
  if (previous === 0)
    return {
      label: current === 0 ? "No change" : "New · no baseline",
      tone: neutral,
    };
  const change = (current / previous - 1) * 100;
  if (change === 0) return { label: "No change", tone: neutral };
  return {
    label: `${change > 0 ? "+" : "−"}${Math.abs(change) < 0.1 ? "<0.1" : Math.abs(change).toLocaleString("en-US", { maximumFractionDigits: 1 })}%`,
    tone: fresh ? comparisonTone(key, label, change) : neutral,
  };
}
