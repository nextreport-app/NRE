import Link from "next/link";

const RESOURCES = [
  { href: "/help/download", label: "CSV Export Guide" },
  { href: "/sample-report.pptx", label: "Sample report" },
  { href: "/how-it-works", label: "How it works" },
] as const;

/** Shared help links for new users — visible on checklist and empty client list (incl. mobile). */
export function OnboardingResourceLinks({ compact }: { compact?: boolean }) {
  return (
    <div className={compact ? "mt-6 w-full border-t border-dash-border pt-5" : "mt-5 border-t border-dash-border pt-4"}>
      <p className="text-[13px] font-medium text-dash-ink">Before your first upload</p>
      <p className="mt-1 text-[13px] leading-relaxed text-dash-ink-secondary">
        Most weekly Meta reports finish in under about 2 minutes after you upload a day-wise CSV.
      </p>
      <ul className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-5 sm:gap-y-2">
        {RESOURCES.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="text-[14px] font-medium text-dash-accent underline decoration-dash-accent/40 underline-offset-2 hover:decoration-dash-accent"
            >
              {item.label} →
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
