import { fetchMetaAdAccountInsights, MetaInsightsFetchError, type MetaFormEvidenceQuery } from "@/lib/meta-api";
import { FormResultEvidenceError, leadActionEvidence } from "./form-result-evidence-error";

/** Diagnostic probes are never merged into delivery rows or treated as Results. */
export async function collectFormResultEvidence(error: FormResultEvidenceError, input: { accessToken: string; adAccountId: string; sinceIso: string; untilIso: string }) {
  const day = error.diagnostic.dateStart;
  const adSetId = error.diagnostic.adSetId;
  const campaignId = error.diagnostic.campaignId;
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day) || day < input.sinceIso || day > input.untilIso || !adSetId || !/^\d+$/.test(adSetId)) return;
  const kinds = ["destination", "conversion_destination", "attribution"] as const;
  const results = await Promise.allSettled(kinds.map(kind => fetchMetaAdAccountInsights({
    accessToken: input.accessToken, adAccountId: input.adAccountId,
    sinceIso: day, untilIso: day, level: "adset", includeResultChannels: false,
    formEvidence: { kind, adSetId } satisfies MetaFormEvidenceQuery,
  })));
  results.forEach((result, index) => {
    const kind = kinds[index];
    if (result.status === "rejected") {
      // Error messages/URLs may contain secrets; expose only a numeric Meta code.
      const code = result.reason instanceof MetaInsightsFetchError ? result.reason.meta.code : undefined;
      error.diagnostic.probes.push({ kind, status: "unavailable", ...(typeof code === "number" ? { metaCode: code } : {}) });
      return;
    }
    const rows = (Array.isArray(result.value) ? result.value : []).filter(row => row?.adset_id === adSetId && row.date_start === day && (!campaignId || row.campaign_id === campaignId)).slice(0, 5);
    error.diagnostic.probes.push({ kind, status: "returned", attributionMode: kind === "attribution" ? "explicit_windows" : "adset_unified", rows: rows.map(row => ({ date: day, actions: leadActionEvidence(row.actions), costs: leadActionEvidence(row.cost_per_action_type) })) });
  });
}
