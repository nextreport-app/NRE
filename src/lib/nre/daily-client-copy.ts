import type { DailySummaryMetric } from "./daily-report-presentation";
import type { TableRowData } from "./report-data";
import { parseCellNum } from "./format";

const available = (value: string | undefined): value is string =>
  Boolean(value && /\d/.test(value));
const sentenceList = (sentences: string[], limit: number) => {
  let result = "";
  for (const sentence of sentences) {
    if (result.length + sentence.length + 1 <= limit)
      result += `${result ? " " : ""}${sentence}`;
  }
  return result;
};

/** Factual, client-facing copy shared by PPT and live reports; no unsupported comparisons. */
export function dailyClientCopy(
  metrics: DailySummaryMetric[],
  days: TableRowData[],
) {
  const byKey = new Map(metrics.map((metric) => [metric.key, metric]));
  const spend = byKey.get("spend")?.value;
  const goals = metrics.filter(
    (metric) =>
      metric.key.startsWith("objective_results:") && available(metric.value),
  );
  const results = goals.map((metric) => {
    const cost = byKey.get(
      metric.key.replace("objective_results:", "objective_cost:"),
    );
    return `${metric.value} ${metric.label.toLowerCase()}${cost && available(cost.value) ? ` at ${cost.value} ${cost.label.toLowerCase().replace(/^cost /, "")}` : ""}`;
  });
  const sentences: string[] = [];
  if (results.length === 1)
    sentences.push(
      `Your campaigns ${available(spend) ? `spent ${spend} and ` : ""}generated ${results[0]} during this period.`,
    );
  else {
    if (available(spend))
      sentences.push(`Your campaigns spent ${spend} during this period.`);
    results.forEach((result) => sentences.push(`Results included ${result}.`));
  }
  const ctr = byKey.get("ctr")?.value,
    cpc = byKey.get("cpc_all")?.value;
  const rates = [
    available(ctr) ? `a click-through rate (CTR) of ${ctr}` : "",
    available(cpc) ? `an average cost per click (CPC) of ${cpc}` : "",
  ].filter(Boolean);
  const impressions = byKey.get("impressions")?.value;
  // Keep efficiency figures before optional delivery context within the template's copy limit.
  const rateSentence = rates.length
    ? `Ads achieved ${rates.join(" and ")}.`
    : "";
  const summary = sentenceList(
    [
      sentences[0] ?? "",
      rateSentence,
      ...sentences.slice(1),
      available(impressions) ? `Ads received ${impressions} impressions.` : "",
    ].filter(Boolean),
    300,
  );
  const insights: string[] = [];
  for (const goal of goals.slice(0, 2)) {
    const observations = days
      .filter((day) => day.hasData)
      .map((day) => ({
        day,
        value: day.resultColumns.find((column) => column.label === goal.label)
          ?.value,
      }))
      .filter((item): item is { day: TableRowData; value: string } =>
        available(item.value),
      );
    if (!observations.length) continue;
    const peak = Math.max(
      0,
      ...observations.map((item) => parseCellNum(item.value)),
    );
    if (peak > 0) {
      const top = observations.filter(
        (item) => parseCellNum(item.value) === peak,
      );
      insights.push(
        `Daily ${goal.label.toLowerCase()} peaked at ${top[0].value}${top.length > 1 ? ` on ${top.length} days, including` : " on"} ${top[0].day.monthLabel}.`,
      );
    } else
      insights.push(
        `No ${goal.label.toLowerCase()} were recorded during this period.`,
      );
  }
  const reach = byKey.get("reach");
  if (reach && available(reach.value) && reach.label.includes("(EST.)")) insights.push("Reach is an estimate of the people reached during this period.");
  const missing = metrics
    .filter(
      (metric) =>
        !available(metric.value) && ["reach", "frequency"].includes(metric.key),
    )
    .map((metric) => metric.label.toLowerCase());
  if (missing.length)
    insights.push(
      `Total ${missing.join(" and ")} ${missing.length > 1 ? "are" : "is"} unavailable for this period.`,
    );
  if (!insights.length)
    insights.push(
      "The figures shown cover your selected campaigns and reporting dates.",
    );
  return {
    summary:
      summary || "Performance for your selected campaigns during this period.",
    insights: sentenceList(insights, 400),
  };
}
