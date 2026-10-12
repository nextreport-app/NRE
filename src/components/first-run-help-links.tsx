"use client";

import Link from "next/link";
import { useSiteCopy } from "@/hooks/use-site-copy";

/** Inline help links — use once per screen (checklist or dismissed empty state). */
export function FirstRunHelpLinks({ className = "" }: { className?: string }) {
  const { dashboard: d } = useSiteCopy();
  const LINKS = [
    { href: "/help/download", label: d.helpCsvGuide },
    { href: "/sample-report.pptx", label: d.helpSampleReport },
    { href: "/how-it-works", label: d.helpHowItWorks },
  ] as const;

  return (
    <p className={`text-[13px] leading-relaxed text-dash-ink-secondary ${className}`.trim()}>
      {LINKS.map((item, index) => (
        <span key={item.href}>
          {index > 0 ? <span className="mx-1.5 text-dash-border select-none">·</span> : null}
          <Link href={item.href} className="font-medium text-dash-accent hover:text-dash-accent-hover hover:underline">
            {item.label}
          </Link>
        </span>
      ))}
    </p>
  );
}
