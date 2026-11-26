export function MonitoringStatusGuide() {
  return (
    <details className="mt-3 text-xs text-dash-ink-secondary">
      <summary className="w-fit cursor-pointer underline underline-offset-4">
        How statuses and alert emails work
      </summary>
      <div className="mt-3 space-y-2 rounded-xl border border-dash-border bg-dash-bg p-4 leading-relaxed">
        <p>
          <strong className="text-dash-ink">Critical:</strong> actual budget
          overspend beyond your allowed tolerance; results stopping with
          meaningful spend in the last 7 completed days; severe primary-result
          loss (at least 60%) or cost per result doubling with sufficient
          evidence and sustained spend.
        </p>
        <p>
          <strong className="text-dash-ink">Review:</strong> forecast budget
          overrun, budget approaching its limit, or material performance
          deterioration: CTR down at least 20%, CPC up at least 25%, primary
          results down at least 30%, cost per result up at least 25%, or
          purchase ROAS down at least 20%. Sampling and sustained-spend
          safeguards apply.
        </p>
        <p>
          <strong className="text-dash-ink">Improvement:</strong> substantial
          gains versus the previous period: cost per result down at least 20%,
          results up at least 25% without materially higher result cost, or
          purchase ROAS up at least 20%. CTR up at least 30% or CPC down at
          least 25% qualifies only when primary results are maintained and
          result cost is stable. Meeting a target alone is not an improvement.
        </p>
        <p>
          Account status prioritizes Critical, then Review, then Improvement. A
          separate Improvement badge can identify other improving campaigns.
          Campaign badges describe each campaign; totals can mix objectives and
          do not override campaign warnings.
        </p>
        <p>
          The recent stopped-results check uses a known prior result baseline
          (at least 5 results) or a saved cost target, at least 500 impressions,
          and spend of at least 3 times that result cost. Missing data is never
          treated as zero. Historical custom ranges are not emailed
          automatically.
        </p>
        <p>
          When the intraday runner is enabled, scheduled checks run once an hour, oldest accounts first; large queues can take longer. Refresh
          data also checks now, subject to provider cooldowns. Critical alerts
          are queued for your verified account email as soon as a check detects
          them; review warnings follow your email preference. Repeat checks
          deduplicate matching alerts, and failed delivery is retried. Meta
          attribution and reporting can be delayed.
        </p>
      </div>
    </details>
  );
}
