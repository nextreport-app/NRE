"use client";

import Link from "next/link";

/** General product feedback — separate from per-report support tickets. */
export function WizardFeedbackLink() {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-dash-ink-secondary">
      <span>Have an idea?</span>
      <Link
        href="/feedback"
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-dash-accent hover:underline"
      >
        Send product feedback
      </Link>
    </p>
  );
}
