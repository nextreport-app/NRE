import { it, expect } from "vitest";
import {
  automationSampleDateSelection,
  hasCompleteAutomationConfiguration,
  applyScheduledWizardOptions,
  scheduledWizardOptionsSchema,
} from "../wizard-options";
it("uses last month for monthly setup even when today's date is inside the current month", () => {
  expect(
    automationSampleDateSelection(
      "MONTHLY",
      new Date("2026-11-28T12:00Z"),
      "UTC",
    ),
  ).toEqual({
    mode: "custom",
    customStart: "2026-10-01",
    customEnd: "2026-10-31",
  });
  expect(
    automationSampleDateSelection(
      "MONTHLY",
      new Date("2027-01-01T00:15Z"),
      "America/Los_Angeles",
    ),
  ).toEqual({
    mode: "custom",
    customStart: "2026-11-01",
    customEnd: "2026-11-30",
  });
  expect(automationSampleDateSelection("WEEKLY", new Date(), "UTC")).toEqual({
    mode: "last7",
  });
});
it("requires objectives and metrics for every selected campaign, not a generic successful sample", () => {
  const wizardOptions = scheduledWizardOptionsSchema.parse({
    selectedMetrics: [
      {
        key: "spend",
        label: "Spend",
        format: "currency",
        csvName: "Amount spent",
      },
    ],
    campaignObjectives: {
      campaign: { resultLabel: "LEADS", costLabel: "Cost per lead" },
    },
    campaignMetricOverrides: { campaign: ["spend"] },
  });
  expect(
    hasCompleteAutomationConfiguration({
      campaignNames: ["Campaign"],
      wizardOptions,
    }),
  ).toBe(true);
  expect(
    hasCompleteAutomationConfiguration({
      campaignNames: ["Campaign", "Other campaign"],
      wizardOptions,
    }),
  ).toBe(false);
  expect(
    hasCompleteAutomationConfiguration({ campaignNames: ["Campaign"] }),
  ).toBe(false);
  const form = new FormData();
  applyScheduledWizardOptions(form, wizardOptions);
  expect(form.get("csvAlignResults")).toBe("false");
  expect(form.get("selectedAdSets")).toBe("[]");
});
