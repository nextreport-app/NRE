import type { ClientNarrative } from "@/lib/nre/report-client-narrative";
export function ClientNarrativeView({ narrative }: { narrative: ClientNarrative }) {
  return <div className="mt-6 space-y-5 break-words">
    <div><h3 className="text-sm font-semibold text-ink">Campaign summary</h3><p className="mt-2 text-sm leading-relaxed text-ink-secondary">{narrative.summary}</p></div>
    <div><h3 className="text-sm font-semibold text-ink">Key insights &amp; updates</h3><ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-relaxed text-ink-secondary">{narrative.insights.map((insight, index) => <li key={index}>{insight}</li>)}</ul></div>
  </div>;
}
