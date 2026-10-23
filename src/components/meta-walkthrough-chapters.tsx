import { META_WALKTHROUGH_QUICK_GUIDE } from "@/lib/meta-walkthrough-script";

/** Short on-page checklist beside the walkthrough video. */
export function MetaWalkthroughChapters({ className = "" }: { className?: string }) {
  return (
    <div className={`space-y-5 ${className}`.trim()}>
      {META_WALKTHROUGH_QUICK_GUIDE.map((part) => (
        <div key={part.label}>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-accent-orange">{part.label}</h3>
          <ul className="mt-2 space-y-1.5 border-l-2 border-navy-border pl-4 text-[14px] leading-snug text-ink-secondary">
            {part.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
