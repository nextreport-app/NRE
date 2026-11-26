export function MonitoringStatusGuide() {
  return (
    <details className="mt-3 text-xs text-dash-ink-secondary">
      <summary className="w-fit cursor-pointer underline underline-offset-4">
        Status &amp; email alerts
      </summary>
      <div className="mt-3 space-y-2 rounded-xl border border-dash-border bg-dash-bg p-4 leading-relaxed">
        <p>
          <strong className="text-dash-ink">Critical:</strong> budget exceeded,
          results stopped despite meaningful spend, or severe loss of results or
          cost efficiency.
        </p>
        <p>
          <strong className="text-dash-ink">Review:</strong> budget at risk,
          significantly fewer results, higher costs, or falling CTR/ROAS.
        </p>
        <p>
          <strong className="text-dash-ink">Improvement:</strong> substantially
          better results or lower costs, supported by sufficient data.
        </p>
        <p>
          The account shows its highest-priority status; other campaigns may
          also show Improvement.
        </p>
        <p>
          Scheduled checks run hourly when enabled. Critical alerts are emailed
          automatically while monitoring is enabled; review emails follow your
          preference. Repeated alerts are deduplicated. Reporting can be
          delayed.
        </p>
      </div>
    </details>
  );
}
