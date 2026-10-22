import type { BuildReportDataInput } from "./report-data";
import type { ResultLabels } from "./objective";

export type CprParityGoldenCase = {
  id: string;
  fixture: string;
  build: Omit<BuildReportDataInput, "mtdDailyRows">;
  /** When set, assert this objective column on MTD (single-campaign fixtures). */
  mtdResultLabel?: string;
  /** When set, only check this campaign on slides/chart. */
  campaignFilter?: string;
  campaignObjectives?: Record<string, ResultLabels>;
};

export const CPR_PARITY_GOLDEN_CASES: CprParityGoldenCase[] = [
  {
    id: "dc-leads-campaigns-table-weekly",
    fixture: "dc-leads-campaigns-table-oct2026.csv",
    build: {
      accountName: "DC",
      currencySymbol: "$",
      timezone: "America/New_York",
      monthlyBudget: 500,
      selectedCampaigns: ["DC Leads Campaign Main"],
      weeklyRange: { startIso: "2026-10-14", endIso: "2026-10-20" },
      reportType: "WEEKLY",
      now: new Date("2026-10-21T12:00:00Z"),
    },
    mtdResultLabel: "WEBSITE LEADS",
    campaignFilter: "DC Leads Campaign Main",
    campaignObjectives: {
      "DC Leads Campaign Main": {
        resultLabel: "WEBSITE LEADS",
        costLabel: "COST PER WEBSITE LEAD",
      },
    },
  },
  {
    id: "mentee-ascend-applications-offdays",
    fixture: "mentee-ascend-week-oct14-20.csv",
    build: {
      accountName: "Mentee",
      currencySymbol: "$",
      timezone: "America/Chicago",
      monthlyBudget: null,
      selectedCampaigns: ["Ascend Mastermind | Website Leads | Baton Rouge"],
      weeklyRange: { startIso: "2026-10-14", endIso: "2026-10-20" },
      reportType: "WEEKLY",
      now: new Date("2026-10-21T12:00:00Z"),
    },
    mtdResultLabel: "WEBSITE SUBMIT APPLICATIONS",
    campaignFilter: "Ascend Mastermind | Website Leads | Baton Rouge",
    campaignObjectives: {
      "Ascend Mastermind | Website Leads | Baton Rouge": {
        resultLabel: "WEBSITE SUBMIT APPLICATIONS",
        costLabel: "COST PER APPLICATION",
      },
    },
  },
  {
    id: "gz-australia-meta-form-leads-mtd",
    fixture: "gz-australia-lead-forms.csv",
    build: {
      accountName: "GZ Australia",
      currencySymbol: "A$",
      timezone: "UTC",
      monthlyBudget: null,
      now: new Date("2026-09-17T12:00:00Z"),
      reportType: "MONTHLY",
    },
    mtdResultLabel: "META FORM LEADS",
  },
];
