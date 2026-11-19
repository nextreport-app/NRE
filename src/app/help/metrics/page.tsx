import { META_METRIC_DICTIONARY } from "@/lib/nre/meta-dictionary";
import { metricDefinition } from "@/lib/pptx/legend-slide";
import {
  HelpDocShell,
  helpDocMetadata,
} from "@/components/help/help-doc-shell";

export const metadata = helpDocMetadata({
  title: "Metric guide",
  description:
    "Meta report metric definitions, calculation units, and how to choose metric chips.",
  path: "/help/metrics",
});

const coreTerms = [
  "AD SPEND",
  "REACH",
  "IMPRESSIONS",
  "META FORM LEADS",
  "COST PER LEAD",
  "CLICKS (ALL)",
  "CTR (ALL)",
  "CPC (ALL)",
  "LINK CLICKS",
  "CPLC",
  "LANDING PAGE VIEWS",
  "COST PER LPV",
  "CPM",
  "FREQUENCY",
  "ROAS",
  "WEBSITE CVR",
];
const definitions = new Map(
  coreTerms.map((term) => [
    term,
    metricDefinition(
      term,
      META_METRIC_DICTIONARY.find(
        (metric) => metric.label?.toUpperCase() === term,
      )?.explanation,
    ),
  ]),
);
for (const metric of META_METRIC_DICTIONARY) {
  if (
    (metric.type !== "primary" && metric.type !== "secondary") ||
    !metric.label
  )
    continue;
  const term = metric.label.toUpperCase();
  if (!definitions.has(term))
    definitions.set(term, metricDefinition(term, metric.explanation));
}

export default function HelpMetricsPage() {
  return (
    <HelpDocShell
      title="Metric guide"
      subtitle="Definitions used in your Meta report"
      footer="none"
    >
      <section id="definitions" className="space-y-4 scroll-mt-24">
        <h2 className="text-lg font-semibold text-white">Metric definitions</h2>
        <p>
          Rates use the matching totals for the displayed period and objective.
          An em dash means the metric is unavailable, not zero.
        </p>
        <dl className="grid gap-4 sm:grid-cols-2">
          {coreTerms.map((term) => (
            <div key={term}>
              <dt className="font-semibold text-white">{term}</dt>
              <dd className="mt-1">{definitions.get(term)}</dd>
            </div>
          ))}
        </dl>
        <details className="rounded-lg border border-white/15 p-4">
          <summary className="cursor-pointer font-semibold text-white">
            More Meta metric definitions
          </summary>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            {[...definitions]
              .filter(([term]) => !coreTerms.includes(term))
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([term, definition]) => (
                <div key={term}>
                  <dt className="font-semibold text-white">{term}</dt>
                  <dd className="mt-1">{definition}</dd>
                </div>
              ))}
          </dl>
        </details>
      </section>
      <section className="mt-8 space-y-4">
        <h2 className="text-lg font-semibold text-white">
          Choosing metric chips
        </h2>
        <p>
          After objectives are set, we pre-fill metric chips from columns in
          your export — spend, results, reach, impressions, CTR, CPC, and
          objective-specific fields.
        </p>
        <h2 className="text-lg font-semibold text-white">Defaults</h2>
        <p>
          Each campaign gets a sensible set for its objective (e.g. lead
          campaigns emphasize leads and cost per lead). The first eight metrics
          stay on the main slide. Extra metrics are arranged automatically on
          balanced additional slides, with no empty slots or repeated cards. You
          can select up to 64 metrics per campaign.
        </p>
        <h2 className="text-lg font-semibold text-white">Customize</h2>
        <ul className="list-inside list-disc space-y-2">
          <li>Remove a chip with ✕ if you don&apos;t want it on the deck</li>
          <li>
            Use <span className="text-white">+</span> under &quot;Add from your
            CSV&quot; for extra columns you exported
          </li>
          <li>
            Aim for at least four metrics per campaign when your file includes
            them
          </li>
        </ul>
        <h2 className="text-lg font-semibold text-white">Computed metrics</h2>
        <p>
          CPM and cost per 1K reach are calculated from spend, impressions, and
          reach when those base columns are present — you don&apos;t need
          separate columns for them.
        </p>
        <p className="text-sm text-ink-muted">
          For required export columns and date ranges, see the{" "}
          <a
            href="/help/download"
            className="text-accent-orange hover:underline"
          >
            CSV export guide
          </a>
          .
        </p>
      </section>
    </HelpDocShell>
  );
}
