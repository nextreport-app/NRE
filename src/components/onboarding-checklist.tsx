"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/toast";
import type { OnboardingStep } from "@/lib/onboarding";
import { FirstRunHelpLinks } from "@/components/first-run-help-links";
import { useSiteCopy } from "@/hooks/use-site-copy";
import { localizedOnboardingStep } from "@/lib/dashboard-i18n";

function StepChevron() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-dash-ink-secondary/70" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M7.21 14.77a.75.75 0 01.02-1.06L10.94 10 7.23 6.29a.75.75 0 111.06-1.06l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function OnboardingChecklist({
  steps,
  progress,
}: {
  steps: OnboardingStep[];
  progress: { completed: number; total: number };
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const { locale, dashboard: d } = useSiteCopy();
  const [dismissing, setDismissing] = useState(false);

  const progressPct = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
  const firstIncomplete = steps.find((s) => !s.done && !s.optional);

  async function handleDismiss() {
    setDismissing(true);
    const res = await fetch("/api/account/onboarding", { method: "POST" });
    setDismissing(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(data.error || d.onboardingDismissError, "error");
      return;
    }

    router.refresh();
  }

  return (
    <section
      aria-label={d.onboardingAria}
      className="mb-8 overflow-hidden rounded-2xl border border-dash-border bg-gradient-to-b from-dash-card to-dash-card/80 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]"
    >
      <div className="border-b border-dash-border/80 px-6 py-6 sm:px-8 sm:py-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <p className="text-[12px] font-semibold uppercase tracking-widest text-dash-accent">{d.onboardingWelcome}</p>
            <h2 className="mt-2 text-[22px] font-bold tracking-tight text-dash-ink sm:text-[26px]">{d.onboardingTitle}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-dash-ink-secondary">{d.onboardingLead}</p>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            disabled={dismissing}
            className="shrink-0 rounded-full px-3 py-1.5 text-[13px] text-dash-ink-secondary transition-colors hover:bg-dash-bg hover:text-dash-ink disabled:opacity-60"
          >
            {dismissing ? d.onboardingSkipping : d.onboardingSkip}
          </button>
        </div>

        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between text-[12px] font-medium text-dash-ink-secondary">
            <span>{d.onboardingProgress(progress.completed, progress.total)}</span>
            <span>{progressPct}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-dash-bg">
            <div
              className="h-full rounded-full bg-dash-accent transition-[width] duration-500 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      <ol className="space-y-0 divide-y divide-dash-border/70 px-4 py-2 sm:px-6">
        {steps.map((step, index) => {
          const isNext = !step.done && step.id === firstIncomplete?.id;
          const copy = localizedOnboardingStep(locale, step.id);
          return (
            <li key={step.id}>
              <Link
                href={step.href}
                className={
                  "group flex items-start gap-4 rounded-xl px-3 py-4 transition-colors sm:px-4 " +
                  (step.done
                    ? "opacity-75"
                    : isNext
                      ? "bg-dash-accent/8 hover:bg-dash-accent/12"
                      : "hover:bg-dash-bg/60")
                }
              >
                <span
                  className={
                    "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-bold " +
                    (step.done
                      ? "bg-emerald-900/40 text-emerald-300"
                      : isNext
                        ? "bg-dash-accent text-dash-ink"
                        : "bg-dash-border/80 text-dash-ink-secondary")
                  }
                  aria-hidden="true"
                >
                  {step.done ? "✓" : index + 1}
                </span>
                <span className="min-w-0 flex-1 pt-0.5">
                  <span className="flex flex-wrap items-center gap-2">
                    <span
                      className={
                        "text-[16px] font-semibold " + (step.done ? "text-dash-ink-secondary line-through" : "text-dash-ink")
                      }
                    >
                      {copy.title}
                    </span>
                    {step.optional ? (
                      <span className="rounded-md bg-dash-bg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-dash-ink-secondary">
                        {d.onboardingOptional}
                      </span>
                    ) : null}
                    {isNext ? (
                      <span className="rounded-md bg-dash-accent/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-dash-accent">
                        {d.onboardingStartHere}
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-1 block text-[14px] leading-relaxed text-dash-ink-secondary">{copy.description}</span>
                </span>
                {!step.done ? (
                  <span className="mt-2 opacity-60 transition-opacity group-hover:opacity-100">
                    <StepChevron />
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ol>

      <div className="px-6 py-5 sm:px-8">
        <FirstRunHelpLinks />
      </div>
    </section>
  );
}
