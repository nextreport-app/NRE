import { describe, expect, it } from "vitest";
import { clientDateLocale, formatClientCalendarDate, formatClientCalendarRange, formatClientTimestamp, formatStoredDateText, storedReportDateToIso } from "../client-date-format";
import { reportHistoryMetaSubtitle } from "../report-list-shared";
describe("regional client dates", () => {
  it.each([["INR","13/11/2026"],["USD","11/13/2026"],["GBP","13/11/2026"],["AUD","13/11/2026"],["NZD","13/11/2026"],["EUR","13/11/2026"]])("formats %s without treating every foreign client as US", (currency, expected) => {
    expect(formatClientCalendarDate("2026-11-13", currency)).toBe(expected);
  });
  it("keeps ambiguous days in the correct order", () => {
    expect(formatClientCalendarDate("2026-06-05", "INR")).toBe("05/06/2026");
    expect(formatClientCalendarDate("2026-06-05", "USD")).toBe("06/05/2026");
  });
  it("preserves years across a date range", () => {
    expect(formatClientCalendarRange("2026-12-31", "2027-01-01", "INR")).toBe("31/12/2026 – 01/01/2027");
  });
  it("never shifts calendar dates into another timezone", () => {
    expect(formatClientCalendarDate("2026-01-01", "INR")).toBe("01/01/2026");
  });
  it("uses the client timezone for real timestamps", () => {
    expect(formatClientTimestamp("2026-11-13T01:00:00Z", "INR", "Asia/Kolkata", false)).toBe("13/11/2026");
    expect(formatClientTimestamp("2026-11-13T01:00:00Z", "USD", "America/Los_Angeles", false)).toBe("11/12/2026");
  });
  it("parses legacy stored periods as US dates before regional display", () => {
    expect(storedReportDateToIso("06/05/2026")).toBe("2026-06-05");
    expect(formatStoredDateText("06/05/2026 to 06/12/2026", "INR")).toBe("05/06/2026 to 12/06/2026");
    expect(formatStoredDateText("2026-06-05 – 2026-06-12", "USD")).toBe("06/05/2026 – 06/12/2026");
  });
  it("applies the same policy to report history and retention dates", () => {
    const meta = reportHistoryMetaSubtitle({ createdAt: "2026-11-13T01:00:00Z", reportType: "WEEKLY", weekStart: "11/06/2026", weekEnd: "11/12/2026" }, { currency: "INR", timeZone: "Asia/Kolkata", retentionDays: 7 });
    expect(meta.generatedLine).toContain("13/11/2026");
    expect(meta.detailLine).toContain("06/11/2026 – 12/11/2026");
    expect(meta.detailLine).toContain("20/11/2026");
  });
  it("leaves invalid or incomplete date values intact", () => {
    for (const value of ["", "2026-02-30", "2026-13-01", "not a date"]) expect(formatClientCalendarDate(value,"INR")).toBe(value);
    expect(storedReportDateToIso("02/30/2026")).toBeNull();
    expect(formatClientTimestamp("invalid", "INR")).toBe("—");
  });
  it("has regional defaults for every supported currency", () => {
    for (const currency of ["INR","USD","GBP","AUD","CAD","NZD","AED","SGD","MYR","PHP","EUR","ZAR","BRL","MXN"]) expect(() => new Intl.DateTimeFormat(clientDateLocale(currency))).not.toThrow();
  });
});
