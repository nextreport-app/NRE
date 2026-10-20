import { META_WALKTHROUGH_PARTS } from "@/lib/meta-walkthrough-script";

/** On-page chapter list — read alongside the Loom walkthrough (no audio required). */
export function MetaWalkthroughChapters({ className = "" }: { className?: string }) {
  return (
    <div className={`space-y-8 ${className}`.trim()}>
      {META_WALKTHROUGH_PARTS.map((part) => (
        <div key={part.id}>
          <h3 className="text-base font-semibold text-white sm:text-lg">{part.heading}</h3>
          <ol className="mt-3 space-y-3">
            {part.steps.map((step, index) => (
              <li key={step.title} className="flex gap-3 rounded-lg border border-navy-border bg-navy/40 px-3 py-3 sm:px-4">
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy-panel text-xs font-bold text-accent-orange"
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-white">{step.title}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-ink-secondary">{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      ))}
      <p className="text-[12px] leading-relaxed text-ink-muted">
        Follow these steps in order as the video plays. YouTube chapters on the upload match this flow when you expand the
        description on youtube.com.
      </p>
    </div>
  );
}
