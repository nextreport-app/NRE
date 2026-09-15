/**
 * Real-export regression manifest — every anonymized Meta CSV fixture and the
 * campaign objectives the engine must detect. Add a row here whenever a
 * production bug is fixed so it never regresses.
 */

export interface CampaignObjectiveExpectation {
  campaignName: string;
  resultLabel: string;
  /** When set, resolveCampaignObjectiveWithConfidence must meet this tier. */
  minConfidence?: "high" | "medium" | "low";
}

export interface MetaObjectiveRegressionFixture {
  id: string;
  file: string;
  description: string;
  campaigns: CampaignObjectiveExpectation[];
}

export const META_OBJECTIVE_REGRESSION_FIXTURES: readonly MetaObjectiveRegressionFixture[] = [
  {
    id: "mixed-objectives-messaging",
    file: "mixed-objectives-messaging.csv",
    description: "Mixed account: website TOF, instant forms, and messenger in one export",
    campaigns: [
      { campaignName: "Lead Campaign_ Website_TOF", resultLabel: "WEBSITE LEADS", minConfidence: "high" },
      { campaignName: "Lead Campaign_Messaging", resultLabel: "MESSAGING / CONVERSATIONS" },
      { campaignName: "Lead Campaign_ InstantForms", resultLabel: "META FORM LEADS" },
    ],
  },
  {
    id: "dc-credit-firm-leads",
    file: "dc-credit-firm-leads.csv",
    description: "Website submission result_type with blank-majority LPV mid-funnel rows",
    campaigns: [{ campaignName: "DC Leads Campaign Main", resultLabel: "WEBSITE LEADS", minConfidence: "high" }],
  },
  {
    id: "dc-purchase-campaign-cbo",
    file: "dc-purchase-campaign-cbo.csv",
    description: "Purchase-named CBO with add-to-cart data but zero purchases",
    campaigns: [
      { campaignName: "Purchase Campaign | CBO", resultLabel: "PURCHASES", minConfidence: "medium" },
      { campaignName: "Purchase Campaign | Remarketing", resultLabel: "PURCHASES" },
    ],
  },
];
