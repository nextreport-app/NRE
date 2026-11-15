import { fetchMetaAdAccountInsights, fetchMetaAdSetInstantFormIds, type MetaInsightRow } from "@/lib/meta-api";

/** Retain canonical totals for secondary metrics; attach verified form-scoped
 * observations separately. No subtraction or numeric-ID heuristic is used. */
export async function resolveFormDestinations(rows: MetaInsightRow[], input: { accessToken: string; adAccountId: string; sinceIso: string; untilIso: string }): Promise<MetaInsightRow[]> {
  const needsDestination = (row: MetaInsightRow) => !row.configured_result_action && row.optimization_goal?.toUpperCase() === "LEAD_GENERATION" && (row.results == null || (row.results.length === 0 && row.actions?.some(action => action.action_type === "onsite_conversion.lead_grouped" && Number(action.value) > 0)));
  const ids = [...new Set(rows.filter(needsDestination).flatMap(row => row.adset_id && /^\d+$/.test(row.adset_id) ? [row.adset_id] : []))];
  const resolved = new Map<MetaInsightRow, MetaInsightRow>();
  for (let offset = 0; offset < ids.length; offset += 4) {
    await Promise.all(ids.slice(offset, offset + 4).map(async adSetId => {
      const ownRows = rows.filter(row => row.adset_id === adSetId && needsDestination(row));
      let formIds: string[] = [];
      let destinations: MetaInsightRow[];
      try {
        formIds = await fetchMetaAdSetInstantFormIds(input.accessToken, adSetId);
        if (!formIds.length) throw new Error("No verified form IDs");
        destinations = await fetchMetaAdAccountInsights({ ...input, level: "adset", includeResultChannels: false, formEvidence: { kind: "destination", adSetId } });
      } catch {
        for (const row of ownRows) resolved.set(row, { ...row, configured_form_ids: formIds, form_destination_status: formIds.length ? "destination_unavailable" : "configuration_unavailable" });
        return;
      }
      for (const row of ownRows) {
        const matches = destinations.filter(item => item.adset_id === adSetId && item.campaign_id === row.campaign_id && item.date_start === row.date_start && item.date_stop === row.date_stop);
        const match = matches[0];
        if (matches.length !== 1 || !match || String(row.spend ?? "").trim() === "" || String(match.spend ?? "").trim() === "" || !Number.isFinite(Number(row.spend)) || Number(row.spend) < 0 || !Number.isFinite(Number(match.spend)) || Math.abs(Number(match.spend) - Number(row.spend)) > 1e-8) {
          resolved.set(row, { ...row, configured_form_ids: formIds, form_destination_status: "coverage_mismatch" });
        } else {
          resolved.set(row, { ...row, configured_form_ids: formIds, form_destination_status: "verified", form_destination_actions: match.actions ?? [] });
        }
      }
    }));
  }
  return rows.map(row => resolved.get(row) ?? row);
}
