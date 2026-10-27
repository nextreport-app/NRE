"use client";

import Link from "next/link";
import type { Platform } from "@/lib/nre/google-columns";
type WizardHelpStep = 2 | 3;

export function WizardStepHelp({
  step,
}: {
  step: WizardHelpStep;
  platform: Platform;
  clientTimezone: string;
}) {
  const objectives = step === 2;
  return <details className="rounded-lg border border-dash-border nre-wizard-panel px-4 py-3 text-[13px] text-dash-ink-secondary"><summary className="cursor-pointer font-medium text-dash-ink">{objectives ? "Need help with campaign objectives?" : "Need help choosing metrics?"}</summary><p className="mt-3 leading-relaxed">{objectives ? "Your CSV provides the detected objective. Change it only if it looks wrong." : "Your CSV provides the default metrics. You can remove or add metrics before continuing."}</p><Link href={objectives ? "/help/objectives" : "/help/metrics"} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-dash-accent hover:underline">{objectives ? "Objective detection guide" : "Metrics guide"} →</Link></details>;
}
