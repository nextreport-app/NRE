/** Small pill for deferred platforms/features during Meta-first launch. */
export function ComingSoonBadge({ compact = true }: { compact?: boolean }) {
  return (
    <span className="inline-flex shrink-0 rounded-full border border-amber-700/50 bg-amber-950/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200/90">
      {compact ? "Soon" : "Launching soon"}
    </span>
  );
}

/** Inline notice for dashboard settings and deferred wizard routes. */
export function DeferredLaunchNotice({ className = "" }: { className?: string }) {
  return (
    <p
      className={`rounded-lg border border-amber-800/40 bg-amber-950/25 px-4 py-3 text-[13px] leading-relaxed text-amber-100/90 ${className}`}
    >
      <span className="font-semibold text-amber-200">Launching soon.</span> Meta Ads reporting is live. Google Ads,
      TikTok, and GA4 are next — connect accounts now if you like; report generation opens after parity testing.
    </p>
  );
}
