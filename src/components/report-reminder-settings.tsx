"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { TIMEZONES } from "@/lib/validators/client";
import { localDate } from "@/lib/report-schedules/calendar";
import {
  firstMonthlyReminder,
  reminderStatus,
  type ReminderView,
} from "@/lib/report-reminders/model";
import { clientActivityDate } from "@/lib/client-card-summary";
import { WizardDatePicker } from "./report-upload-wizard/ui/wizard-date-picker";
const field =
  "mt-1 min-h-11 w-full rounded-lg border border-dash-border bg-dash-bg px-3 py-2 text-sm text-dash-ink";
const button =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-dash-border px-4 py-2 text-sm font-semibold disabled:opacity-50";
export function ReportReminderSettings({
  clientId,
  timezone,
  initial,
  lastSentAt,
  now,
}: {
  clientId: string;
  timezone: string;
  initial: ReminderView | null;
  lastSentAt: string | null;
  now: string;
}) {
  const router = useRouter();
  const defaultDate = new Date(now);
  defaultDate.setUTCDate(defaultDate.getUTCDate() + 7);
  const [cadence, setCadence] = useState(initial?.cadence ?? "WEEKLY");
  const [intervalDays, setIntervalDays] = useState(initial?.intervalDays ?? 7);
  const [monthDay, setMonthDay] = useState(initial?.monthDay ?? 1);
  const [zone, setZone] = useState(initial?.timezone ?? timezone);
  const [date, setDate] = useState(
    initial
      ? localDate(new Date(initial.nextDueAt), initial.timezone)
      : localDate(defaultDate, timezone),
  );
  const [time, setTime] = useState(initial?.time ?? "09:00");
  const [lead, setLead] = useState(initial?.leadDays ?? 0);
  const [email, setEmail] = useState(initial?.emailEnabled ?? false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const monthly = cadence === "MONTHLY_FIXED";
  const monthlyDate =
    monthly &&
    initial?.cadence === cadence &&
    initial.monthDay === monthDay &&
    initial.timezone === zone
      ? localDate(new Date(initial.nextDueAt), zone)
      : localDate(
          firstMonthlyReminder(new Date(now), monthDay, time, zone),
          zone,
        );
  const firstDate = monthly ? monthlyDate : date;
  const summary =
    cadence === "ONCE"
      ? "One reminder on the date you choose."
      : monthly
        ? `Remind me on day ${monthDay} of every month. Shorter months use their last day.`
        : cadence === "MONTHLY"
          ? "Monthly after the last report is sent. Choose a day each month above for a fixed monthly alarm."
          : `Remind me ${cadence === "WEEKLY" ? 7 : cadence === "FORTNIGHTLY" ? 14 : intervalDays} days after I send a report. The first reminder starts on the date below.`;
  async function action(body: unknown, message: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/clients/${clientId}/report-reminder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok)
        throw Error(result.error ?? "Could not update reminder.");
      setNotice(message);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update reminder.");
    } finally {
      setBusy(false);
    }
  }
  const hour = Number(time.slice(0, 2));
  return (
    <div className="mt-5 space-y-4">
      <form
        className="space-y-5 rounded-xl border border-dash-border bg-dash-card p-5 sm:p-6"
        onSubmit={(e) => {
          e.preventDefault();
          void action(
            {
              action: "save",
              settings: {
                cadence,
                intervalDays,
                ...(monthly ? { monthDay } : {}),
                firstDate,
                time,
                timezone: zone,
                leadDays: lead,
                emailEnabled: email,
                enabled: true,
              },
            },
            "Reminder saved. You’ll see it on My Clients.",
          );
        }}
      >
        <div>
          <h2 className="text-lg font-semibold">
            When would you like a reminder?
          </h2>
          <p className="mt-1 text-sm text-dash-ink-secondary">
            An alarm for you to send this client a report. It won’t create or
            send a report.
          </p>
        </div>
        <label className="block text-sm font-medium">
          Remind me
          <select
            aria-label="Remind me"
            className={field}
            value={cadence}
            onChange={(e) => setCadence(e.target.value)}
          >
            <option value="WEEKLY">Every 7 days</option>
            <option value="FORTNIGHTLY">Every 14 days</option>
            <option value="MONTHLY_FIXED">On a day each month</option>
            <option value="CUSTOM">Every X days</option>
            <option value="ONCE">On a specific date · once</option>
            {cadence === "MONTHLY" && (
              <option value="MONTHLY">
                Monthly after sending · existing reminder
              </option>
            )}
          </select>
        </label>
        <p className="text-sm text-dash-ink-secondary">{summary}</p>
        <div className="grid gap-5 sm:grid-cols-2">
          {cadence === "CUSTOM" && (
            <label className="text-sm font-medium">
              How many days apart?
              <input
                aria-label="Days between reminders"
                className={field}
                type="number"
                min="1"
                max="365"
                required
                value={intervalDays}
                onChange={(e) => setIntervalDays(Number(e.target.value))}
              />
            </label>
          )}
          {monthly ? (
            <label className="text-sm font-medium">
              Day of the month
              <select
                className={field}
                value={monthDay}
                onChange={(e) => setMonthDay(Number(e.target.value))}
              >
                {Array.from({ length: 31 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <WizardDatePicker
              label={cadence === "ONCE" ? "Remind me on" : "First reminder on"}
              value={date}
              onChange={setDate}
              showYear
            />
          )}
          <fieldset>
            <legend className="text-sm font-medium">At what time?</legend>
            <div className="mt-1 flex min-h-11 items-center gap-2 rounded-lg border border-dash-border bg-dash-bg px-3 py-2">
              <svg
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-dash-ink-secondary"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
              <select
                aria-label="Reminder hour"
                className="min-h-8 flex-1 bg-dash-bg text-sm text-dash-ink"
                value={hour % 12 || 12}
                onChange={(e) =>
                  setTime(
                    String(
                      (Number(e.target.value) % 12) + (hour >= 12 ? 12 : 0),
                    ).padStart(2, "0") + time.slice(2),
                  )
                }
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {String(i + 1).padStart(2, "0")}
                  </option>
                ))}
              </select>
              <span aria-hidden="true">:</span>
              <select
                aria-label="Reminder minute"
                className="min-h-8 flex-1 bg-dash-bg text-sm text-dash-ink"
                value={time.slice(3)}
                onChange={(e) => setTime(time.slice(0, 3) + e.target.value)}
              >
                {Array.from({ length: 60 }, (_, i) => (
                  <option key={i} value={String(i).padStart(2, "0")}>
                    {String(i).padStart(2, "0")}
                  </option>
                ))}
              </select>
              <select
                aria-label="AM or PM"
                className="min-h-8 flex-1 bg-dash-bg text-sm text-dash-ink"
                value={hour >= 12 ? "PM" : "AM"}
                onChange={(e) =>
                  setTime(
                    String(
                      (hour % 12) + (e.target.value === "PM" ? 12 : 0),
                    ).padStart(2, "0") + time.slice(2),
                  )
                }
              >
                <option>AM</option>
                <option>PM</option>
              </select>
            </div>
          </fieldset>
        </div>
        <p className="rounded-lg border border-dash-border bg-dash-bg px-3 py-3 text-sm">
          {monthly ? "Next reminder" : "Reminder starts"}:{" "}
          <strong>
            {clientActivityDate(firstDate + "T12:00:00Z", "UTC", false)}
          </strong>{" "}
          · {String(hour % 12 || 12).padStart(2, "0")}:{time.slice(3)}{" "}
          {hour >= 12 ? "PM" : "AM"}{" "}
          <span className="text-dash-ink-secondary">({zone})</span>
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={email}
            onChange={(e) => setEmail(e.target.checked)}
          />
          Also remind me by email
        </label>
        <p className="text-xs text-dash-ink-secondary">
          Always shown on My Clients. Optional emails go to you, never to the
          client.
        </p>
        <details className="rounded-lg border border-dash-border p-3">
          <summary className="cursor-pointer text-sm font-medium">
            More options
          </summary>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              Time zone
              <select
                aria-label="Time zone"
                className={field}
                value={zone}
                onChange={(e) => setZone(e.target.value)}
              >
                {[...new Set([timezone, zone, ...TIMEZONES])].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Show on my dashboard
              <select
                className={field}
                value={lead}
                onChange={(e) => setLead(Number(e.target.value))}
              >
                {[0, 1, 2, 3, 7, 14].map((n) => (
                  <option key={n} value={n}>
                    {n === 0
                      ? "On the reminder date"
                      : `${n} ${n === 1 ? "day" : "days"} before`}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="mt-3 text-xs text-dash-ink-secondary">
            Emails arrive around the selected time. You may also get an advance
            email if selected above, and one follow-up if overdue.
          </p>
        </details>
        <button
          disabled={busy}
          className={`${button} bg-dash-accent text-[#102033]`}
        >
          {busy
            ? "Saving…"
            : initial && !initial.enabled
              ? "Save & turn on reminder"
              : "Save reminder"}
        </button>
      </form>
      {initial && (
        <section className="rounded-xl border border-dash-border p-4">
          <p className="text-sm font-medium">
            {reminderStatus(initial, new Date(now)).label}
          </p>
          {lastSentAt && (
            <p className="mt-1 text-xs text-dash-ink-secondary">
              Last sent:{" "}
              {clientActivityDate(lastSentAt, initial.timezone, true)}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy}
              className={button}
              onClick={() =>
                void action({ action: "sent" }, "Report marked as sent.")
              }
            >
              I sent the report today
            </button>
            <button
              type="button"
              disabled={busy}
              className={button}
              onClick={() =>
                void action(
                  { action: "toggle", enabled: !initial.enabled },
                  initial.enabled ? "Reminder paused." : "Reminder resumed.",
                )
              }
            >
              {initial.enabled ? "Pause reminder" : "Resume reminder"}
            </button>
          </div>
          <p className="mt-2 text-xs text-dash-ink-secondary">
            Sent outside NextReport? Mark it here to clear this reminder.
            {cadence !== "ONCE" &&
              " Day intervals restart after sending; fixed monthly alarms keep their chosen day."}
          </p>
        </section>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-dash-ink-secondary">
          {notice}
        </p>
      )}
    </div>
  );
}
