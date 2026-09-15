import type { WizardReportType } from "@/lib/validators/report-wizard";
import type { ReportData, ComparisonReportData } from "@/lib/nre/report-data";
import type { HistoricalReportData } from "@/lib/nre/historical-report-data";
import type { ValidationIssue } from "@/lib/nre/validate";
import type { SelectedMetric } from "@/lib/nre/available-metrics";
import type { ObjectiveInfo } from "@/lib/nre/result-type-map";
import type { AdSetGroup } from "@/lib/nre/ad-sets";
import type { CsvDateGuidance } from "@/lib/nre/csv-date-guidance";
import type { TEMPLATES } from "@/lib/validators/client";

export type Step = 1 | 2 | 3 | 4;

export type WizardPlatformChoice = "META" | "GOOGLE" | "TIKTOK" | "GA4";

export type AnalyzeStatus = "idle" | "loading" | "invalid" | "error";
export type PreviewStatus = "idle" | "loading" | "invalid" | "error";
export type GenerateStatus = "idle" | "loading" | "done" | "error";
export type DateMode = "last7" | "prev7" | "last14" | "custom";
export type ReportTypeValue = WizardReportType;
export type ComparisonPreset = "thisWeek" | "thisMonth" | "custom";
export type PreviewKind = "normal" | "comparison" | "historical";
export type DriveView = "collapsed" | "editing" | "success";

export interface RememberedDriveFolder {
  id: string;
  name: string;
}

export interface DateRangeIso {
  startIso: string;
  endIso: string;
}

export interface DateSelection {
  mode: DateMode;
  customStart?: string;
  customEnd?: string;
}

export type ApiSyncMeta = {
  previousMonthSynced?: boolean;
  hasPreviousMonthData?: boolean;
  previousMonthCampaigns?: string[];
  previousMonthSelectedCampaigns?: string[] | null;
  previousMonthUpdatedAt?: string | null;
};

export interface ReportUploadWizardProps {
  clientId: string;
  clientName: string;
  clientTimezone: string;
  currencySymbol: string;
  hasGoogleDriveConnected: boolean;
  initialLastDriveFolderId: string | null;
  initialLastDriveFolderName: string | null;
  hasPreviousMonthData: boolean;
  initialPreviousMonthDataUpdatedAt: string | null;
  initialPreviousMonthCampaigns?: string[];
  initialPreviousMonthSelectedCampaigns?: string[] | null;
  clientTemplate: (typeof TEMPLATES)[number];
  metaConnected?: boolean;
  metaConnectedName?: string | null;
  metaConfigured?: boolean;
  googleAdsConfigured?: boolean;
  googleAdsConnected?: boolean;
  tiktokConfigured?: boolean;
  tiktokConnected?: boolean;
  hasGa4Property?: boolean;
  ga4Connected?: boolean;
  showTikTokOption?: boolean;
  clientMonthlyBudget?: number | null;
  clientShowBudgetPacingOnCover?: boolean;
}

/** Overflow dialog when adding metrics beyond slide limits. */
export type MetricOverflowDialog = {
  campaignName: string;
  normalized: string;
  metric: SelectedMetric;
  mode: "confirm_second_slide" | "blocked_max";
};

/** Re-exported domain types used across step components. */
export type {
  ReportData,
  ComparisonReportData,
  HistoricalReportData,
  ValidationIssue,
  SelectedMetric,
  ObjectiveInfo,
  AdSetGroup,
  CsvDateGuidance,
};
