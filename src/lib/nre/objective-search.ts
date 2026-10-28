import { META_OBJECTIVE_SPECS, type ObjectiveInfo } from "./meta-objective-dictionary";
import { allMetaCampaignObjectiveMatrixRows, objectiveKeyFromMatrixRow } from "./meta-campaign-objective-matrix";

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}
const terms = new Map<string, string[]>();
for (const spec of META_OBJECTIVE_SPECS) terms.set(spec.key, [spec.canonicalText, ...spec.aliases]);
for (const row of allMetaCampaignObjectiveMatrixRows()) {
  const key = objectiveKeyFromMatrixRow(row);
  if (key) terms.set(key, [...(terms.get(key) ?? []), row.campaignObjective, row.conversionLocation ?? "", row.performanceGoal, row.conversionEvent ?? ""]);
}
const searchIndex = new Map([...terms].map(([key, values]) => [key, normalize(values.join(" "))]));

/** Search display names, CSV aliases and the owner's Meta goal/event matrix. */
export function filterObjectiveOptions(options: readonly ObjectiveInfo[], query: string): ObjectiveInfo[] {
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  return options.filter(option => {
    const text = `${normalize(`${option.key} ${option.resultLabel} ${option.costLabel}`)} ${searchIndex.get(option.key) ?? ""}`;
    return tokens.every(token => text.includes(token));
  });
}
