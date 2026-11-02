import type { DailyTrendPage } from "@/lib/nre/daily-report-presentation";

/** Accessible, responsive bars; missing observations are gaps rather than zeroes. */
export function DailyTrendChart({ page }: { page: DailyTrendPage }) {
  return (
    <div className="space-y-6">
      {page.series.map((series) => {
        const max = Math.max(
          1,
          ...series.points.map((point) => point.value ?? 0),
        );
        const step = 780 / Math.max(1, series.points.length);
        return (
          <figure key={series.key}>
            <figcaption className="mb-2 font-bold text-ink">
              {series.label}
            </figcaption>
            <svg
              viewBox="0 0 840 240"
              role="img"
              aria-label={`${series.label}, ${page.startIso} through ${page.endIso}`}
              className="w-full text-ink"
            >
              {[0, 0.5, 1].map((fraction) => (
                <g key={fraction}>
                  <line
                    x1="55"
                    x2="835"
                    y1={190 - fraction * 160}
                    y2={190 - fraction * 160}
                    stroke="currentColor"
                    opacity="0.15"
                  />
                  <text
                    x="48"
                    y={194 - fraction * 160}
                    textAnchor="end"
                    fill="currentColor"
                    fontSize="10"
                  >
                    {new Intl.NumberFormat("en-US", {
                      maximumFractionDigits: 2,
                    }).format(max * fraction)}
                  </text>
                </g>
              ))}
              {series.points.map((point, index) => (
                <g key={point.dateIso}>
                  <title>
                    {point.dateIso}:{" "}
                    {point.value === null ? "No CSV observation" : point.value}
                  </title>
                  {point.value === null ? (
                    <text
                      x={55 + (index + 0.5) * step}
                      y="185"
                      fill="currentColor"
                      textAnchor="middle"
                    >
                      —
                    </text>
                  ) : (
                    <rect
                      x={55 + (index + 0.15) * step}
                      y={190 - Math.max(1, (point.value / max) * 160)}
                      width={step * 0.7}
                      height={Math.max(1, (point.value / max) * 160)}
                      fill="#38bdf8"
                    />
                  )}
                  {index % Math.ceil(series.points.length / 8) === 0 && (
                    <text
                      x={55 + (index + 0.5) * step}
                      y="214"
                      fill="currentColor"
                      textAnchor="middle"
                      fontSize="10"
                    >
                      {point.dateIso.slice(5)}
                    </text>
                  )}
                </g>
              ))}
            </svg>
          </figure>
        );
      })}
      <p className="text-sm text-ink-muted">
        Each metric has its own scale. Gaps indicate missing CSV observations;
        zero means an exported zero.
      </p>
    </div>
  );
}
