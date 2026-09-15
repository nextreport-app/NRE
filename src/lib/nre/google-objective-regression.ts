/**
 * Google Ads header → campaign-type regression manifest.
 * Each entry is a real export header pattern the engine must classify correctly.
 */

import type { GoogleObjectiveKey } from "./google-objective-dictionary";

export interface GoogleObjectiveRegressionCase {
  id: string;
  description: string;
  headers: readonly string[];
  expectedKey: GoogleObjectiveKey;
  expectedResultLabel: string;
}

export const GOOGLE_OBJECTIVE_REGRESSION_CASES: readonly GoogleObjectiveRegressionCase[] = [
  {
    id: "shopping",
    description: "Shopping export with orders and conv. value columns",
    headers: ["Campaign", "Orders", "Conv. value / cost", "Units sold"],
    expectedKey: "shopping",
    expectedResultLabel: "CONV. VALUE",
  },
  {
    id: "video",
    description: "TrueView video campaign export",
    headers: ["Campaign", "TrueView views", "TrueView avg. CPV", "Video views"],
    expectedKey: "video",
    expectedResultLabel: "VIDEO VIEWS",
  },
  {
    id: "demand_gen",
    description: "Demand Gen engagement columns",
    headers: ["Campaign", "Engagements", "Engagement rate", "Avg. CPE"],
    expectedKey: "demand_gen",
    expectedResultLabel: "CONVERSIONS",
  },
  {
    id: "display",
    description: "Display viewability columns",
    headers: ["Campaign", "Viewable impr.", "Viewable rate", "Avg. viewable CPM"],
    expectedKey: "display",
    expectedResultLabel: "VIEWABLE IMPR.",
  },
  {
    id: "local",
    description: "Local store visit columns",
    headers: ["Campaign", "Store visits", "Cost per store visit"],
    expectedKey: "local",
    expectedResultLabel: "CONVERSIONS",
  },
  {
    id: "performance_max",
    description: "Performance Max asset group columns",
    headers: ["Campaign", "Asset group", "Listing group", "Conversions"],
    expectedKey: "performance_max",
    expectedResultLabel: "CONV. VALUE",
  },
  {
    id: "app",
    description: "App campaign avg. cost (not avg. cpc)",
    headers: ["Campaign", "Avg. cost", "Conversions", "Installs"],
    expectedKey: "app",
    expectedResultLabel: "CONVERSIONS",
  },
  {
    id: "leads",
    description: "Lead-form revenue columns (must not substring-match shopping gross profit)",
    headers: ["Campaign", "Lead revenue", "Conversions"],
    expectedKey: "leads",
    expectedResultLabel: "CONVERSIONS",
  },
  {
    id: "search-fallback",
    description: "Generic search export — default fallback",
    headers: ["Campaign", "Cost", "Clicks", "Impr.", "Avg. CPC"],
    expectedKey: "search",
    expectedResultLabel: "CONVERSIONS",
  },
];
