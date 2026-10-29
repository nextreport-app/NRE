import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SiteThemeProvider } from "@/components/site-theme-provider";
import { CsvVerificationPanel } from "../ui/csv-verification-panel";
import { buildGenerateStepReadinessItems } from "../ui/report-readiness-panel";
import type { CsvVerificationResult } from "@/lib/nre/csv-report-reconciliation";

const matching: CsvVerificationResult = {
  status: "ok",
  checks: [{ scope: "Report week", metric: "Amount spent", status: "ok", reportDisplay: "$100", csvDisplay: "$100" }],
  scopesVerified: ["Report week (Oct 19 - Oct 25)"],
};
const coverageWarnings = [{ scope: "Report week (Oct 19 - Oct 25)", missingDays: ["2026-10-21"], message: "Confirm the export range; dates without delivery may be omitted." }];
function render(verification: CsvVerificationResult) {
  return renderToStaticMarkup(<SiteThemeProvider><CsvVerificationPanel verification={verification} /></SiteThemeProvider>);
}

describe("verification presentation separates numeric mismatches from source coverage", () => {
  it("shows a date review with matching numbers without claiming mismatched totals or full green coverage", () => {
    const verification = { ...matching, coverageWarnings };
    const html = render(verification);
    expect(html).toContain("CSV date coverage to review");
    expect(html).toContain("2026-10-21");
    expect(html).toContain("The comparisons passed for their own reporting windows.");
    expect(html).not.toContain("Deck preview differs");
    expect(html).not.toContain("nre-wizard-callout-success");
    const items = buildGenerateStepReadinessItems({ campaignsSelected: 2, previewStatus: "idle", generateStepPreviewReady: true, csvVerification: verification, previewRefreshing: false, reportTypeLabel: "Weekly" });
    expect(items.find(item => item.id === "csv")).toMatchObject({ status: "warning", label: "CSV totals match; review date coverage" });
  });

  it("shows only actual numeric mismatches while retaining the date review", () => {
    const html = render({ ...matching, status: "mismatch", coverageWarnings, checks: [...matching.checks, { scope: "Report week", metric: "WEBSITE LEADS", status: "mismatch", reportDisplay: "1", csvDisplay: "0" }] });
    expect(html).toContain("Deck preview differs from your CSV on 1 total");
    expect(html).toContain("CSV date coverage to review");
    expect(html).toContain("WEBSITE LEADS");
    expect(html).not.toContain("Amount spent");
  });

  it("shows a recorded incident reference without claiming a deployed fix", () => {
    const html = render({ ...matching, status: "mismatch", qualityIncidentId: "cincidentreference12345", checks: [{ scope: "Report week", metric: "CPC", status: "mismatch", reportDisplay: "—", csvDisplay: "$0.42" }] });
    expect(html).toContain("Recorded for review.");
    expect(html).toContain("cincidentreference12345");
    expect(html).not.toContain("fixed automatically");
    expect(html).not.toContain("refresh and try again");
  });

  it("retains the successful section heading without the reporting-window list", () => {
    const html = render(matching);
    expect(html).toContain("nre-wizard-callout-success");
    expect(html).toContain("Listed CSV checks passed");
    expect(html).not.toContain("Report week (Oct 19 - Oct 25)");
    expect(html).not.toContain("CSV date coverage to review");
  });
});
