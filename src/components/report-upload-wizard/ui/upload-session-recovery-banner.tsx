"use client";

export function UploadSessionRecoveryBanner({
  message,
  reanalyzing,
  onReanalyze,
  onStartOver,
}: {
  message: string;
  reanalyzing?: boolean;
  onReanalyze: () => void;
  onStartOver?: () => void;
}) {
  return (
    <div className="rounded-lg border border-amber-800/50 bg-amber-950/30 px-4 py-3">
      <p className="text-[14px] leading-relaxed text-amber-200">{message}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onReanalyze}
          disabled={reanalyzing}
          className="rounded-md bg-dash-accent px-4 py-2 text-[14px] font-semibold text-dash-ink hover:bg-dash-accent-hover disabled:opacity-50"
        >
          {reanalyzing ? "Re-analyzing…" : "Re-analyze same file"}
        </button>
        {onStartOver ? (
          <button
            type="button"
            onClick={onStartOver}
            disabled={reanalyzing}
            className="rounded-md border border-dash-border px-4 py-2 text-[14px] text-dash-ink-secondary hover:bg-dash-border disabled:opacity-50"
          >
            Start over
          </button>
        ) : null}
      </div>
    </div>
  );
}
