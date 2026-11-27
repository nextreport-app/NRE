"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { TIMEZONES } from "@/lib/validators/client";
import { localDate } from "@/lib/report-schedules/calendar";
import {
  reminderStatus,
  type ReminderView,
} from "@/lib/report-reminders/model";
import { clientActivityDate } from "@/lib/client-card-summary";
const field =
  "mt-1 min-h-11 w-full rounded-lg border border-dash-border bg-dash-bg px-3 py-2 text-sm";
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
  const [cadence, setCadence] = useState(initial?.cadence ?? "WEEKLY"),
    [intervalDays, setIntervalDays] = useState(initial?.intervalDays ?? 7),
    [zone, setZone] = useState(initial?.timezone ?? timezone),
    [date, setDate] = useState(
      initial
        ? localDate(new Date(initial.nextDueAt), initial.timezone)
        : localDate(defaultDate, timezone),
    ),
    [time, setTime] = useState(initial?.time ?? "09:00"),
    [lead, setLead] = useState(initial?.leadDays ?? 2),
    [email, setEmail] = useState(initial?.emailEnabled ?? false),
    [enabled, setEnabled] = useState(initial?.enabled ?? true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
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
  return (
    <div className="mt-5 space-y-5">
      <section className="rounded-xl border border-dash-border bg-dash-card p-5">
        <h2 className="font-semibold">Report delivery</h2>
        <p className="mt-2 text-sm text-dash-ink-secondary">
          Last confirmed sent:{" "}
          {lastSentAt
            ? clientActivityDate(
                lastSentAt,
                initial?.timezone ?? timezone,
                true,
              )
            : "No send recorded yet"}
        </p>
        {initial && (
          <p className="mt-2 text-sm font-medium text-dash-accent">
            {reminderStatus(initial, new Date(now)).label} ·{" "}
            {clientActivityDate(initial.nextDueAt, initial.timezone, true)} (
            {initial.timezone})
          </p>
        )}
        <p className="mt-2 text-sm text-dash-ink-secondary">
          Sent it by WhatsApp, personal email or another tool? Mark it as sent
          here to reset the reminder. Generating or downloading alone does not
          count as sending.
        </p>
        <button
          type="button"
          className={`${button} mt-4`}
          disabled={busy}
          onClick={() =>
            void action(
              { action: "sent" },
              "Report marked as sent. The next reminder has been updated.",
            )
          }
        >
          Mark as sent today
        </button>
      </section>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void action(
            {
              action: "save",
              settings: {
                cadence,
                intervalDays,
                firstDate: date,
                time,
                timezone: zone,
                leadDays: lead,
                emailEnabled: email,
                enabled,
              },
            },
            "Reminder saved.",
          );
        }}
        className="space-y-4 rounded-xl border border-dash-border bg-dash-card p-5"
      >
        <h2 className="font-semibold">When should the next report be sent?</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            Repeat
            <select
              aria-label="Reminder frequency"
              className={field}
              value={cadence}
              onChange={(e) => setCadence(e.target.value)}
            >
              <option value="WEEKLY">Every 7 days</option>
              <option value="FORTNIGHTLY">Every 14 days</option>
              <option value="MONTHLY">Monthly</option>
              <option value="CUSTOM">Custom interval</option>
            </select>
          </label>
          {cadence === "CUSTOM" && (
            <label className="text-sm">
              Every X days
              <input
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
          <label className="text-sm">
            Next due date
            <input
              className={field}
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className="text-sm">
            Reminder time
            <input
              className={field}
              type="time"
              required
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </label>
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
            Show approaching reminder
            <select
              className={field}
              value={lead}
              onChange={(e) => setLead(Number(e.target.value))}
            >
              {[0, 1, 2, 3, 7, 14].map((n) => (
                <option key={n} value={n}>
                  {n === 0 ? "On the due date" : `${n} days before`}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex gap-2 text-sm">
          <input
            type="checkbox"
            checked={email}
            onChange={(e) => setEmail(e.target.checked)}
          />
          Email reminders to my account email
        </label>
        <p className="text-xs text-dash-ink-secondary">
          With a verified, active account, emails are sent once when
          approaching, once when due and once if overdue. Hourly checks use the
          time zone above. These are reminders to you; they never send a report
          to the client automatically.
        </p>
        <label className="flex gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Reminder enabled
        </label>
        <p className="text-xs text-dash-ink-secondary">
          Sending through NextReport or marking as sent resets the next
          reminder. Day intervals start from the sent date; monthly reminders
          repeat from the sent day of the month, using the last day of shorter
          months.
        </p>
        <button
          disabled={busy}
          className={`${button} bg-dash-accent text-[#102033]`}
        >
          {busy ? "Saving…" : "Save reminder"}
        </button>
      </form>
      {initial && (
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
