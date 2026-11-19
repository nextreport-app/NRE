/** Keep optional content discoverable without adding competing date/report types. */
export function MetaReportContentGuide({ source }: { source: "api" | "csv" }) {
  return (
    <div
      className="mt-4 border-t border-dash-border pt-4"
      aria-label="Audience and creative reporting guide"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-dash-ink">
          Audience &amp; creative reporting
        </h3>
        <span className="rounded-full border border-dash-border px-2 py-0.5 text-[11px] text-dash-ink-secondary">
          Optional sections
        </span>
      </div>
      <p className="mt-1 text-sm text-dash-ink-secondary">
        Choose these in{" "}
        <strong className="font-medium text-dash-ink">
          Review &amp; generate → Audience &amp; creative sections
        </strong>
        , after importing your data.
      </p>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="min-w-0 border-l-2 border-teal-400/60 pl-3">
          <dt className="text-sm font-medium text-dash-ink">
            Audience breakdowns
          </dt>
          <dd className="mt-1 text-xs leading-relaxed text-dash-ink-secondary">
            Age · Location · Platform · Placement
            <br />
            Available with CSV or Meta API.
          </dd>
        </div>
        <div className="min-w-0 border-l-2 border-violet-400/60 pl-3">
          <dt className="text-sm font-medium text-dash-ink">
            Creative performance
          </dt>
          <dd className="mt-1 text-xs leading-relaxed text-dash-ink-secondary">
            {source === "api"
              ? "Meta API fetches ad metrics and available images or video posters."
              : "CSV provides ad metrics. Add images separately, or use Meta API for available previews."}
          </dd>
        </div>
      </dl>
      {source === "api" && (
        <p className="mt-3 text-xs leading-relaxed text-dash-ink-secondary">
          No extra CSV is needed with API sync. Select the sections and fetch
          them from Meta in Review &amp; generate.
        </p>
      )}
      <details className="mt-3 text-xs leading-relaxed text-dash-ink-secondary">
        <summary className="cursor-pointer font-medium text-dash-accent">
          Which CSVs do I need?
        </summary>
        <div className="mt-3 space-y-3">
          <p>
            In Meta Ads Manager, use the same date range as your main export and
            include a{" "}
            <strong className="font-medium text-dash-ink">Day breakdown</strong>
            . Audience exports should use the Campaigns view; a single-ad-set
            export per campaign is also supported.
          </p>
          <dl className="grid gap-x-4 gap-y-2 rounded-lg border border-dash-border bg-dash-card p-3 sm:grid-cols-[110px_minmax(0,1fr)]">
            <dt className="font-medium text-dash-ink">Age</dt>
            <dd>A separate CSV with the Age breakdown.</dd>
            <dt className="font-medium text-dash-ink">Location</dt>
            <dd>A separate CSV with either Region/state or Country.</dd>
            <dt className="font-medium text-dash-ink">Platform</dt>
            <dd>A CSV with Platform, such as Facebook and Instagram.</dd>
            <dt className="font-medium text-dash-ink">Placement</dt>
            <dd>
              A CSV with Platform + Placement. This one file can supply both
              sections.
            </dd>
          </dl>
          <p>
            Include Campaign name, Amount spent, Impressions, Results, Result
            type and Clicks (all). Use Columns → Customize columns to add
            missing columns, then export CSV. Keep the same account, currency,
            timezone and attribution setting. Upload the separate exports in
            Review &amp; generate. Do not combine Age and Location into one file
            or add totals across audience views.
          </p>
          <p>
            For an audience-only report, an audience CSV can be your first
            upload. To include standard performance too, start with an
            unsegmented daily export and add the breakdown files later.
          </p>
          <p>
            <strong className="font-medium text-dash-ink">Creative CSV:</strong>{" "}
            use the Ads view with Day breakdown, Ad ID, Ad name and the same
            metric columns, without audience breakdowns. Add matching purchase
            value for ROAS and landing-page views for website conversion rate.
            The CSV has no image files: use a metrics-only report or upload
            images against the displayed Ad IDs.
          </p>
          <p>
            API video previews use poster images. Carousel and dynamic previews
            represent the ad, rather than individual asset performance. Missing
            media keeps the available metrics.
          </p>
        </div>
      </details>
    </div>
  );
}
