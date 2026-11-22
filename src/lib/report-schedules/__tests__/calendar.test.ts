import { describe, it, expect } from "vitest";
import {
  scheduleSettingsSchema,
  nextScheduledAt,
  periodForOccurrence,
  localTimeToUtc,
} from "../calendar";
const settings = scheduleSettingsSchema.parse({
  cadence: "WEEKLY",
  time: "09:00",
  timezone: "Asia/Kolkata",
  recipients: [" CLIENT@EXAMPLE.COM ", "client@example.com"],
});
describe("scheduled calendar", () => {
  it("normalizes and deduplicates recipients", () =>
    expect(settings.recipients).toEqual(["client@example.com"]));
  it.each([0, 29, 31])("rejects unsupported monthly day %s", (monthDay) =>
    expect(
      scheduleSettingsSchema.safeParse({ ...settings, monthDay }).success,
    ).toBe(false),
  );
  it("rejects invalid timezone and times", () => {
    expect(
      scheduleSettingsSchema.safeParse({ ...settings, timezone: "Delhi" })
        .success,
    ).toBe(false);
    expect(
      scheduleSettingsSchema.safeParse({ ...settings, time: "24:00" }).success,
    ).toBe(false);
  });
  it("schedules in account timezone and skips the current occurrence", () => {
    expect(
      nextScheduledAt(settings, new Date("2026-11-22T12:00Z")).toISOString(),
    ).toBe("2026-11-23T03:30:00.000Z");
    expect(
      nextScheduledAt(settings, new Date("2026-11-23T03:30Z")).toISOString(),
    ).toBe("2026-11-30T03:30:00.000Z");
  });
  it("uses closed days anchored to the occurrence, not worker time", () =>
    expect(
      periodForOccurrence(settings, new Date("2026-11-23T03:30Z")),
    ).toEqual({ startIso: "2026-11-16", endIso: "2026-11-22" }));
  it.each([
    ["2028-03-01T03:30Z", "2028-02-01", "2028-02-29"],
    ["2027-01-01T03:30Z", "2026-12-01", "2026-12-31"],
  ])("covers previous full calendar month %s", (date, startIso, endIso) =>
    expect(
      periodForOccurrence({ ...settings, cadence: "MONTHLY" }, new Date(date)),
    ).toEqual({ startIso, endIso }),
  );
  it("moves a DST gap to the first valid minute", () =>
    expect(
      localTimeToUtc("2027-03-14", "02:30", "America/New_York").toISOString(),
    ).toBe("2027-03-14T07:00:00.000Z"));
  it("chooses the first occurrence of a DST fold", () =>
    expect(
      localTimeToUtc("2026-11-01", "01:30", "America/New_York").toISOString(),
    ).toBe("2026-11-01T05:30:00.000Z"));
});
