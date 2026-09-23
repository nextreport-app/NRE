import type { ComparisonReportData } from "./report-data";
import type { Platform } from "./google-columns";
import type { ReportBrandingSettings } from "@/lib/report-branding";

export interface ShareComparisonReportData extends ComparisonReportData {
  version: 1;
  kind: "comparison";
  platform: Platform;
  generatedAt: string;
  reportBranding?: ReportBrandingSettings;
  agencyName?: string | null;
}

export function isShareComparisonReportData(value: unknown): value is ShareComparisonReportData {
  if (!value || typeof value !== "object") return false;
  const record = value as ShareComparisonReportData;
  return record.version === 1 && record.kind === "comparison" && Array.isArray(record.campaigns);
}

export function buildShareComparisonReportData(
  comparison: ComparisonReportData,
  platform: Platform,
  extras: { reportBranding?: ReportBrandingSettings; agencyName?: string | null },
): ShareComparisonReportData {
  return {
    ...comparison,
    version: 1,
    kind: "comparison",
    platform,
    generatedAt: new Date().toISOString(),
    reportBranding: extras.reportBranding,
    agencyName: extras.agencyName ?? null,
  };
}
