"use client";
import type { MouseEvent } from "react";
import Link from "next/link";

/** Stay focused on report creation; changing client uses the wizard's leave guard. */
export function WizardChangeClient({ changeClientLabel, onChangeClientClick }: {
  changeClientLabel: string;
  onChangeClientClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  return <Link href="/clients" onClick={onChangeClientClick}
    className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 py-2 text-xs font-medium text-dash-ink-secondary hover:bg-dash-bg hover:text-dash-ink focus-visible:outline-2 focus-visible:outline-dash-accent">
    {changeClientLabel}
  </Link>;
}
