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

it("prepares daily at the local time and reports only yesterday", () => {
  const daily = { ...settings, cadence: "DAILY" as const };
  expect(
    nextScheduledAt(daily, new Date("2026-11-23T03:30Z")).toISOString(),
  ).toBe("2026-11-24T03:30:00.000Z");
  expect(periodForOccurrence(daily, new Date("2026-11-23T03:30Z"))).toEqual({
    startIso: "2026-11-22",
    endIso: "2026-11-22",
  });
});
it("requires a valid anchor for fortnightly and rejects unsupported budget cover", () => {
  expect(
    scheduleSettingsSchema.safeParse({ ...settings, cadence: "FORTNIGHTLY" })
      .success,
  ).toBe(false);
  expect(
    scheduleSettingsSchema.safeParse({
      ...settings,
      cadence: "FORTNIGHTLY",
      anchorDate: "2026-02-30",
    }).success,
  ).toBe(false);
  expect(
    scheduleSettingsSchema.safeParse({
      ...settings,
      cadence: "DAILY",
      showBudget: true,
    }).success,
  ).toBe(false);
});
it("anchors every 14 local days without gaps over month/year boundaries", () => {
  const fortnightly = scheduleSettingsSchema.parse({
    ...settings,
    cadence: "FORTNIGHTLY",
    anchorDate: "2026-12-23",
  });
  const a = nextScheduledAt(fortnightly, new Date("2026-12-01T00:00Z"));
  const b = nextScheduledAt(fortnightly, a);
  expect(a.toISOString()).toBe("2026-12-23T03:30:00.000Z");
  expect(b.toISOString()).toBe("2027-01-06T03:30:00.000Z");
  expect(periodForOccurrence(fortnightly, a)).toEqual({
    startIso: "2026-12-09",
    endIso: "2026-12-22",
  });
  expect(periodForOccurrence(fortnightly, b)).toEqual({
    startIso: "2026-12-23",
    endIso: "2027-01-05",
  });
});
it("keeps fortnightly local time across DST, rather than adding 336 UTC hours", () => {
  const fortnightly = scheduleSettingsSchema.parse({
    ...settings,
    cadence: "FORTNIGHTLY",
    anchorDate: "2027-03-07",
    timezone: "America/New_York",
  });
  const a = nextScheduledAt(fortnightly, new Date("2027-03-06T00:00Z")),
    b = nextScheduledAt(fortnightly, a);
  expect(a.toISOString()).toBe("2027-03-07T14:00:00.000Z");
  expect(b.toISOString()).toBe("2027-03-21T13:00:00.000Z");
});
it("resolves the latest occurrence directly after more than 400 daily cycles", async () => {
  const { latestScheduledAt } = await import("../calendar");
  const daily = { ...settings, cadence: "DAILY" as const };
  expect(
    latestScheduledAt(
      daily,
      new Date("2020-01-01T00:00Z"),
      new Date("2026-11-23T12:00Z"),
    ).toISOString(),
  ).toBe("2026-11-23T03:30:00.000Z");
  expect(
    latestScheduledAt(
      daily,
      new Date("2020-01-01T00:00Z"),
      new Date("2026-11-23T02:00Z"),
    ).toISOString(),
  ).toBe("2026-11-22T03:30:00.000Z");
});
it("supports daily and fortnightly DST gaps/folds with one occurrence per local day", () => {
  const daily = {
    ...settings,
    cadence: "DAILY" as const,
    timezone: "America/New_York",
    time: "02:30",
  };
  expect(
    nextScheduledAt(daily, new Date("2027-03-14T00:00Z")).toISOString(),
  ).toBe("2027-03-14T07:00:00.000Z");
  const fold = { ...daily, time: "01:30" };
  expect(
    nextScheduledAt(fold, new Date("2026-11-01T05:30Z")).toISOString(),
  ).toBe("2026-11-02T06:30:00.000Z");
});
