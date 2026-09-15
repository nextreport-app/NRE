"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/toast";
import type { OnboardingStep } from "@/lib/onboarding";

export function OnboardingChecklist({
  steps,
  progress,
}: {
  steps: OnboardingStep[];
  progress: { completed: number; total: number };
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [dismissing, setDismissing] = useState(false);

  async function handleDismiss() {
    setDismissing(true);
    const res = await fetch("/api/account/onboarding", { method: "POST" });
    setDismissing(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(data.error || "Could not dismiss onboarding.", "error");
      return;
    }

    router.refresh();
  }

  return (
    <section
      aria-label="Getting started checklist"
      className="mb-6 rounded-xl border border-dash-border bg-dash-card p-5 sm:p-6"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-semibold text-dash-ink">Getting started</h2>
          <p className="mt-1 text-[14px] text-dash-ink-secondary">
            {progress.completed} of {progress.total} required steps complete
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          disabled={dismissing}
          className="text-[14px] text-dash-ink-secondary underline hover:text-dash-ink disabled:opacity-60"
        >
          {dismissing ? "Skipping…" : "Skip for now"}
        </button>
      </div>

      <ol className="space-y-3">
        {steps.map((step, index) => (
          <li key={step.id}>
            <Link
              href={step.href}
              className={
                "flex items-start gap-3 rounded-lg border px-4 py-3 transition-colors " +
                (step.done
                  ? "border-dash-border/60 bg-dash-bg/40"
                  : "border-dash-border bg-dash-bg hover:border-dash-accent/50")
              }
            >
              <span
                className={
                  "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold " +
                  (step.done ? "bg-emerald-900/50 text-emerald-300" : "bg-dash-border text-dash-ink-secondary")
                }
                aria-hidden="true"
              >
                {step.done ? "✓" : index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className={"text-[15px] font-medium " + (step.done ? "text-dash-ink-secondary" : "text-dash-ink")}>
                    {step.title}
                  </span>
                  {step.optional ? (
                    <span className="rounded bg-dash-border/60 px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-dash-ink-secondary">
                      Optional
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 block text-[14px] leading-relaxed text-dash-ink-secondary">{step.description}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
