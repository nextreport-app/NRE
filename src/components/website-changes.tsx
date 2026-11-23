"use client";
import { Fragment, useState } from "react";
import type { WebsiteSnapshot } from "@/lib/website-dashboard/model";
import {
  websiteChanges,
  channelComparisons,
  WEBSITE_CHANGE_LABELS,
  type WebsiteChangeState,
} from "@/lib/website-dashboard/changes";
const number = (n: number | null | undefined) =>
  n == null
    ? "—"
    : new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);
const delta = (n: number) =>
  Math.abs(n) > 0 && Math.abs(n) < 0.01
    ? `${n < 0 ? "−" : "+"}<0.01`
    : `${n > 0 ? "+" : ""}${number(n)}`;
const rate = (n: number | null | undefined) =>
  n == null ? "—" : `${number(n * 100)}%`;
function Badge({ state }: { state: WebsiteChangeState }) {
  return (
    <span
      className={`inline-block rounded-full border px-2 py-1 text-xs ${state === "review" || state === "mixed" ? "border-amber-400 text-amber-400" : state === "positive" ? "border-emerald-400 text-emerald-400" : "border-dash-border text-dash-ink-secondary"}`}
    >
      {WEBSITE_CHANGE_LABELS[state]}
    </span>
  );
}
export function WebsiteChanges({
  data,
  fresh,
}: {
  data: WebsiteSnapshot;
  fresh: boolean;
}) {
  const change = websiteChanges(data, fresh);
  return (
    <section
      aria-label="Website changes"
      className="nre-website-changes mt-5 rounded-xl border border-dash-border bg-dash-card p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">What changed</h2>
        <Badge state={change.state} />
      </div>
      {change.signals.map((s) => (
        <div key={s.key} className="mt-3">
          <p
            className={`text-sm ${s.tone === "review" ? "text-amber-400" : "text-emerald-400"}`}
          >
            <strong>
              {s.label}:{" "}
              {s.unit === "points" ? rate(s.current) : number(s.current)}
            </strong>
            {" · "}Previous{" "}
            {s.unit === "points" ? rate(s.previous) : number(s.previous)} ·{" "}
            {delta(s.change)} {s.unit === "points" ? "pp" : "%"}
          </p>
          <p className="mt-1 text-xs text-dash-ink-secondary">{s.note}</p>
        </div>
      ))}
      {!change.signals.length && (
        <p className="mt-3 text-sm text-dash-ink-secondary">
          {change.state === "refresh"
            ? "Refresh before interpreting these saved comparisons."
            : change.state === "limited"
              ? "GA4 reported limits on this snapshot. Review its notices before judging changes."
              : change.state === "insufficient"
                ? "More comparable sessions or metrics are needed. Low volume and missing values do not establish stable performance."
                : "No review threshold was crossed with sufficient comparison data. This is not a website health or profitability guarantee."}
        </p>
      )}
      <details className="mt-3 text-xs text-dash-ink-secondary">
        <summary className="cursor-pointer">How to read these changes</summary>
        <p className="mt-2">
          Completed property-local periods only. Engagement needs 100 sessions
          per period and a 5 percentage-point change; key-event rate needs 100
          sessions, at least 5 prior sessions with a key event (estimated only
          for this evidence check from rate × sessions), a 20% relative change
          and at least 0.5 percentage points. A reported zero key-event rate
          with continued traffic is shown separately. Key events depend on your
          GA4 setup and are not automatically leads or purchases. Recent data
          can take 24–48 hours to settle.
        </p>
      </details>
      <a
        className="mt-3 inline-block text-sm text-dash-accent"
        href={`https://analytics.google.com/analytics/web/#/p${data.property.propertyId}/reports/intelligenthome`}
        target="_blank"
        rel="noreferrer"
      >
        Open this property in GA4
      </a>
    </section>
  );
}
export function WebsiteChannelComparison({
  data,
  fresh,
}: {
  data: WebsiteSnapshot;
  fresh: boolean;
}) {
  const [expanded, setExpanded] = useState("");
  const rows = channelComparisons(data);
  return (
    <section
      aria-label="Channel comparisons"
      className="nre-website-changes mt-5 min-w-0 rounded-xl border border-dash-border bg-dash-card p-4"
    >
      <h2 className="font-semibold">Traffic by channel</h2>
      <p className="mt-1 text-xs text-dash-ink-secondary">
        Current versus previous {data.days} days. Open a channel for engagement
        and key-event comparisons.
      </p>
      {!data.previousChannels && (
        <p className="mt-3 text-sm text-amber-400">
          Refresh GA4 to add the previous-period channel data to this saved
          snapshot.
        </p>
      )}
      {(!fresh || !!data.warnings.length) && (
        <p className="mt-2 text-xs text-dash-ink-secondary">
          {!fresh
            ? "Saved comparison only; refresh before acting."
            : "GA4 data-quality notices apply to these comparisons."}
        </p>
      )}
      <p className="mt-2 text-xs text-dash-ink-secondary sm:hidden">
        Swipe to see both periods →
      </p>
      <div className="mt-3 max-w-full overflow-x-auto">
        <table className="w-full text-left text-sm" style={{ minWidth: 460 }}>
          <thead>
            <tr>
              {["Channel", "Sessions", "Previous", "Change"].map((label) => (
                <th
                  key={label}
                  className="pb-2 pr-3 text-xs font-medium text-dash-ink-secondary"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <Fragment key={row.name}>
                <tr className="border-t border-dash-border">
                  <th className="py-3 pr-3 font-normal">
                    <button
                      aria-label={`Compare ${row.name}`}
                      aria-expanded={expanded === row.name}
                      className="text-left underline"
                      onClick={() =>
                        setExpanded(expanded === row.name ? "" : row.name)
                      }
                    >
                      {row.name} <span aria-hidden="true">{expanded === row.name ? "▴" : "▾"}</span>
                    </button>
                    {row.availability && (
                      <span className="mt-1 block text-xs text-dash-ink-secondary">
                        {row.availability}
                      </span>
                    )}
                  </th>
                  <td className="py-3 pr-3">{number(row.current?.sessions)}</td>
                  <td className="py-3 pr-3">
                    {number(row.previous?.sessions)}
                  </td>
                  <td className="py-3">
                    {row.change === null
                      ? row.current?.sessions != null &&
                        row.previous?.sessions === 0
                        ? row.current.sessions === 0
                          ? "0 → 0"
                          : "From zero"
                        : "—"
                      : `${delta(row.change)}%`}
                  </td>
                </tr>
                {expanded === row.name && (
                  <tr>
                    <td colSpan={4} className="pb-4">
                      <div className="rounded-lg border border-dash-border p-3">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <strong>{row.name}</strong>
                          {row.analysis && (
                            <Badge
                              state={
                                !fresh
                                  ? "refresh"
                                  : data.warnings.length
                                    ? "limited"
                                    : row.analysis.state
                              }
                            />
                          )}
                        </div>
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr>
                              <th className="pb-2">Metric</th>
                              <th>Current</th>
                              <th>Previous</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[
                              [
                                "Sessions",
                                number(row.current?.sessions),
                                number(row.previous?.sessions),
                              ],
                              [
                                "Engagement rate",
                                rate(row.current?.engagementRate),
                                rate(row.previous?.engagementRate),
                              ],
                              [
                                "Key events",
                                number(row.current?.keyEvents),
                                number(row.previous?.keyEvents),
                              ],
                              [
                                "Sessions with key event",
                                rate(row.current?.sessionKeyEventRate),
                                rate(row.previous?.sessionKeyEventRate),
                              ],
                            ].map(([label, a, b]) => (
                              <tr
                                key={label}
                                className="border-t border-dash-border"
                              >
                                <th className="py-2 pr-2 font-normal">
                                  {label}
                                </th>
                                <td>{a}</td>
                                <td>{b}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && (
        <p className="mt-3 text-sm">
          No channel rows were reported for these periods.
        </p>
      )}
      <p className="mt-3 text-xs text-dash-ink-secondary">
        Absent rows and missing metrics stay unavailable. GA4 channel
        attribution differs from ad-platform attribution; a change does not
        establish a cause.
      </p>
    </section>
  );
}
