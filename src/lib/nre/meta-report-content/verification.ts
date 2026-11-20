import type {
  CsvVerificationResult,
  CsvVerificationCheck,
} from "../csv-report-reconciliation";
import type { MetaReportContent, MetaContentPresentation } from "./types";
import type { DateRangeIso } from "../date-range";
import { DIMENSION_LABELS } from "./types";
/** Independent sums of each selected source, excluding preview pages and other views. */
export function verifyMetaContentTotals(
  content: MetaReportContent,
  presentation: MetaContentPresentation,
  ranges: DateRangeIso[],
  campaigns: string[] | null,
): CsvVerificationResult {
  const checks: CsvVerificationCheck[] = [];
  const selected = campaigns
    ? new Set(campaigns.map((name) => name.trim().toLowerCase()))
    : null;
  for (const range of ranges)
    for (const dimension of [
      ...content.options.audience,
      ...(content.options.creatives ? ["creative" as const] : []),
    ]) {
      const source = content.sources.find(
        (source) =>
          source.kind === dimension ||
          (["platform", "placement"].includes(dimension) &&
            source.kind === "platform-placement"),
      );
      if (!source) throw Error(`Missing ${dimension} source for verification.`);
      const rows = source.rows.filter(
        (row) =>
          row.date >= range.startIso &&
          row.date <= range.endIso &&
          (!selected || selected.has(row.campaign.trim().toLowerCase())) &&
          (dimension !== "creative" ||
            !content.options.selectedAdIds ||
            content.options.selectedAdIds.includes(row.adId!)),
      );
      const objectives = [...new Set(rows.map((row) => row.resultLabel))];
      if (!objectives.length) objectives.push("Results");
      for (const objective of objectives) {
        const observations = rows.filter(
          (row) => row.resultLabel === objective,
        );
        const actual = presentation.pages
          .filter(
            (page) =>
              page.id.startsWith(`${dimension}-${range.startIso}-`) &&
              page.kind !== "creative-preview" &&
              page.kind !== "summary" &&
              page.objective === objective,
          )
          .flatMap((page) => page.rows);
        const scope = `${dimension === "creative" ? "Creative" : DIMENSION_LABELS[dimension]} · ${range.startIso}–${range.endIso} · ${objective}`;
        for (const metric of ["spend", "impressions", "results"] as const) {
          const unique =
            metric === "results" &&
            ["REACH", "AD RECALL LIFT"].includes(objective);
          const expected =
            metric === "results" &&
            (unique ||
              !observations.length ||
              observations.some((row) => row.results === null))
              ? null
              : observations.reduce((n, row) => n + (row[metric] ?? 0), 0);
          const reported =
            metric === "results" &&
            (!actual.length || actual.some((row) => row.results === null))
              ? null
              : actual.reduce((n, row) => n + (row[metric] ?? 0), 0);
          const matches =
            expected === null
              ? reported === null
              : reported !== null && Math.abs(expected - reported) < 1e-6;
          checks.push({
            scope,
            metric,
            reportDisplay: reported === null ? "—" : reported.toFixed(2),
            csvDisplay: expected === null ? "—" : expected.toFixed(2),
            status: matches ? "ok" : "mismatch",
          });
        }
      }
    }
  return {
    status: checks.some((check) => check.status === "mismatch")
      ? "mismatch"
      : "ok",
    checks,
    scopesVerified: [...new Set(checks.map((check) => check.scope))],
  };
}
export function mergeMetaVerification(
  standard: CsvVerificationResult,
  meta: CsvVerificationResult,
  includeStandard: boolean,
): CsvVerificationResult {
  if (!includeStandard) return meta;
  return {
    ...standard,
    status:
      standard.status === "mismatch" || meta.status === "mismatch"
        ? "mismatch"
        : meta.status,
    checks: [...standard.checks, ...meta.checks],
    scopesVerified: [
      ...(standard.scopesVerified ?? []),
      ...(meta.scopesVerified ?? []),
    ],
  };
}
