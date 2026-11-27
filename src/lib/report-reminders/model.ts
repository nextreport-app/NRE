import { z } from "zod";
import { localDate, localTimeToUtc } from "../report-schedules/calendar";
export const reminderSettingsSchema = z
  .object({
    cadence: z.enum(["WEEKLY", "FORTNIGHTLY", "MONTHLY", "CUSTOM"]),
    intervalDays: z.number().int().min(1).max(365).default(7),
    firstDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine(
        (value) =>
          Number.isFinite(Date.parse(value + "T12:00:00Z")) &&
          new Date(value + "T12:00:00Z").toISOString().slice(0, 10) === value,
        "Choose a valid first due date.",
      ),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    timezone: z
      .string()
      .max(100)
      .refine((value) => {
        try {
          new Intl.DateTimeFormat("en", { timeZone: value });
          return true;
        } catch {
          return false;
        }
      }, "Choose a valid timezone."),
    leadDays: z.number().int().min(0).max(14).default(2),
    emailEnabled: z.boolean().default(false),
    enabled: z.boolean().default(true),
  })
  .strict();
export type ReminderSettings = z.infer<typeof reminderSettingsSchema>;
export interface ReminderTiming {
  cadence: string;
  intervalDays: number;
  monthDay: number;
  time: string;
  timezone: string;
  nextDueAt: Date | string;
  leadDays: number;
  enabled: boolean;
}
const dayNumber = (date: string) => Date.parse(date + "T12:00Z") / 86400000;
export function reminderStatus(r: ReminderTiming, now = new Date()) {
  const due = new Date(r.nextDueAt);
  const days = Math.round(
    dayNumber(localDate(due, r.timezone)) -
      dayNumber(localDate(now, r.timezone)),
  );
  const state = !r.enabled
    ? "paused"
    : days < 0
      ? "overdue"
      : days === 0
        ? "today"
        : days <= r.leadDays
          ? "approaching"
          : "upcoming";
  return {
    state,
    days,
    label:
      state === "paused"
        ? "Reminder paused"
        : days < 0
          ? `${Math.abs(days)} ${days === -1 ? "day" : "days"} overdue`
          : days === 0
            ? "Report due today"
            : `Report due in ${days} ${days === 1 ? "day" : "days"}`,
  };
}
export function reminderEmailStage(r: ReminderTiming, now = new Date()) {
  const status = reminderStatus(r, now);
  if (status.state === "overdue")
    return now >= localTimeToUtc(localDate(now, r.timezone), r.time, r.timezone)
      ? "overdue"
      : null;
  if (status.state === "today" && now >= new Date(r.nextDueAt)) return "due";
  if (status.state === "approaching") {
    // Send the advance reminder at the chosen local clock time too.
    const today = localDate(now, r.timezone);
    if (now >= localTimeToUtc(today, r.time, r.timezone)) return "approaching";
  }
  return null;
}
export function nextReminderAt(
  r: Pick<
    ReminderTiming,
    "cadence" | "intervalDays" | "monthDay" | "time" | "timezone"
  > & { nextDueAt?: Date | string },
  sentAt: Date,
) {
  const today = localDate(sentAt, r.timezone);
  const date = new Date(today + "T12:00Z");
  if (r.cadence === "MONTHLY") {
    const month = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 12),
    );
    const last = new Date(
      Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0),
    ).getUTCDate();
    month.setUTCDate(Math.min(nextCycleMonthDay(r, sentAt), last));
    return localTimeToUtc(month.toISOString().slice(0, 10), r.time, r.timezone);
  }
  date.setUTCDate(
    date.getUTCDate() +
      (r.cadence === "WEEKLY"
        ? 7
        : r.cadence === "FORTNIGHTLY"
          ? 14
          : r.intervalDays),
  );
  return localTimeToUtc(date.toISOString().slice(0, 10), r.time, r.timezone);
}
export function reminderFirstDue(settings: ReminderSettings) {
  return localTimeToUtc(settings.firstDate, settings.time, settings.timezone);
}
export function reminderView(r: ReminderTiming & { emailEnabled: boolean }) {
  return {
    enabled: r.enabled,
    emailEnabled: r.emailEnabled,
    cadence: r.cadence,
    intervalDays: r.intervalDays,
    monthDay: r.monthDay,
    time: r.time,
    timezone: r.timezone,
    leadDays: r.leadDays,
    nextDueAt: new Date(r.nextDueAt).toISOString(),
  };
}
export type ReminderView = ReturnType<typeof reminderView>;

export function nextCycleMonthDay(
  r: { monthDay: number; timezone: string; nextDueAt?: Date | string },
  sentAt: Date,
) {
  const sent = localDate(sentAt, r.timezone);
  return r.nextDueAt && localDate(new Date(r.nextDueAt), r.timezone) === sent
    ? r.monthDay
    : Number(sent.slice(-2));
}
