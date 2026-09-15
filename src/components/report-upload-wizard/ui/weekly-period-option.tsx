"use client";


export function WeeklyPeriodOption({
  selected,
  label,
  sublabel,
  onSelect,
}: {
  selected: boolean;
  label: string;
  sublabel?: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`rounded-lg border px-4 py-2.5 text-left transition-colors ${
        selected
          ? "border-dash-accent bg-dash-accent/10"
          : "border-dash-border bg-dash-bg hover:bg-dash-border/30"
      }`}
    >
      <span className="block text-[14px] font-medium text-white">{label}</span>
      {sublabel && <span className="mt-0.5 block text-[14px] text-dash-ink-secondary">{sublabel}</span>}
    </button>
  );
}

/** Step 1's drag-and-drop CSV upload zone (B1) — a plain file input wrapped in a `<label>` so a click anywhere in the zone opens the file picker, with native HTML5 drag-and-drop events layered on top for the "drop here" path. */
