"use client";

import Link from "next/link";
import { WebsiteReportWizard } from "@/components/website-report-wizard";
import { SupportTicketLink } from "@/components/support-ticket-link";
import { WhatsAppChatLink } from "@/components/whatsapp-chat-link";
import { getAdWizardFlow, getWizardStepHeading, getWizardStepSubtitle } from "@/lib/nre/platform-labels";
import type { ReportUploadWizardProps } from "./types";
import { WizardProvider, useWizardContext } from "./wizard-context";
import { StepIndicator } from "./ui/step-indicator";
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
    <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-[#f6ad55]/40 border-l-4 border-l-[#f6ad55] bg-dash-card/90 px-4 py-3 shadow-sm">
      <span className="text-[12px] font-semibold uppercase tracking-wider text-dash-ink-secondary">Client</span>
      <span className="text-[17px] font-bold leading-tight text-[#fbd38d]">{clientName}</span>
      <Link
        href="/clients"
        className="ml-auto text-[14px] font-semibold text-[#7dd3fc] underline decoration-[#7dd3fc]/60 underline-offset-[3px] hover:text-[#bae6fd] hover:decoration-[#bae6fd]"
      >
        Select client →
      </Link>
    </div>
  );
}

function ReportUploadWizardBody() {
  const w = useWizardContext();

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
      <div>
        <WizardClientLine clientName={w.clientName} />
        <h1 className="mb-1 text-[20px] font-bold text-white">{getWizardStepHeading(w.step, w.platform)}</h1>
        {getWizardStepSubtitle(w.step, w.platform) ? (
          <p className="text-[14px] text-dash-ink-secondary">{getWizardStepSubtitle(w.step, w.platform)}</p>
        ) : null}
      </div>
      <StepIndicator step={w.step} visitedSteps={w.visitedSteps} onNavigate={w.setStep} flow={wizardFlow} />

      {w.step === 4 && (
        <p className="rounded-lg border border-dash-border bg-dash-sidebar/60 px-4 py-3 text-[14px] leading-relaxed text-dash-ink-secondary">
          Have a question or an issue with this report?{" "}
          <SupportTicketLink clientId={w.clientId} openInNewTab /> or{" "}
          <WhatsAppChatLink message="Hi — I need help with a report in NextReport." />
          .
        </p>
      )}

      <WizardImportStep />
      <WizardCampaignsStep />
      <WizardMetricsStep />
      <WizardGenerateStep />
    </div>
  );
}
