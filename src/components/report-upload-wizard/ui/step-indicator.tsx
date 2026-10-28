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
    <nav aria-label="Report progress" className={`grid ${steps.length === 4 ? "grid-cols-4" : "grid-cols-2"} items-center gap-2 text-[12px] sm:flex sm:flex-wrap sm:gap-y-3 sm:text-[14px]`}>
      {steps.map((s, i) => {
        const isCompleted = s < step && visitedSteps.has(s);
        return (
          <div key={s} className="min-w-0 sm:flex sm:items-center sm:gap-2">
            {isCompleted ? (
              <button
                type="button"
                onClick={() => onNavigate(s)}
                className="flex w-full items-center justify-center gap-1.5 rounded-full px-2 py-1.5 font-medium text-dash-ink-secondary hover:text-dash-ink sm:w-auto sm:px-3"
              >
                <span className="hidden h-1.5 w-1.5 shrink-0 rounded-full bg-[#68d391] sm:block" aria-hidden="true" />
                <span className="min-w-0 break-words">{wizardStepLabel(s, locale)}</span>
              </button>
            ) : (
              <span
                aria-current={s === step ? "step" : undefined}
                className={
                  s === step
                    ? "block rounded-full bg-dash-accent px-2 py-1.5 text-center sm:px-3 font-semibold text-dash-ink"
                    : "block rounded-full border border-dash-border px-2 py-1.5 text-center sm:px-3 text-dash-ink-secondary"
                }
              >
                {wizardStepLabel(s, locale)}
              </span>
            )}
            {i < steps.length - 1 && <span aria-hidden="true" className="hidden text-dash-ink-secondary sm:inline">→</span>}
          </div>
        );
      })}
    </nav>
  );
}

/** Small inline spinner for the Preview screen's "Generating your report…" state — no extra dependency needed for one spinning icon. */
