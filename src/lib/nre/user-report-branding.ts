import { buildReportBrandingSettings, type ReportBrandingSettings } from "@/lib/report-branding";
import type { ShareReportExtras } from "./share-report";

export const USER_REPORT_BRANDING_SELECT = {
  agencyName: true,
  agencyLogoUrl: true,
  reportBrandingMode: true,
  showAgencyNameOnCover: true,
} as const;

export type UserReportBrandingRow = {
  agencyName: string | null;
  agencyLogoUrl: string | null;
  reportBrandingMode: string;
  showAgencyNameOnCover: boolean;
};

/** PPTX cover "Prepared by" line — independent of share-link white-label mode. */
export function agencyNameForCoverSlide(user: {
  agencyName?: string | null;
  showAgencyNameOnCover?: boolean | null;
}): string | null {
  if (user.showAgencyNameOnCover === false) return null;
  const name = user.agencyName?.trim();
  return name || null;
}

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
