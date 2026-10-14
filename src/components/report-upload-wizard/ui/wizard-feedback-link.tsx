"use client";

import Link from "next/link";

/** General product feedback — separate from per-report support tickets. */
export function WizardFeedbackLink() {
  return (
    <p className="text-center text-[13px] text-dash-ink-muted">
      <Link
        href="/feedback"
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-dash-accent hover:underline"
      >
        Send product feedback
      </Link>
      <span className="text-dash-ink-muted"> — ideas or improvements for NextReport</span>
    </p>
  );
}
