import type { WebsiteMetric } from "@/lib/website-dashboard/model";
export function websiteMetricChange(
  key: WebsiteMetric,
  current: number | null | undefined,
  previous: number | null | undefined,
) {
  if (current == null || previous == null) return { label: "—", direction: 0 };
  const difference = current - previous;
  if (difference === 0) return { label: "No change", direction: 0 };
  const rate = key.endsWith("Rate");
  if (!rate && previous === 0) return { label: "From zero", direction: 0 };
  const delta = rate ? difference * 100 : (difference / previous) * 100;
  const amount =
    Math.abs(delta) < 0.1
      ? "<0.1"
      : new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(
          Math.abs(delta),
        );
  return {
    label: `${delta > 0 ? "+" : "−"}${amount}${rate ? " pp" : "%"}`,
    direction: difference * (key === "bounceRate" ? -1 : 1),
  };
}
export function WebsiteMetricChange({
  metric,
  current,
  previous,
  comparable = true,
}: {
  metric: WebsiteMetric;
  current: number | null | undefined;
  previous: number | null | undefined;
  comparable?: boolean;
}) {
  const change = websiteMetricChange(metric, current, previous);
  const color =
    !comparable || !change.direction
      ? "text-dash-ink-secondary"
      : change.direction > 0
        ? "text-emerald-400"
        : "text-red-400";
  return (
    <span
      className={`inline-flex rounded-full border border-current px-2 py-1 text-xs font-semibold ${color}`}
      title={
        metric === "bounceRate"
          ? "A lower bounce rate is shown in green; the sign is the actual numerical change."
          : metric.endsWith("Rate") ? "Percentage-point change compared with the previous period." : "Percent change compared with the previous period."
      }
    >
      {change.label}
    </span>
  );
}
