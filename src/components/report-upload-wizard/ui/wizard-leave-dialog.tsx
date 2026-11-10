"use client";

export function WizardLeaveDialog({
  open,
  onStay,
  onLeave,
}: {
  open: boolean;
  onStay: () => void;
  onLeave: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-xl border border-dash-border bg-dash-card p-5 shadow-xl">
        <h2 className="text-[17px] font-semibold text-dash-ink">Leave report setup?</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-dash-ink-secondary">
          Your unfinished setup will not be saved. If you leave, upload your CSV or sync Meta again to start a new report.
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onStay}
            className="rounded-md bg-dash-accent px-4 py-2 text-[14px] font-semibold text-dash-ink hover:bg-dash-accent-hover"
          >
            Stay on wizard
          </button>
          <button
            type="button"
            onClick={onLeave}
            className="rounded-md border border-dash-border px-4 py-2 text-[14px] text-dash-ink-secondary hover:bg-dash-border"
          >
            Leave anyway
          </button>
        </div>
      </div>
    </div>
  );
}
