"use client";
/** Saved work is offered on Import; it never navigates without a customer action. */
export function SavedSetupBanner({ onResume }: { onResume: () => void }) {
  return <section className="rounded-xl border border-dash-border bg-dash-card p-4" aria-label="Saved report setup">
    <p className="text-sm font-semibold text-dash-ink">You have an unfinished report setup</p>
    <p className="mt-1 text-sm text-dash-ink-secondary">Continue your saved setup, or upload a new CSV below to start a new report.</p>
    <button type="button" onClick={onResume} className="mt-3 rounded-md border border-dash-border px-4 py-2 text-sm font-medium text-dash-accent">Continue saved setup</button>
  </section>;
}
