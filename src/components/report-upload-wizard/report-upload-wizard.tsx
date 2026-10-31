"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { WebsiteReportWizard } from "@/components/website-report-wizard";
import { getAdWizardFlow } from "@/lib/nre/platform-labels";
import { wizardStepHeading, wizardStepSubtitle } from "@/lib/wizard-i18n";
import { useSiteTheme } from "@/components/site-theme-provider";
import { useWizardCopy } from "@/hooks/use-wizard-copy";
import type { ReportUploadWizardProps } from "./types";
import { WizardProvider, useWizardContext } from "./wizard-context";
import { StepIndicator } from "./ui/step-indicator";
import { UploadSessionRecoveryBanner } from "./ui/upload-session-recovery-banner";
import { WizardLeaveDialog } from "./ui/wizard-leave-dialog";
import { WizardImportStep } from "./steps/import-step";
import { WizardCampaignsStep } from "./steps/campaigns-step";
import { WizardMetricsStep } from "./steps/metrics-step";
import { WizardGenerateStep } from "./steps/generate-step";

export function ReportUploadWizard(props: ReportUploadWizardProps) {
  return (
    <WizardProvider {...props}>
      <ReportUploadWizardBody />
    </WizardProvider>
  );
}

function WizardClientLine({
  clientName,
  onChangeClientClick,
}: {
  clientName: string;
  onChangeClientClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
  const copy = useWizardCopy();
  return (
    <div className="nre-wizard-client-bar mb-4 flex items-center justify-between gap-4 rounded-lg border bg-dash-card/60 px-4 py-3 sm:px-5">
      <div className="min-w-0 flex-1 sm:flex sm:items-baseline sm:gap-3">
        <p className="nre-wizard-client-bar__label shrink-0 text-[10px] font-medium uppercase tracking-[0.1em]">
          {copy.reportingFor}
        </p>
        <p className="nre-wizard-client-bar__name mt-0.5 min-w-0 break-words text-[17px] font-semibold leading-snug sm:mt-0 sm:text-[19px]">
          {clientName}
        </p>
      </div>
      <Link
        href="/clients"
        onClick={onChangeClientClick}
        className="nre-wizard-client-bar__link shrink-0 text-[13px] font-medium underline underline-offset-[3px]"
      >
        {copy.changeClient}
      </Link>
    </div>
  );
}

function ReportUploadWizardBody() {
  const w = useWizardContext();
  const { locale } = useSiteTheme();
  const copy = useWizardCopy();
  const wizardTopRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    if (w.step !== 4) {
      wizardTopRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
    }
  }, [w.step]);

  useEffect(() => {
    if (!w.wizardLeaveGuardActive) return;
    const wizardPath = `/clients/${w.clientId}/reports/new`;
    const onClickCapture = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      if (anchor.target === "_blank") return;
      const pathOnly = href.split("?")[0]?.split("#")[0] ?? "";
      if (pathOnly === wizardPath) return;
      if (!href.startsWith("/")) return;
      event.preventDefault();
      event.stopPropagation();
      w.requestWizardLeave(href);
    };
    document.addEventListener("click", onClickCapture, true);
    return () => document.removeEventListener("click", onClickCapture, true);
  }, [w.wizardLeaveGuardActive, w.clientId, w.requestWizardLeave]);

  useEffect(() => {
    if (!w.wizardLeaveGuardActive) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [w.wizardLeaveGuardActive]);

  const guardedClientChange = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!w.wizardLeaveGuardActive) return;
    event.preventDefault();
    w.requestWizardLeave("/clients");
  };

  const clientLine = (
    <WizardClientLine clientName={w.clientName} onChangeClientClick={guardedClientChange} />
  );

  if (w.resumeBootstrapping || w.wizardDraftBootstrapping) {
    return (
      <div className="nre-report-wizard space-y-6">
        <div>
          {clientLine}
          <h1 className="mb-1 text-[20px] font-bold text-dash-ink">Choose report type and generate</h1>
          <p className="text-[14px] text-dash-ink-secondary">Loading your report…</p>
        </div>
      </div>
    );
  }

  if (w.wizardKind === "website") {
    return (
      <div className="nre-report-wizard space-y-6">
        <div>
          {clientLine}
          <h1 className="mb-1 text-[20px] font-bold text-dash-ink">Google Analytics</h1>
          <p className="text-[14px] text-dash-ink-secondary">Sessions, channels, landing pages, and breakdown slides.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            w.setWizardKind("ads");
            w.setPlatformPickerExpanded(true);
          }}
          className="text-[14px] font-medium text-dash-accent underline hover:no-underline"
        >
          ← Back to ad platform reports
        </button>
        <WebsiteReportWizard
          clientId={w.clientId}
          clientName={w.clientName}
          hasGa4Property={w.hasGa4Property}
          ga4Connected={w.ga4Connected}
          embedded
        />
      </div>
    );
  }

  const wizardFlow = getAdWizardFlow(w.platform);
  const generateSuccessScreen = w.step === 4 && w.generateStatus === "done";

  return (
    <div className="nre-report-wizard space-y-6">
      <div ref={wizardTopRef}>
        {clientLine}
        {!generateSuccessScreen ? (
          <>
            <h1 className="mb-1 text-[20px] font-bold text-dash-ink">
              {w.step === 4
                ? `${copy.generateHeadingPrefix} ${w.reportTypeLabel()}`
                : wizardStepHeading(w.step, w.platform, locale)}
            </h1>
            {wizardStepSubtitle(w.step, w.platform, locale) ? (
              <p className="text-[14px] text-dash-ink-secondary">{w.step === 3 && w.reportType === "COMPARISON" ? "Review the metrics included in your comparison report." : wizardStepSubtitle(w.step, w.platform, locale)}</p>
            ) : null}
          </>
        ) : null}
      </div>
      {!generateSuccessScreen ? (
        <StepIndicator step={w.step} visitedSteps={w.visitedSteps} onNavigate={w.setStep} flow={wizardFlow} />
      ) : null}

      {w.uploadSessionRecovery ? (
        <UploadSessionRecoveryBanner
          message={w.uploadSessionRecovery}
          reanalyzing={w.reanalyzeSessionStatus === "loading"}
          onReanalyze={() => void w.handleReanalyzeSession()}
          onStartOver={w.handleGenerateAnother}
        />
      ) : null}

      <WizardImportStep />
      <WizardCampaignsStep />
      <WizardMetricsStep />
      <WizardGenerateStep />

      <WizardLeaveDialog
        open={!!w.pendingLeaveHref}
        onStay={w.cancelWizardLeave}
        onLeave={w.confirmWizardLeave}
      />
    </div>
  );
}
