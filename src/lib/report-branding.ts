/** Client-facing report branding — hide or replace NextReport on shared reports. */

export type ReportBrandingMode = "nextreport" | "agency" | "hidden";

export interface ReportBrandingSettings {
  mode: ReportBrandingMode;
  agencyName: string | null;
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
}): ReportBrandingSettings {
  const mode = normalizeReportBrandingMode(user.reportBrandingMode);
  const agencyName = user.agencyName?.trim() || null;
  if (mode === "agency" && !agencyName) {
    return { mode: "hidden", agencyName: null };
  }
  return { mode, agencyName };
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

export const REPORT_BRANDING_MODE_LABELS: Record<
  ReportBrandingMode,
  { title: string; description: string }
> = {
  nextreport: {
    title: "Show NextReport",
    description: "Shared reports include NextReport in the header and footer (default).",
  },
  agency: {
    title: "Show my agency name",
    description: "Replace NextReport with your agency name on shared reports and client emails.",
  },
  hidden: {
    title: "Hide third-party branding",
    description: "No NextReport name on shared reports — only your report content and date.",
  },
};

export const WHITE_LABEL_FEATURE = "White-label client reports (hide or replace NextReport branding)";
