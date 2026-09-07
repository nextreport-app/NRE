/**
 * Shared resolver — builds WebsiteReportData from GA4 API or CSV upload.
 */

import { getGa4AccessTokenForUser } from "@/lib/ga4-session";
import { parseUploadedFile } from "@/lib/nre/parse-file";
import { readGa4RowsWithAutoMap, detectGa4CsvDimensions } from "@/lib/nre/ga4-columns";
import { validateGa4Csv } from "@/lib/nre/validate-ga4";
import { buildWebsiteReportFromCsv, computeGa4CsvDateBounds } from "@/lib/nre/build-website-report-from-csv";
import { fetchGa4WebsiteReport, resolveWebsiteReportRanges } from "@/lib/nre/fetch-ga4-website-report";
import type { WebsiteReportConfig } from "@/lib/nre/website-report-config";
import type { WebsiteReportData } from "@/lib/nre/website-report-data";

export type WebsiteDataSource = "api" | "csv";

export async function resolveWebsiteReportData(input: {
  userId: string;
  timezone: string;
  currencySymbol: string;
  accountName?: string;
  ga4PropertyId?: string | null;
  ga4PropertyName?: string | null;
  config: WebsiteReportConfig;
  dataSource: WebsiteDataSource;
  csvBuffer?: Buffer | null;
}): Promise<{ data: WebsiteReportData; warnings: string[] }> {
  const warnings: string[] = [];

  if (input.dataSource === "csv") {
    if (!input.csvBuffer) throw new Error("Upload a GA4 CSV export to generate from CSV.");
    const parsed = parseUploadedFile(input.csvBuffer, "GA4 CSV");
    const { colMap, rows } = readGa4RowsWithAutoMap(parsed.headers, parsed.dataRows);
    const validation = validateGa4Csv(colMap, rows, new Date(), parsed.headers);
    if (!validation.valid) {
      throw new Error(validation.errors[0]?.message ?? "GA4 CSV validation failed");
    }
    warnings.push(...validation.warnings.map((w) => w.message));

    const csvBounds = computeGa4CsvDateBounds(rows);
    let config = input.config;
    if (csvBounds && config.datePreset === "custom" && (!config.startIso || !config.endIso)) {
      config = { ...config, startIso: csvBounds.startIso, endIso: csvBounds.endIso };
    }

    const ranges = resolveWebsiteReportRanges(config, input.timezone);
    const detectedDims = detectGa4CsvDimensions(colMap);
    if (detectedDims.length === 0) {
      warnings.push("No breakdown dimension columns detected — only overview metrics will appear unless you include dimension columns in the CSV.");
    }

    const data = buildWebsiteReportFromCsv({
      rows,
      colMap,
      config,
      currentRange: ranges.current,
      comparisonRange: ranges.previous,
      propertyId: "csv",
      propertyName: "GA4 CSV Export",
      accountName: input.accountName,
      currencySymbol: input.currencySymbol,
    });
    return { data, warnings };
  }

  if (!input.ga4PropertyId) {
    throw new Error("Link a GA4 property to this client first (Manage page → Website Analytics).");
  }

  const accessToken = await getGa4AccessTokenForUser(input.userId);
  if (!accessToken) {
    throw new Error("Connect Google Analytics in Account Settings first.");
  }

  const ranges = resolveWebsiteReportRanges(input.config, input.timezone);
  const data = await fetchGa4WebsiteReport({
    accessToken,
    propertyId: input.ga4PropertyId,
    propertyName: input.ga4PropertyName ?? input.ga4PropertyId,
    accountName: input.accountName,
    currencySymbol: input.currencySymbol,
    currentRange: ranges.current,
    comparisonRange: ranges.previous,
    config: input.config,
  });

  return { data, warnings };
}
