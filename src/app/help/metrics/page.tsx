import { HelpDocShell, helpDocMetadata } from "@/components/help/help-doc-shell";

export const metadata = helpDocMetadata({
  title: "Metric chips on slides",
  description:
    "How NextReport pre-selects metric chips from your CSV on Step 3 and how to add or remove columns.",
  path: "/help/metrics",
});

export default function HelpMetricsPage() {
  return (
    <HelpDocShell
      title="CSV columns & metric chips"
      subtitle="What Step 3 (Metrics) puts on each campaign slide"
    >
      <section className="space-y-4">
        <p>
          After objectives are set, we pre-fill metric chips from columns in your export — spend, results, reach,
          impressions, CTR, CPC, and objective-specific fields.
        </p>
        <h2 className="text-lg font-semibold text-white">Defaults</h2>
        <p>
          Each campaign gets a sensible set for its objective (e.g. lead campaigns emphasize leads and cost per lead).
          Up to eight chips can sit on the first slide; extras move to a continuation slide when needed.
        </p>
        <h2 className="text-lg font-semibold text-white">Customize</h2>
        <ul className="list-inside list-disc space-y-2">
          <li>Remove a chip with ✕ if you don&apos;t want it on the deck</li>
          <li>Use <span className="text-white">+</span> under &quot;Add from your CSV&quot; for extra columns you exported</li>
          <li>Aim for at least four metrics per campaign when your file includes them</li>
        </ul>
        <h2 className="text-lg font-semibold text-white">Computed metrics</h2>
        <p>
          CPM and cost per 1K reach are calculated from spend, impressions, and reach when those base columns are
          present — you don&apos;t need separate columns for them.
        </p>
        <p className="text-sm text-ink-muted">
          For required export columns and date ranges, see the{" "}
          <a href="/help/download" className="text-accent-orange hover:underline">
            CSV export guide
          </a>
          .
        </p>
      </section>
    </HelpDocShell>
  );
}
