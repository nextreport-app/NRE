import { describe, expect, it } from "vitest";
import { canDownloadReportPdf } from "../ensure-report-pdf";
import type { ShareReportData } from "@/lib/nre/share-report";

describe("canDownloadReportPdf", () => {
  it("is true when publishedAt is set", () => {
    expect(canDownloadReportPdf({ publishedAt: "2026-08-31T12:00:00.000Z" } as ShareReportData)).toBe(true);
    expect(canDownloadReportPdf({ publishedAt: null } as ShareReportData)).toBe(false);
    expect(canDownloadReportPdf(null)).toBe(false);
  });
});
