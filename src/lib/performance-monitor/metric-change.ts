export type MetricDirection = "higher" | "lower" | "neutral";
/** Display direction is independent of the evidence thresholds used for alerts. */
export function metricChange(
  current: number | null | undefined,
  previous: number | null | undefined,
  direction: MetricDirection,
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
  if (Math.abs(change) < 0.05) return { label: "No change", tone: neutral };
  return {
    label: `${change > 0 ? "+" : "−"}${Math.abs(change).toLocaleString("en-US", { maximumFractionDigits: 1 })}%`,
    tone:
      !fresh || direction === "neutral"
        ? neutral
        : change > 0 === (direction === "higher")
          ? ("positive" as const)
          : ("negative" as const),
  };
}
