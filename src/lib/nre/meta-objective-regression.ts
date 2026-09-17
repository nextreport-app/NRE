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
  {
    id: "gz-australia-lead-forms",
    file: "gz-australia-lead-forms.csv",
    description:
      "Lead Forms account — zero-lead days carry LPV/link-click row labels; must stay META FORM LEADS (regressed after meta-objective-dictionary push)",
    campaigns: [
      {
        campaignName: "GZ Australia | Lead Forms | Top Funnel | A3HD",
        resultLabel: "META FORM LEADS",
        minConfidence: "high",
      },
    ],
  },
  {
    id: "meta-objective-families",
    file: "meta-objective-families.csv",
    description: "Synthetic corpus — one campaign per major Meta result_type family",
    campaigns: [
      { campaignName: "Reach Campaign", resultLabel: "REACH", minConfidence: "high" },
      { campaignName: "LPV Campaign", resultLabel: "LANDING PAGE VIEWS", minConfidence: "high" },
      { campaignName: "Link Clicks Campaign", resultLabel: "LINK CLICKS", minConfidence: "high" },
      { campaignName: "IC Campaign", resultLabel: "INITIATE CHECKOUT", minConfidence: "high" },
      { campaignName: "ATC Campaign", resultLabel: "ADD TO CART", minConfidence: "high" },
      { campaignName: "Phone Calls Campaign", resultLabel: "PHONE CALLS", minConfidence: "high" },
      { campaignName: "WhatsApp Campaign", resultLabel: "WHATSAPP LEADS", minConfidence: "high" },
      { campaignName: "Instagram DM Campaign", resultLabel: "INSTAGRAM DM LEADS", minConfidence: "high" },
      { campaignName: "Registration Campaign", resultLabel: "REGISTRATIONS", minConfidence: "high" },
      { campaignName: "App Install Campaign", resultLabel: "APP INSTALLS", minConfidence: "high" },
      { campaignName: "Video Views Campaign", resultLabel: "VIDEO VIEWS", minConfidence: "high" },
      { campaignName: "Impressions Campaign", resultLabel: "IMPRESSIONS", minConfidence: "high" },
      { campaignName: "Ad Recall Campaign", resultLabel: "AD RECALL LIFT", minConfidence: "high" },
      { campaignName: "Event Response Campaign", resultLabel: "EVENT RESPONSES", minConfidence: "high" },
      { campaignName: "Store Visit Campaign", resultLabel: "STORE VISITS", minConfidence: "high" },
    ],
  },
];
