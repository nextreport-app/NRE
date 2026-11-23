import type { WebsiteSnapshot } from "@/lib/website-dashboard/model";
const paidGroups = new Set([
  "Paid Social",
  "Paid Search",
  "Paid Shopping",
  "Paid Video",
  "Paid Other",
  "Display",
  "Cross-network",
  "Audio",
]);
export function WebsitePaidTraffic({ data }: { data: WebsiteSnapshot }) {
  const paid = data.channels.filter((row) => paidGroups.has(row.name));
  return (
    <section
      aria-label="Paid traffic"
      className="mt-4 rounded-xl border border-dash-border bg-dash-bg p-4"
    >
      <h3 className="text-sm font-semibold">Paid traffic</h3>
      {paid.length ? (
        <div className="mt-3 flex flex-wrap gap-3">
          {paid.map((row) => (
            <div
              key={row.name}
              className="rounded-lg border border-dash-border px-3 py-2"
            >
              <p className="text-xs text-dash-ink-secondary">{row.name}</p>
              <p className="mt-1 text-lg font-semibold">
                {row.sessions == null ? "—" : row.sessions.toLocaleString("en")}{" "}
                <span className="text-xs font-normal text-dash-ink-secondary">
                  sessions
                </span>
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-dash-ink-secondary">
          GA4 returned no paid-channel rows for these dates. If you expected
          paid visitors, check your campaign UTMs and Google Ads linking.
        </p>
      )}
    </section>
  );
}
