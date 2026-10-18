/** Client-facing report branding — hide or replace NextReport on shared reports. */

export type ReportBrandingMode = "nextreport" | "agency" | "hidden";

export interface ReportBrandingSettings {
  mode: ReportBrandingMode;
  agencyName: string | null;
  /** Private blob URL snapshotted at generation — served via /api/r/[token]/agency-logo. */
  agencyLogoUrl?: string | null;
}

export interface ShareBrandingDisplay {
  showNextReportLogo: boolean;
  headerTitle: string | null;
  showPoweredBy: boolean;
  footerPrimary: string | null;
  showGeneratedDate: boolean;
}

export function normalizeReportBrandingMode(value: unknown): ReportBrandingMode {
  if (value === "agency" || value === "hidden") return value;
  return "nextreport";
}

/** Resolve branding from account settings — agency mode without a name falls back to hidden. */
export function buildReportBrandingSettings(user: {
  reportBrandingMode?: string | null;
  agencyName?: string | null;
  agencyLogoUrl?: string | null;
}): ReportBrandingSettings {
  const mode = normalizeReportBrandingMode(user.reportBrandingMode);
  const agencyName = user.agencyName?.trim() || null;
  const agencyLogoUrl = user.agencyLogoUrl?.trim() || null;
  if (mode === "agency" && !agencyName) {
    return { mode: "hidden", agencyName: null, agencyLogoUrl: null };
  }
  return {
    mode,
    agencyName,
    agencyLogoUrl: mode === "agency" ? agencyLogoUrl : null,
  };
}

/** Read branding snapshotted in summaryJson, or fall back to legacy NextReport default. */
export function reportBrandingFromShareJson(value: unknown): ReportBrandingSettings {
  if (!value || typeof value !== "object") {
    return { mode: "nextreport", agencyName: null };
  }
  const record = value as { reportBranding?: ReportBrandingSettings; agencyName?: string | null };
  if (record.reportBranding) {
    return buildReportBrandingSettings({
      reportBrandingMode: record.reportBranding.mode,
      agencyName: record.reportBranding.agencyName ?? record.agencyName,
      agencyLogoUrl: record.reportBranding.agencyLogoUrl,
    });
  }
  return { mode: "nextreport", agencyName: record.agencyName?.trim() || null };
}

export function resolveShareBrandingDisplay(
  branding: ReportBrandingSettings,
): ShareBrandingDisplay {
  switch (branding.mode) {
    case "agency":
      return {
        showNextReportLogo: false,
        headerTitle: branding.agencyName,
        showPoweredBy: false,
        footerPrimary: branding.agencyName ? `Report prepared by ${branding.agencyName}` : null,
        showGeneratedDate: true,
      };
    case "hidden":
      return {
        showNextReportLogo: false,
        headerTitle: null,
        showPoweredBy: false,
        footerPrimary: null,
        showGeneratedDate: true,
      };
    default:
      return {
        showNextReportLogo: true,
        headerTitle: "NextReport",
        showPoweredBy: true,
        footerPrimary: "This report was generated using NextReport · nextreport.in",
        showGeneratedDate: true,
      };
  }
}

export function emailBrandingHeader(branding: ReportBrandingSettings): {
  showNextReportWordmark: boolean;
  subtitle: string;
} {
  if (branding.mode === "agency" && branding.agencyName) {
    return { showNextReportWordmark: false, subtitle: branding.agencyName };
  }
  if (branding.mode === "hidden") {
    return { showNextReportWordmark: false, subtitle: "Performance Report" };
  }
  return { showNextReportWordmark: true, subtitle: "Performance Report" };
}

export function emailGeneratedByLine(
  branding: ReportBrandingSettings,
  senderName: string,
): string {
  if (branding.mode === "nextreport") return `${senderName} via NextReport`;
  return senderName;
}

export function emailFooterPrimary(
  branding: ReportBrandingSettings,
  senderName: string,
  agencyName?: string | null,
): string | null {
  const name = agencyName?.trim() || senderName;
  switch (branding.mode) {
    case "agency":
      return `This report was prepared by ${name}`;
    case "hidden":
      return null;
    default:
      return `This report was prepared by ${name} using NextReport`;
  }
}

export function emailFooterSiteLine(branding: ReportBrandingSettings): string | null {
  if (branding.mode === "nextreport") return "nextreport.in";
  return null;
}

/** Browser tab / OG title suffix for shared report pages. */
export function sharePageTitleSuffix(branding: ReportBrandingSettings): string {
  if (branding.mode === "agency" && branding.agencyName) return branding.agencyName;
  if (branding.mode === "hidden") return "Report";
  return "NextReport";
}

/** Where a single branding choice applies (same deck file is used for PPTX and typical Slides upload). */
export const REPORT_BRANDING_SURFACES =
  "PowerPoint download, Google Slides export, live share link, and client emails";

export const REPORT_BRANDING_MODE_LABELS: Record<
  ReportBrandingMode,
  { title: string; description: string }
> = {
  nextreport: {
    title: "NextReport (default)",
    description: `“Prepared by NextReport” on the cover and NextReport on the ${REPORT_BRANDING_SURFACES}.`,
  },
  agency: {
    title: "Show my or agency name",
    description: `Your name on the cover (“Prepared by …”), your logo and name on the ${REPORT_BRANDING_SURFACES}.`,
  },
  hidden: {
    title: "Hide — don't show any name",
    description: `No “Prepared by” line and no NextReport or agency name on the ${REPORT_BRANDING_SURFACES}.`,
  },
};

/** Branding choices on Account settings — one applies everywhere. */
export const ACCOUNT_REPORT_BRANDING_MODES = ["nextreport", "agency", "hidden"] as const satisfies readonly ReportBrandingMode[];

/**
 * Name used after “Prepared by” on the deck cover — driven by the same mode as share/email branding.
 */
export function reportCreditName(input: {
  reportBrandingMode?: string | null;
  agencyName?: string | null;
}): string | null {
  const mode = normalizeReportBrandingMode(input.reportBrandingMode);
  if (mode === "hidden") return null;
  if (mode === "nextreport") return "NextReport";
  return input.agencyName?.trim() || null;
}

export const WHITE_LABEL_FEATURE =
  "White-label reports — hide or replace NextReport branding";
