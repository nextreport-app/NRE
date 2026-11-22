import { z } from "zod";
import { getCalendarDateInTimezone } from "../nre/dates";
export const scheduleSettingsSchema = z.object({
  cadence: z.enum(["WEEKLY", "MONTHLY"]),
  weekday: z.number().int().min(0).max(6).default(1),
  monthDay: z.number().int().min(1).max(28).default(1),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  timezone: z.string().refine((value) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "Choose a valid timezone"),
  campaignNames: z
    .array(z.string().trim().min(1).max(250))
    .max(100)
    .default([]),
  showBudget: z.boolean().default(false),
  recipients: z
    .array(z.string().trim().toLowerCase().email())
    .min(1)
    .max(5)
    .transform((values) => [...new Set(values)]),
});
export type ScheduleSettings = z.infer<typeof scheduleSettingsSchema>;
export function localDate(now: Date, timezone: string) {
  const d = getCalendarDateInTimezone(now, timezone);
  return `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
}
const dayShift = (iso: string, days: number) =>
  new Date(Date.parse(iso + "T12:00:00Z") + days * 86400000)
    .toISOString()
    .slice(0, 10);
function localKey(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (key: string) => parts.find((p) => p.type === key)!.value;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
/** DST folds use the first occurrence; nonexistent local times move to the first valid minute afterwards. */
export function localTimeToUtc(
  dateIso: string,
  time: string,
  timezone: string,
): Date {
  const key = `${dateIso}T${time}`,
    target = Date.parse(key + ":00Z");
  const offsets = new Set<number>();
  for (const delta of [-86400000, 0, 86400000]) {
    const at = new Date(target + delta);
    offsets.add(Date.parse(localKey(at, timezone) + ":00Z") - at.getTime());
  }
  const matches = [...offsets]
    .map((offset) => new Date(target - offset))
    .filter((at) => localKey(at, timezone) === key)
    .sort((a, b) => a.getTime() - b.getTime());
  if (matches.length) return matches[0];
  const low = target - Math.max(...offsets) - 3 * 3600000,
    high = target - Math.min(...offsets) + 3 * 3600000;
  for (let ms = low; ms <= high; ms += 60000) {
    const local = localKey(new Date(ms), timezone);
    if (local.slice(0, 10) === dateIso && local >= key) return new Date(ms);
  }
  throw Error("Could not resolve the scheduled local time.");
}
export function nextScheduledAt(
  settings: ScheduleSettings,
  after = new Date(),
): Date {
  const today = localDate(after, settings.timezone);
  for (let i = 0; i < 370; i++) {
    const date = dayShift(today, i),
      d = new Date(date + "T12:00Z");
    if (
      settings.cadence === "WEEKLY"
        ? d.getUTCDay() !== settings.weekday
        : d.getUTCDate() !== settings.monthDay
    )
      continue;
    const candidate = localTimeToUtc(date, settings.time, settings.timezone);
    if (candidate > after) return candidate;
  }
  throw Error("No upcoming occurrence could be calculated.");
}
export function periodForOccurrence(settings: ScheduleSettings, dueAt: Date) {
  const date = localDate(dueAt, settings.timezone);
  if (settings.cadence === "WEEKLY")
    return { startIso: dayShift(date, -7), endIso: dayShift(date, -1) };
  const end = new Date(date.slice(0, 7) + "-01T12:00Z");
  end.setUTCDate(0);
  return {
    startIso: end.toISOString().slice(0, 7) + "-01",
    endIso: end.toISOString().slice(0, 10),
  };
}
