"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  reminderStatus,
  type ReminderView,
} from "@/lib/report-reminders/model";
import { clientActivityDate } from "@/lib/client-card-summary";
export function ReminderLabel({
  reminder,
  now,
}: {
  reminder: ReminderView;
  now: string;
}) {
  const status = reminderStatus(reminder, new Date(now));
  return (
    <span
      className={`font-medium ${status.state === "overdue" ? "text-red-400" : status.state === "today" ? "text-dash-accent" : "text-dash-ink-secondary"}`}
    >
      {status.label}
    </span>
  );
}
export function ReportReminderDashboard({
  items,
  now,
}: {
  items: Array<{
    id: string;
    accountName: string;
    reminder: ReminderView | null;
  }>;
  now: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null),
    [error, setError] = useState(""),
    [completed, setCompleted] = useState<string[]>([]);
  const enabled = items
    .filter((item) => item.reminder?.enabled)
    .sort(
      (a, b) =>
        Date.parse(a.reminder!.nextDueAt) - Date.parse(b.reminder!.nextDueAt),
    );
  const due = enabled.filter(
    (item) =>
      !completed.includes(`${item.id}:${item.reminder!.nextDueAt}`) &&
      ["overdue", "today", "approaching"].includes(
        reminderStatus(item.reminder!, new Date(now)).state,
      ),
  );
  async function sent(item: (typeof items)[number]) {
    if (busy) return;
    setBusy(item.id);
    setError("");
    try {
      const response = await fetch(`/api/clients/${item.id}/report-reminder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sent" }),
      });
      const result = await response.json();
      if (!response.ok)
        throw Error(result.error ?? "Could not mark the report as sent.");
      setCompleted((old) => [...old, `${item.id}:${item.reminder!.nextDueAt}`]);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update reminder.");
    } finally {
      setBusy(null);
    }
  }
  if (!enabled.length)
    return (
      <section
        aria-label="Report reminders"
        className="mb-5 rounded-xl border border-dash-border bg-dash-card p-4"
      >
        <h2 className="font-semibold">Report reminders</h2>
        <p className="mt-1 text-sm text-dash-ink-secondary">
          Set a reminder from a client’s <strong>Client tasks</strong> menu to
          keep track of when to send their next report.
        </p>
      </section>
    );
  return (
    <section
      aria-label="Report reminders"
      className="mb-5 rounded-xl border border-dash-border bg-dash-card p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Report reminders</h2>
        <span className="text-xs text-dash-ink-secondary">
          {due.length} need attention · {enabled.length} active reminders
        </span>
      </div>
      {!due.length ? (
        <p className="mt-3 text-sm text-dash-ink-secondary">
          You’re up to date. Next report due{" "}
          {clientActivityDate(
            enabled[0].reminder!.nextDueAt,
            enabled[0].reminder!.timezone,
          )}{" "}
          for {enabled[0].accountName}.
        </p>
      ) : (
        <ul className="mt-3 max-h-96 divide-y divide-dash-border overflow-y-auto">
          {due.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div className="min-w-0">
                <Link
                  className="break-words font-semibold hover:underline"
                  href={`/clients/${item.id}/reminders`}
                >
                  {item.accountName}
                </Link>
                <p className="mt-1 text-sm">
                  <ReminderLabel reminder={item.reminder!} now={now} />
                  <span className="ml-2 text-xs text-dash-ink-secondary">
                    {clientActivityDate(
                      item.reminder!.nextDueAt,
                      item.reminder!.timezone,
                      true,
                    )}{" "}
                    · {item.reminder!.timezone}
                  </span>
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-sm">
                <Link
                  className="inline-flex min-h-11 items-center rounded-lg bg-dash-accent px-3 font-semibold text-[#102033]"
                  href={`/clients/${item.id}/reports/new`}
                >
                  Generate report
                </Link>
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => void sent(item)}
                  className="min-h-11 rounded-lg border border-dash-border px-3 disabled:opacity-50"
                >
                  {busy === item.id ? "Updating…" : "Mark as sent"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {error}
        </p>
      )}
    </section>
  );
}
