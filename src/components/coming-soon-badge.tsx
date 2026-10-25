/** Small pill for optional / phased UI (rare — most features are live). */
export function ComingSoonBadge({ compact = true }: { compact?: boolean }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-400">
      {compact ? "Soon" : "Coming soon"}
    </span>
  );
}

/** Legacy placeholder — prefer live routes; kept for any deferred admin experiments. */
export function DeferredLaunchNotice({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-lg border border-amber-500/30 bg-amber-950/40 px-4 py-3 text-[14px] leading-relaxed text-amber-100/90 ${className}`}
    >
      <span className="font-semibold text-amber-200">Unavailable.</span> This route is not enabled on your
      deployment. Check launch scope in Account settings or contact support.
    </div>
  );
}
