import Link from "next/link";

const LINKS = [
  { href: "/help/download", label: "CSV Export Guide" },
  { href: "/sample-report.pptx", label: "Sample report" },
  { href: "/how-it-works", label: "How it works" },
] as const;

/** Inline help links — use once per screen (checklist or dismissed empty state). */
export function FirstRunHelpLinks({ className = "" }: { className?: string }) {
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
