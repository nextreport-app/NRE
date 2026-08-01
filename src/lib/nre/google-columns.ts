/**
 * Google Ads CSV column auto-detection — the Google Ads counterpart to
 * columns.ts's Meta dictionary. Column names come from a Google Ads /
 * Google Ads Editor report export (case-insensitive, matched as
 * substrings of the trimmed, lowercased header).
 *
 * Unlike columns.ts's single-pass "check every metric against every
 * header" algorithm, this uses a priority-ordered, single-claim match:
 * for each header, the FIRST metric (in priority order, most-specific
 * keyword phrases first) whose keyword matches claims that header, and no
 * other metric can also claim it. This matters much more here than for
 * Meta's dictionary — Google's own column names are full of overlapping
 * compound phrases (e.g. "Cost", "Cost / conv.", "Cost per conversion" all
 * share the substring "cost"; "Conversions", "Conv. rate", "Conv. value",
 * "Search impr. share" all share "conv"/"impr." fragments), so a generic
 * field's broad keyword (e.g. "cost") would otherwise also match a more
 * specific column's header before that column's own field gets a look in
 * — exactly the class of bug columns.ts's own `spend` field had to be
 * fixed for (see its comment: "cost" was removed because it's a substring
 * of "Cost per Result" and would silently steal that column).
 */

export const GOOGLE_METRIC_KEYS = [
  "campaign_name",
  "ad_group_name",
  "day",
  "status",
  "cost",
  "clicks",
  "impressions",
  "ctr",
  "avg_cpc",
  "conversions",
  "cost_per_conv",
  "conv_rate",
  "conv_value",
  "roas",
  "search_impr_share",
  "quality_score",
  "avg_position",
] as const;

export type GoogleMetricKey = (typeof GOOGLE_METRIC_KEYS)[number];

export const GOOGLE_COLUMN_KEYWORDS: Record<GoogleMetricKey, string[]> = {
  campaign_name: ["campaign", "campaign name"],
  ad_group_name: ["ad group", "ad group name"],
  day: ["day", "date", "week", "month"],
  status: ["campaign state", "status", "campaign status"],
  cost: ["cost", "spend", "total cost"],
  clicks: ["clicks", "interactions"],
  impressions: ["impr.", "impressions"],
  ctr: ["ctr", "click-through rate", "interaction rate"],
  avg_cpc: ["avg. cpc", "average cpc", "avg. cost"],
  conversions: ["conversions", "all conv.", "conv."],
  cost_per_conv: ["cost / conv.", "cost per conversion", "cost / all conv."],
  conv_rate: ["conv. rate", "conversion rate", "all conv. rate"],
  conv_value: ["conv. value", "all conv. value", "conversion value"],
  roas: ["conv. value / cost", "roas", "return on ad spend"],
  search_impr_share: ["search impr. share", "impression share"],
  quality_score: ["qual. score", "quality score"],
  avg_position: ["avg. position", "search top is"],
};

/**
 * Match priority — most-specific compound keyword phrases first, so e.g.
 * "Cost / conv." claims cost_per_conv before the generic "cost" keyword
 * (checked last) gets a chance at it, and "Search Impr. Share" claims
 * search_impr_share before the generic "impr."/"impressions" keyword does.
 * See the file header comment for why this ordering (rather than
 * columns.ts's "let every matching metric claim the header" approach)
 * matters for this particular dictionary.
 */
const MATCH_PRIORITY: GoogleMetricKey[] = [
  "cost_per_conv",
  "conv_rate",
  "roas",
  "conv_value",
  "search_impr_share",
  "quality_score",
  "avg_position",
  "avg_cpc",
  "status",
  "ad_group_name",
  "campaign_name",
  "impressions",
  "ctr",
  "clicks",
  "conversions",
  "cost",
  "day",
];

export type GoogleColumnMap = Partial<Record<GoogleMetricKey, string>>;

/** Priority-ordered, single-claim port of columns.ts's buildColumnMap — see file header for why the algorithm differs. */
export function buildGoogleColumnMap(headers: string[]): GoogleColumnMap {
  const map: GoogleColumnMap = {};
  headers.forEach((header) => {
    if (!header) return;
    const h = String(header).toLowerCase().trim();
    for (const metric of MATCH_PRIORITY) {
      if (map[metric]) continue;
      const keywords = GOOGLE_COLUMN_KEYWORDS[metric];
      if (keywords.some((kw) => h.includes(kw))) {
        map[metric] = header;
        break;
      }
    }
  });
  return map;
}

export type GoogleRow = Partial<Record<GoogleMetricKey, string>> & { _raw: Record<string, string> };

/** Google Ads counterpart to columns.ts's readRowsWithAutoMap. */
export function readGoogleRowsWithAutoMap(
  headers: string[],
  dataRows: string[][],
): { colMap: GoogleColumnMap; rows: GoogleRow[] } {
  const colMap = buildGoogleColumnMap(headers);
  const headerIndex: Record<string, number> = {};
  headers.forEach((h, i) => {
    if (h) headerIndex[String(h)] = i;
  });

  const rows = dataRows
    .filter((row) => row.some((cell) => cell !== "" && cell !== null && cell !== undefined))
    .map((row) => {
      const obj: GoogleRow = { _raw: {} };
      headers.forEach((h, i) => {
        if (h) obj._raw[h] = row[i] ?? "";
      });
      (Object.entries(colMap) as [GoogleMetricKey, string][]).forEach(([metric, header]) => {
        obj[metric] = row[headerIndex[header]] || "";
      });
      return obj;
    });

  return { colMap, rows };
}

export type Platform = "META" | "GOOGLE";

/**
 * Detects which platform a CSV export came from, from its header row alone
 * — used right after upload, before any row parsing, to route to the
 * right column dictionary/validator/report pipeline. Per spec: Google Ads
 * is detected by the presence of Campaign + Clicks + Impressions + Avg. CPC
 * columns AND the absence of "Amount spent" (Meta-specific — Google Ads
 * exports never use that phrase, they use "Cost"). Defaults to META
 * whenever the Google signal isn't a confident match, matching this app's
 * original, only-ever-Meta behavior for any CSV that doesn't clearly look
 * like a Google Ads export.
 */
export function detectPlatform(headers: string[]): Platform {
  const normalized = headers.filter(Boolean).map((h) => String(h).toLowerCase().trim());
  const has = (...phrases: string[]) => phrases.some((p) => normalized.some((h) => h.includes(p)));

  const hasCampaign = has("campaign", "campaign name");
  const hasClicks = has("clicks");
  const hasImpressions = has("impr.", "impressions");
  const hasAvgCpc = has("avg. cpc", "average cpc");
  const hasAmountSpent = has("amount spent");

  const looksLikeGoogleAds = hasCampaign && hasClicks && hasImpressions && hasAvgCpc && !hasAmountSpent;
  return looksLikeGoogleAds ? "GOOGLE" : "META";
}
