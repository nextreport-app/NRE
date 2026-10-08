/**
 * Client-timezone calendar facts for wizard CSV guidance (Import step).
 */

import { getCalendarDateInTimezone, type ParsedDate } from "./dates";

export interface WizardCalendarContext {
  today: ParsedDate;
  /** Client's calendar day-of-month (1–31). */
  dayOfMonth: number;
  isFirstDayOfMonth: boolean;
  isSecondDayOfMonth: boolean;
  isLastDayOfMonth: boolean;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function getWizardCalendarContext(now: Date, timezone: string): WizardCalendarContext {
  const today = getCalendarDateInTimezone(now, timezone);
  const dim = daysInMonth(today.year, today.month);
  return {
    today,
    dayOfMonth: today.day,
    isFirstDayOfMonth: today.day === 1,
    isSecondDayOfMonth: today.day === 2,
    isLastDayOfMonth: today.day === dim,
  };
}
