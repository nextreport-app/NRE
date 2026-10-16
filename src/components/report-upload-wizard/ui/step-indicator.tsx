"use client";

import { useSiteTheme } from "@/components/site-theme-provider";
import { wizardStepLabel } from "@/lib/wizard-i18n";
import type { Step } from "../types";
import { getVisibleWizardSteps } from "@/lib/nre/platform-labels";

export function StepIndicator({
  step,
  visitedSteps,
  onNavigate,
  flow,
}: {
  step: Step;
  visitedSteps: Set<Step>;
  onNavigate: (s: Step) => void;
  flow: "full" | "simple";
}) {
  const { locale } = useSiteTheme();
  const steps = getVisibleWizardSteps(flow);
  return (
    <nav className="nre-wizard-step-track" aria-label="Report wizard steps">
      {steps.map((s) => {
        const isCompleted = s < step && visitedSteps.has(s);
        const isActive = s === step;

        if (isCompleted) {
          return (
            <button
              key={s}
              type="button"
              onClick={() => onNavigate(s)}
              className="nre-wizard-step-pill nre-wizard-step-pill--done inline-flex items-center gap-1.5"
            >
              <span className="nre-wizard-step-dot" aria-hidden="true" />
              {wizardStepLabel(s, locale)}
            </button>
          );
        }

        return (
          <span
            key={s}
            className={`nre-wizard-step-pill ${isActive ? "nre-wizard-step-pill--active" : "nre-wizard-step-pill--idle"}`}
            aria-current={isActive ? "step" : undefined}
          >
            {wizardStepLabel(s, locale)}
          </span>
        );
      })}
    </nav>
  );
}

/** Small inline spinner for the Preview screen's "Generating your report…" state — no extra dependency needed for one spinning icon. */
