/** Static amber remainder replaced by green as completed work is reported. */
export function OperationProgressRing({
  progress,
  onAmber = false,
  label,
}: {
  progress?: number | null;
  onAmber?: boolean;
  label?: string;
}) {
  const measured = typeof progress === "number" && Number.isFinite(progress);
  const value = measured ? Math.max(0, Math.min(100, progress)) : undefined;
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      className="nre-operation-ring shrink-0"
      data-on-amber={onAmber || undefined}
      style={
        onAmber
          ? ({
              "--ring-green": "#14532d",
              "--ring-amber": "#854d0e",
            } as import("react").CSSProperties)
          : undefined
      }
      role={label ? "progressbar" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? 100 : undefined}
      aria-valuenow={label ? value : undefined}
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        pathLength="100"
        stroke="var(--ring-amber)"
        strokeWidth="3"
        opacity={1}
        transform="rotate(180 12 12)"
      />
      <circle
        cx="12"
        cy="12"
        r="9"
        pathLength="100"
        stroke="var(--ring-green)"
        strokeWidth="3"
        strokeLinecap="butt"
        strokeDasharray={`${value ?? 0} 100`}
        transform="rotate(-90 12 12)"
      />
    </svg>
  );
}
