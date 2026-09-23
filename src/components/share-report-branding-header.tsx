import type { ReportBrandingSettings, ShareBrandingDisplay } from "@/lib/report-branding";

export function ShareReportBrandingHeader({
  brandingDisplay,
  branding,
  shareToken,
  rightSlot,
}: {
  brandingDisplay: ShareBrandingDisplay;
  branding: ReportBrandingSettings;
  shareToken?: string;
  rightSlot?: React.ReactNode;
}) {
  const agencyLogoSrc =
    branding.agencyLogoUrl && shareToken ? `/api/r/${shareToken}/agency-logo` : null;

  return (
    <header
      className="sticky top-0 z-10 border-b border-navy-border px-3 py-2 sm:px-6 sm:py-0"
      style={{ backgroundColor: "#0d1b2e" }}
    >
      <div className="mx-auto flex max-w-[960px] items-center justify-between gap-2 sm:min-h-[56px] sm:gap-3">
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          {brandingDisplay.showNextReportLogo ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="NextReport logo" className="h-7 w-7 shrink-0 sm:h-9 sm:w-9" />
              <span
                className="truncate text-[17px] font-bold text-ink sm:text-[22px]"
                style={{ fontFamily: "var(--font-inter), sans-serif" }}
              >
                NextReport
              </span>
            </>
          ) : agencyLogoSrc ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={agencyLogoSrc}
                alt={brandingDisplay.headerTitle ? `${brandingDisplay.headerTitle} logo` : "Agency logo"}
                className="h-7 w-auto max-w-[120px] shrink-0 object-contain sm:h-9 sm:max-w-[160px]"
              />
              {brandingDisplay.headerTitle ? (
                <span
                  className="truncate text-[17px] font-bold text-ink sm:text-[22px]"
                  style={{ fontFamily: "var(--font-inter), sans-serif" }}
                >
                  {brandingDisplay.headerTitle}
                </span>
              ) : null}
            </>
          ) : brandingDisplay.headerTitle ? (
            <span
              className="truncate text-[17px] font-bold text-ink sm:text-[22px]"
              style={{ fontFamily: "var(--font-inter), sans-serif" }}
            >
              {brandingDisplay.headerTitle}
            </span>
          ) : (
            <span className="text-[15px] font-semibold text-ink-muted">Performance Report</span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {brandingDisplay.showPoweredBy ? (
            <span className="hidden text-[15px] text-white md:inline">Powered by NextReport</span>
          ) : null}
          {rightSlot}
        </div>
      </div>
    </header>
  );
}
