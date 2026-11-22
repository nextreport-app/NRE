import { it, expect } from "vitest";
import { buildScheduledTableDraft } from "../table-draft";
import { scheduleSettingsSchema, periodForOccurrence } from "../calendar";
import { parseCsvText } from "../../nre/parse-csv";
const date = new Date("2026-11-23T09:00Z");
const parsed = parseCsvText(
  "Campaign name,Day,Amount spent (USD),Results,Result type,Impressions,Clicks (all),Link clicks\nLead,2026-11-22,50,5,On-Facebook leads,1000,20,10\nTraffic,2026-11-22,40,100,Link clicks,1000,100,100\nLead,2026-11-09,30,3,On-Facebook leads,1000,20,10",
);
function build(
  cadence: "DAILY" | "FORTNIGHTLY",
  rows = parsed.rows,
  campaignNames: string[] = [],
) {
  const settings = scheduleSettingsSchema.parse({
    cadence,
    anchorDate: cadence === "FORTNIGHTLY" ? "2026-11-23" : undefined,
    time: "09:00",
    timezone: "UTC",
    recipients: ["owner@example.com"],
    campaignNames,
  });
  return buildScheduledTableDraft({
    accountName: "Any client",
    currency: "USD",
    rows,
    headers: parsed.headers,
    settings,
    period: periodForOccurrence(settings, date),
    dueAt: date,
  });
}
it("reconciles a full 14-day multi-objective table without combining lead and click results", () => {
  const result = build("FORTNIGHTLY");
  expect(result.verification.status).toBe("ok");
  expect(result.data.dateRange).toEqual({
    startIso: "2026-11-09",
    endIso: "2026-11-22",
  });
  expect(result.data.presentation?.summaryPages).toBeDefined();
  expect(
    result.data.tableHeaderLabels.resultColumns.map((c) => c.label),
  ).toEqual(
    expect.arrayContaining([
      expect.stringMatching(/lead/i),
      expect.stringMatching(/click/i),
    ]),
  );
});
it("daily fetches and builds only the selected day", () => {
  const result = build(
    "DAILY",
    parsed.rows.filter((r) => r._raw?.Day === "2026-11-22"),
  );
  expect(result.verification.status).toBe("ok");
  expect(result.data.dayRows).toHaveLength(1);
  expect(result.data.dateRange).toEqual({
    startIso: "2026-11-22",
    endIso: "2026-11-22",
  });
});
it("rejects extra source days rather than silently changing the report window", () => {
  expect(() => build("DAILY")).toThrow("outside");
});
it("keeps selected campaign scope and refuses empty scope output", () => {
  expect(build("FORTNIGHTLY", parsed.rows, ["Lead"]).verification.status).toBe(
    "ok",
  );
  expect(() => build("FORTNIGHTLY", parsed.rows, ["Missing"])).toThrow(
    "No delivery",
  );
});
