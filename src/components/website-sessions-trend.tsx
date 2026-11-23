import type { WebsiteSnapshot } from "@/lib/website-dashboard/model";
export function WebsiteSessionsTrend({ data }: { data: WebsiteSnapshot }) {
  const points = data.trend.filter((d) => d.sessions !== null),
    max = Math.max(1, ...points.map((d) => d.sessions!));
  const start = Date.parse(data.currentPeriod.startIso + "T12:00:00Z");
  return (
    <section className="mt-5 min-w-0 rounded-xl border border-dash-border bg-dash-card p-4">
      <h2 className="font-semibold">Daily sessions</h2>
      {points.length ? (
        <svg
          className="mt-3 block w-full text-dash-accent"
          viewBox="0 0 600 125"
          role="img"
          aria-label="Daily sessions reported by Google Analytics"
        >
          <line
            x1="0"
            x2="600"
            y1="120"
            y2="120"
            stroke="currentColor"
            opacity=".25"
          />
          {points.map((p) => {
            const iso = p.date.replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3"),
              index = (Date.parse(iso + "T12:00:00Z") - start) / 86400000,
              width = 600 / data.days;
            return (
              <rect
                key={p.date}
                x={index * width + 2}
                y={120 - (p.sessions! / max) * 108}
                width={Math.max(1, width - 4)}
                height={(p.sessions! / max) * 108}
                fill="currentColor"
                rx="2"
              >
                <title>
                  {iso}: {p.sessions} sessions
                </title>
              </rect>
            );
          })}
        </svg>
      ) : (
        <p className="mt-3 text-sm text-dash-ink-secondary">
          Daily sessions are unavailable.
        </p>
      )}
      <div className="mt-1 flex justify-between text-xs text-dash-ink-secondary">
        <span>{data.currentPeriod.startIso}</span>
        <span>{data.currentPeriod.endIso}</span>
      </div>
      <p className="mt-2 text-xs text-dash-ink-secondary">
        Hover a bar for its value. Gaps mean GA4 returned no daily row.
      </p>
    </section>
  );
}
