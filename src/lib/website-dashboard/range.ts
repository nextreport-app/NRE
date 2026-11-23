import { ServiceError } from "../service-error";
import { z } from "zod";
import { reportCalendarYesterday } from "../nre/report-period-selection";
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const n = Date.parse(s + "T12:00:00Z");
    return Number.isFinite(n) && new Date(n).toISOString().slice(0, 10) === s;
  }, "Choose a valid date.");
export const customWebsiteRangeSchema = z
  .object({ startIso: date, endIso: date })
  .refine((r) => {
    const days = (Date.parse(r.endIso) - Date.parse(r.startIso)) / 86400000 + 1;
    return days >= 1 && days <= 90;
  }, "Choose between 1 and 90 days.");
export type WebsiteRange = 7 | 30 | z.infer<typeof customWebsiteRangeSchema>;
export const websiteRangeKey = (range: WebsiteRange) =>
  typeof range === "number" ? range : 0;
export function customWebsitePeriods(
  input: Exclude<WebsiteRange, number>,
  timezone: string,
  now = new Date(),
) {
  const range = customWebsiteRangeSchema.parse(input);
  if (range.endIso > reportCalendarYesterday(now, timezone))
    throw new ServiceError(
      "Choose completed dates before today in the GA4 property timezone.",
    );
  const days =
    Math.round(
      (Date.parse(range.endIso) - Date.parse(range.startIso)) / 86400000,
    ) + 1;
  const shift = (date: string, n: number) =>
    new Date(Date.parse(date + "T12:00:00Z") + n * 86400000)
      .toISOString()
      .slice(0, 10);
  return {
    days,
    currentPeriod: range,
    previousPeriod: {
      startIso: shift(range.startIso, -days),
      endIso: shift(range.startIso, -1),
    },
  };
}
