import { previousCompleteMonth } from "../nre/report-period-selection";
import type { DateSelection } from "../validators/report-wizard";
import { normalizeCampaignName } from "../nre/objective";
import { z } from "zod";
import {
  selectedAdSetsSchema,
  selectedMetricsSchema,
  campaignObjectivesSchema,
  campaignMetricOverridesSchema,
} from "../validators/report-wizard";
/** The same explicit choices sent by the report wizard, frozen per automation. */
export const scheduledWizardOptionsSchema = z
  .object({
    selectedAdSets: selectedAdSetsSchema.max(500).default([]),
    selectedMetrics: selectedMetricsSchema.optional(),
    campaignObjectives: campaignObjectivesSchema.optional(),
    campaignMetricOverrides: campaignMetricOverridesSchema.optional(),
    csvAlignResults: z.boolean().default(false),
  })
  .strict();
export type ScheduledWizardOptions = z.infer<
  typeof scheduledWizardOptionsSchema
>;
export interface AutomationReportConfiguration {
  campaignNames: string[];
  showBudget: boolean;
  wizardOptions: ScheduledWizardOptions;
}
export function applyScheduledWizardOptions(
  form: FormData,
  options: ScheduledWizardOptions | undefined,
) {
  if (!options) {
    form.set("selectedAdSets", "[]");
    return;
  }
  for (const key of [
    "selectedAdSets",
    "selectedMetrics",
    "campaignObjectives",
    "campaignMetricOverrides",
    "csvAlignResults",
  ] as const) {
    if (options[key] !== undefined) form.set(key, JSON.stringify(options[key]));
  }
}

export function hasCompleteAutomationConfiguration(config: {
  campaignNames: string[];
  wizardOptions?: ScheduledWizardOptions;
}) {
  const options = config.wizardOptions;
  return (
    !!options?.selectedMetrics?.length &&
    config.campaignNames.length > 0 &&
    config.campaignNames.every((name) => {
      const key = normalizeCampaignName(name);
      return (
        !!options.campaignObjectives?.[key] &&
        !!options.campaignMetricOverrides?.[key]?.length
      );
    })
  );
}

export function automationSampleDateSelection(
  cadence: "WEEKLY" | "MONTHLY",
  now: Date,
  timezone: string,
): DateSelection {
  return cadence === "MONTHLY"
    ? {
        mode: "custom",
        customStart: previousCompleteMonth(now, timezone).startIso,
        customEnd: previousCompleteMonth(now, timezone).endIso,
      }
    : { mode: "last7" };
}
