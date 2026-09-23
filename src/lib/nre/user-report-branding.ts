import { buildReportBrandingSettings, type ReportBrandingSettings } from "@/lib/report-branding";
import type { ShareReportExtras } from "./share-report";

export const USER_REPORT_BRANDING_SELECT = {
  agencyName: true,
  agencyLogoUrl: true,
  reportBrandingMode: true,
} as const;

export type UserReportBrandingRow = {
  agencyName: string | null;
  agencyLogoUrl: string | null;
  reportBrandingMode: string;
};

export function shareReportExtrasFromUser(
  user: UserReportBrandingRow | null | undefined,
  currencySymbol?: string,
): ShareReportExtras {
  const reportBranding: ReportBrandingSettings = buildReportBrandingSettings({
    reportBrandingMode: user?.reportBrandingMode,
    agencyName: user?.agencyName,
    agencyLogoUrl: user?.agencyLogoUrl,
  });
  return {
    currencySymbol,
    agencyName: user?.agencyName ?? null,
    reportBranding,
  };
}
