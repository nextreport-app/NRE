"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { WebsiteReportWizard } from "@/components/website-report-wizard";
import { getAdWizardFlow, getWizardStepHeading, getWizardStepSubtitle } from "@/lib/nre/platform-labels";
import type { ReportUploadWizardProps } from "./types";
import { WizardProvider, useWizardContext } from "./wizard-context";
import { StepIndicator } from "./ui/step-indicator";
import { UploadSessionRecoveryBanner } from "./ui/upload-session-recovery-banner";
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

function WizardClientLine({ clientName }: { clientName: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-[#f6ad55]/50 border-l-4 border-l-[#f6ad55] bg-dash-card px-4 py-3.5 shadow-sm">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-dash-ink-secondary">Reporting for</span>
      <span className="min-w-0 flex-1 truncate text-[22px] font-bold leading-tight text-[#fbd38d] sm:text-[26px]" title={clientName}>
        {clientName}
      </span>
      <Link
        href="/clients"
        className="shrink-0 text-[14px] font-semibold text-[#7dd3fc] underline decoration-[#7dd3fc]/60 underline-offset-[3px] hover:text-[#bae6fd] hover:decoration-[#bae6fd]"
      >
        Change client →
      </Link>
    </div>
  );
}

function ReportUploadWizardBody() {
  const w = useWizardContext();
  const wizardTopRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    if (w.step !== 4) {
      wizardTopRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
    }
  }, [w.step]);

  const wizardLeaveGuard =
    w.step > 1 && w.generateStatus !== "done" && w.generateStatus !== "loading";

  useEffect(() => {
    if (!wizardLeaveGuard) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [wizardLeaveGuard]);

  if (w.resumeBootstrapping) {
    return (
      <div className="space-y-6">
        <div>
          <WizardClientLine clientName={w.clientName} />
          <h1 className="mb-1 text-[20px] font-bold text-white">Choose report type and generate</h1>
          <p className="text-[14px] text-dash-ink-secondary">Loading your report…</p>
        </div>
      </div>
    );
  }

  if (w.wizardKind === "website") {
    return (
      <div className="space-y-6">
        <div>
          <WizardClientLine clientName={w.clientName} />
          <h1 className="mb-1 text-[20px] font-bold text-white">Google Analytics</h1>
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

  return (
    <div className="space-y-6">
      <div ref={wizardTopRef}>
        <WizardClientLine clientName={w.clientName} />
        <h1 className="mb-1 text-[20px] font-bold text-white">
          {w.step === 4 ? `Generate: ${w.reportTypeLabel()}` : getWizardStepHeading(w.step, w.platform)}
        </h1>
        {getWizardStepSubtitle(w.step, w.platform) ? (
          <p className="text-[14px] text-dash-ink-secondary">{getWizardStepSubtitle(w.step, w.platform)}</p>
        ) : null}
      </div>
      <StepIndicator step={w.step} visitedSteps={w.visitedSteps} onNavigate={w.setStep} flow={wizardFlow} />

      {w.draftRestoredBanner ? (
        <div className="rounded-lg border border-sky-800/50 bg-sky-950/30 px-4 py-3">
          <p className="text-[14px] leading-relaxed text-sky-100">
            Restored your in-progress report setup from this browser session.{" "}
            <button
              type="button"
              className="font-semibold text-sky-300 underline hover:no-underline"
              onClick={() => w.setDraftRestoredBanner(false)}
            >
              Dismiss
            </button>
          </p>
        </div>
      ) : null}

      {w.uploadSessionRecovery ? (
        <UploadSessionRecoveryBanner
          message={w.uploadSessionRecovery}
          reanalyzing={w.reanalyzeSessionStatus === "loading"}
          onReanalyze={() => void w.handleReanalyzeSession()}
          onStartOver={() => w.setStep(1)}
        />
      ) : null}

      <WizardImportStep />
      <WizardCampaignsStep />
      <WizardMetricsStep />
      <WizardGenerateStep />
    </div>
  );
}
