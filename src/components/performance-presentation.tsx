import type { ReactNode } from "react";
import { countryPresentation } from "@/lib/country-presentation";
import { searchDateRange } from "@/lib/search-console/presentation";
function CountryFlag({ code }: { code: string }) {
  const { region } = countryPresentation(code);
  return region ? (
    <svg
      aria-hidden="true"
      width="24"
      height="16"
      viewBox="0 0 513 342"
      className="shrink-0 rounded-sm"
    >
      <use href={`/country-flags.svg#${region}`} />
    </svg>
  ) : null;
}
function DeviceIcon({ device }: { device: string }) {
  const type = device.toLowerCase();
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      {type === "desktop" ? (
        <>
          <rect x="3" y="3" width="18" height="13" rx="2" />
          <path d="M8 21h8M12 16v5" />
        </>
      ) : type === "mobile" || type === "tablet" ? (
        <>
          <rect
            x={type === "mobile" ? "6" : "3"}
            y="2"
            width={type === "mobile" ? "12" : "18"}
            height="20"
            rx="2"
          />
          <path d="M11 18h2" />
        </>
      ) : (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M9 9h6v6H9z" />
        </>
      )}
    </svg>
  );
}

export function CountryLabel({ country }: { country: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <CountryFlag code={country} />
      {countryPresentation(country).name}
    </span>
  );
}
export function DeviceLabel({ device }: { device: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <DeviceIcon device={device} />
      {device.charAt(0).toUpperCase() + device.slice(1).toLowerCase()}
    </span>
  );
}
export function ComparisonPeriod({
  current,
  previous,
  custom = false,
}: {
  current: { startIso: string; endIso: string };
  previous: { startIso: string; endIso: string };
  custom?: boolean;
}) {
  const days =
    Math.round(
      (Date.parse(current.endIso) - Date.parse(current.startIso)) / 86400000,
    ) + 1;
  const unit = days === 1 ? "day" : "days";
  return (
    <section
      aria-label="Comparison dates"
      className="mt-5 rounded-xl border border-dash-border bg-dash-card p-4"
    >
      <h2 className="text-sm font-semibold">
        {custom ? "" : "Last "}
        {days} {unit} vs previous {days} {unit}
      </h2>
      <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <p>
          <span className="block text-xs text-dash-ink-secondary">
            Selected period
          </span>
          <span className="mt-1 block">{searchDateRange(current)}</span>
        </p>
        <p>
          <span className="block text-xs text-dash-ink-secondary">
            Previous period
          </span>
          <span className="mt-1 block">{searchDateRange(previous)}</span>
        </p>
      </div>
    </section>
  );
}
export function BreakdownTotals({ items }: { items: ReactNode[] }) {
  return (
    <div className="mt-4 flex flex-wrap gap-3 text-xs">
      {items.map((item, index) => (
        <span
          key={index}
          className="rounded-lg border border-dash-border bg-dash-bg px-3 py-2"
        >
          {item}
        </span>
      ))}
    </div>
  );
}
/** Additive totals only: missing values cannot silently become zero. */
export function sumReported(values: Array<number | null | undefined>) {
  return values.length && values.every((value) => value != null)
    ? values.reduce<number>((sum, value) => sum + value!, 0)
    : null;
}
