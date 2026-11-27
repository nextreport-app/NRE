import { describe, it, expect } from "vitest";
import {
  reminderSettingsSchema,
  reminderStatus,
  reminderEmailStage,
  nextReminderAt,
  nextCycleMonthDay,
  reminderFirstDue,
} from "../model";
const base = {
  enabled: true,
  cadence: "WEEKLY",
  intervalDays: 7,
  monthDay: 31,
  time: "09:00",
  timezone: "America/New_York",
  leadDays: 2,
  nextDueAt: "2026-11-27T14:00:00Z",
};
describe("report reminder calendar", () => {
  it("separates approaching, today and overdue in the reminder's local calendar", () => {
    expect(reminderStatus(base, new Date("2026-11-25T14:00Z")).state).toBe(
      "approaching",
    );
    expect(reminderStatus(base, new Date("2026-11-27T01:00Z")).label).toBe(
      "Report due in 1 day",
    );
    expect(reminderStatus(base, new Date("2026-11-27T15:00Z")).state).toBe(
      "today",
    );
    expect(reminderStatus(base, new Date("2026-11-29T15:00Z")).label).toBe(
      "2 days overdue",
    );
    expect(reminderStatus({ ...base, enabled: false }).state).toBe("paused");
  });
  it("waits for local email time and sends no overdue email before the next local day", () => {
    expect(reminderEmailStage(base, new Date("2026-11-25T13:59Z"))).toBeNull();
    expect(reminderEmailStage(base, new Date("2026-11-25T14:00Z"))).toBe(
      "approaching",
    );
    expect(reminderEmailStage(base, new Date("2026-11-27T13:59Z"))).toBeNull();
    expect(reminderEmailStage(base, new Date("2026-11-27T14:00Z"))).toBe("due");
    expect(reminderEmailStage(base, new Date("2026-11-28T14:00Z"))).toBe(
      "overdue",
    );
    expect(
      reminderEmailStage(
        { ...base, enabled: false },
        new Date("2026-11-28T14:00Z"),
      ),
    ).toBeNull();
  });
  it("keeps local clock time across DST and handles biweekly/custom intervals", () => {
    const spring = { ...base, timezone: "America/New_York", time: "09:00" };
    expect(
      nextReminderAt(spring, new Date("2026-03-01T15:00Z")).toISOString(),
    ).toBe("2026-03-08T13:00:00.000Z");
    expect(
      nextReminderAt(
        { ...base, cadence: "FORTNIGHTLY" },
        new Date("2026-11-27T15:00Z"),
      ).toISOString(),
    ).toBe("2026-12-11T14:00:00.000Z");
    expect(
      nextReminderAt(
        { ...base, cadence: "CUSTOM", intervalDays: 10 },
        new Date("2026-11-27T15:00Z"),
      ).toISOString(),
    ).toBe("2026-12-07T14:00:00.000Z");
  });
  it("clamps monthly 31st to February and preserves 31st when sent on time", () => {
    const january = {
      ...base,
      cadence: "MONTHLY",
      nextDueAt: "2027-01-31T14:00Z",
    };
    const feb = nextReminderAt(january, new Date("2027-01-31T15:00Z"));
    expect(feb.toISOString()).toBe("2027-02-28T14:00:00.000Z");
    expect(
      nextReminderAt(
        { ...january, nextDueAt: feb },
        new Date("2027-02-28T15:00Z"),
      ).toISOString(),
    ).toBe("2027-03-31T13:00:00.000Z");
    expect(
      nextCycleMonthDay(
        { ...january, nextDueAt: feb },
        new Date("2027-03-01T15:00Z"),
      ),
    ).toBe(1);
  });
  it("validates dates, time zones and intervals; resolves skipped DST times safely", () => {
    const settings = {
      cadence: "CUSTOM",
      firstDate: "2026-03-08",
      time: "02:30",
      timezone: "America/New_York",
      intervalDays: 3,
    };
    expect(
      reminderSettingsSchema.safeParse({ ...settings, intervalDays: 0 })
        .success,
    ).toBe(false);
    expect(
      reminderSettingsSchema.safeParse({ ...settings, firstDate: "2026-02-30" })
        .success,
    ).toBe(false);
    expect(
      reminderSettingsSchema.safeParse({ ...settings, timezone: "not/a-zone" })
        .success,
    ).toBe(false);
    expect(
      reminderSettingsSchema.safeParse({
        ...settings,
        emailEnabled: true,
        recipients: ["outsider@example.com"],
      }).success,
    ).toBe(false);
    expect(
      reminderFirstDue(reminderSettingsSchema.parse(settings)).toISOString(),
    ).toBe("2026-03-08T07:00:00.000Z");
  });
});
