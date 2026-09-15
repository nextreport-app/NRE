"use client";

import type { Step } from "../types";
import { getVisibleWizardSteps, getWizardStepLabel } from "@/lib/nre/platform-labels";

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
  const steps = getVisibleWizardSteps(flow);
  return (
    <div className="flex flex-wrap items-center gap-2 text-[14px]">
      {steps.map((s, i) => {
        const isCompleted = s < step && visitedSteps.has(s);
        return (
          <div key={s} className="flex items-center gap-2">
            {isCompleted ? (
              <button
                type="button"
                onClick={() => onNavigate(s)}
                className="flex items-center gap-1.5 rounded-full px-3 py-1 font-medium text-dash-ink-secondary hover:text-white"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-[#68d391]" aria-hidden="true" />
                {getWizardStepLabel(s, flow)}
              </button>
            ) : (
              <span
                className={
                  s === step
                    ? "rounded-full bg-dash-accent px-3 py-1 font-medium text-dash-ink"
                    : "rounded-full border border-dash-border px-3 py-1 text-dash-ink-secondary"
                }
              >
                {getWizardStepLabel(s, flow)}
              </span>
            )}
            {i < steps.length - 1 && <span className="text-dash-ink-secondary">→</span>}
          </div>
        );
      })}
    </div>
  );
}

/** Small inline spinner for the Preview screen's "Generating your report…" state — no extra dependency needed for one spinning icon. */
