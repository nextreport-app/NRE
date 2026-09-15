/**
 * TikTok Ads objective regression manifest — API metric resolution and CSV
 * Result type normalization. Add a row whenever a production bug is fixed.
 */

import type { TikTokApiMetrics } from "./tiktok-objective-dictionary";

export interface TikTokApiRegressionCase {
  id: string;
  description: string;
  metrics: TikTokApiMetrics;
  expectedResultType: string;
  expectedResultLabel: string;
}

export interface TikTokCsvRegressionCase {
  id: string;
  description: string;
  resultTypeCell: string;
  expectedResultType: string;
  expectedResultLabel: string;
}

export const TIKTOK_API_REGRESSION_CASES: readonly TikTokApiRegressionCase[] = [
  {
    id: "complete-payment",
    description: "Purchase optimization — complete payment metric",
    metrics: { complete_payment: "8", cost_per_complete_payment: "25.00", clicks: "200", reach: "10000" },
    expectedResultType: "Complete payment",
    expectedResultLabel: "PURCHASES",
  },
  {
    id: "form-submission",
    description: "Lead gen — form submission metric",
    metrics: { form_submission: "15", cost_per_form_submission: "8.50", clicks: "300", reach: "15000" },
    expectedResultType: "Form submission",
    expectedResultLabel: "LEADS",
  },
  {
    id: "conversions",
    description: "Generic conversion metric when no higher-priority signal",
    metrics: { conversion: "5", cost_per_conversion: "12.50", clicks: "100", reach: "5000" },
    expectedResultType: "Conversions",
    expectedResultLabel: "CONVERSIONS",
  },
  {
    id: "reach",
    description: "Reach optimization — low click ratio",
    metrics: { conversion: "0", reach: "10000", clicks: "50", spend: "200" },
    expectedResultType: "Reach",
    expectedResultLabel: "REACH",
  },
  {
    id: "link-clicks-fallback",
    description: "Traffic fallback when no conversion signal",
    metrics: { conversion: "0", reach: "1000", clicks: "500", cpc: "0.45" },
    expectedResultType: "Link clicks",
    expectedResultLabel: "LINK CLICKS",
  },
  {
    id: "video-views",
    description: "Video views optimization",
    metrics: {
      video_play_actions: "1200",
      cost_per_video_play: "0.08",
      conversion: "0",
      clicks: "50",
      reach: "8000",
    },
    expectedResultType: "Video views",
    expectedResultLabel: "VIDEO VIEWS",
  },
];

export const TIKTOK_CSV_REGRESSION_CASES: readonly TikTokCsvRegressionCase[] = [
  {
    id: "csv-complete-payment",
    description: "Manual CSV Complete payment cell",
    resultTypeCell: "complete payment",
    expectedResultType: "Complete payment",
    expectedResultLabel: "PURCHASES",
  },
  {
    id: "csv-form-submission",
    description: "Manual CSV form submission cell",
    resultTypeCell: "form submission",
    expectedResultType: "Form submission",
    expectedResultLabel: "LEADS",
  },
  {
    id: "csv-video-views",
    description: "Manual CSV video views cell",
    resultTypeCell: "video views",
    expectedResultType: "Video views",
    expectedResultLabel: "VIDEO VIEWS",
  },
  {
    id: "csv-reach",
    description: "Manual CSV reach cell",
    resultTypeCell: "reach",
    expectedResultType: "Reach",
    expectedResultLabel: "REACH",
  },
];
