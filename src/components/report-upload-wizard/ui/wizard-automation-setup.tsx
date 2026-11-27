"use client";
import { hasCompleteAutomationConfiguration } from "@/lib/report-schedules/wizard-options";
import Link from "next/link";
import { useState } from "react";
import { useWizardContext } from "../wizard-context";
const field =
  "mt-1 block min-h-11 w-full rounded-xl border border-dash-border bg-dash-bg px-3 py-2 text-sm text-dash-ink";
const weekdays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
export function WizardAutomationSetup() {
  const w = useWizardContext();
  const initial = w.automationSettings;
  const [day, setDay] = useState(
    initial
      ? initial.cadence === "WEEKLY"
        ? initial.weekday
        : initial.monthDay
      : 1,
  );
  const [time, setTime] = useState(initial?.time ?? "09:00");
  const [recipients, setRecipients] = useState(
    initial?.recipients.join(", ") ?? "",
  );
  const [reviewedReport, setReviewedReport] = useState<string | null>(null);
  const [saving, setSaving] = useState(false),
    [savedReportId, setSavedReportId] = useState<string | null>(null),
    [error, setError] = useState("");
  if (!w.automationCadence) return null;
  const saved = !!w.reportId && savedReportId === w.reportId;
  const monthly = w.automationCadence === "MONTHLY";
  const generated = w.step === 4 && w.generateStatus === "done" && !!w.reportId;
  const ready =
    generated &&
    !!w.automationReportConfiguration &&
    hasCompleteAutomationConfiguration(w.automationReportConfiguration) &&
    !w.generatedWithCsvMismatch &&
    !w.generatedWithCsvVerifySkipped;
  const summary = monthly
    ? `On day ${day} of each month at ${time}`
    : `Every ${weekdays[day]} at ${time}`;
  async function save() {
    if (
      !ready ||
      reviewedReport !== w.reportId ||
      saving ||
      !w.automationReportConfiguration
    )
      return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        `/api/clients/${w.clientId}/report-schedules`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "saveAutomation",
            sampleReportId: w.reportId,
            reviewed: true,
            settings: {
              cadence: w.automationCadence,
              weekday: monthly ? 1 : day,
              monthDay: monthly ? day : 1,
              time,
              timezone: w.clientTimezone,
              recipients: recipients
                .split(/[,;\n]/)
                .map((v) => v.trim())
                .filter(Boolean),
              ...w.automationReportConfiguration,
            },
          }),
        },
      );
      const result = await response.json();
      if (!response.ok)
        throw Error(
          result.error ?? "Could not save automation. Please try again.",
        );
      setSavedReportId(w.reportId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save automation.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <section
      aria-label="Automation setup"
      className="rounded-2xl border border-dash-border bg-dash-card p-5 sm:p-6"
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-dash-ink-secondary">
        Automate reporting
      </p>
      <h2 className="mt-1 text-lg font-semibold">
        {monthly ? "Monthly report" : "Weekly report"} · set up once
      </h2>
      <p className="mt-2 text-sm text-dash-ink-secondary">
        {monthly
          ? "Each report covers last month’s results."
          : "Each report covers the last 7 days."}{" "}
        Choose campaigns, confirm objectives and finalize metrics below. Future
        reports reuse these choices with fresh Meta Ads data.
      </p>
      {(w.step === 1 || ready) && !saved ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            {monthly ? "Day of the month" : "Every"}
            <select
              aria-label="Automation day"
              className={field}
              value={day}
              disabled={saving}
              onChange={(e) => {
                setDay(Number(e.target.value));
                setReviewedReport(null);
              }}
            >
              {(monthly
                ? Array.from({ length: 28 }, (_, i) => String(i + 1))
                : weekdays
              ).map((value, i) => (
                <option key={value} value={monthly ? i + 1 : i}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend className="text-sm">Time · 24-hour</legend>
            <div className="mt-1 flex min-h-11 items-center gap-2 rounded-xl border border-dash-border bg-dash-bg px-3 py-2">
              <select
                aria-label="Automation hour"
                className="min-h-8 min-w-0 flex-1 bg-dash-bg text-sm text-dash-ink"
                disabled={saving}
                value={Number(time.slice(0, 2))}
                onChange={(e) => {
                  setTime(e.target.value.padStart(2, "0") + time.slice(2));
                  setReviewedReport(null);
                }}
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>
                    {String(i).padStart(2, "0")}
                  </option>
                ))}
              </select>
              <span aria-hidden="true">:</span>
              <select
                aria-label="Automation minute"
                className="min-h-8 min-w-0 flex-1 bg-dash-bg text-sm text-dash-ink"
                disabled={saving}
                value={time.slice(3)}
                onChange={(e) => {
                  setTime(time.slice(0, 3) + e.target.value);
                  setReviewedReport(null);
                }}
              >
                {Array.from({ length: 60 }, (_, i) => (
                  <option key={i} value={String(i).padStart(2, "0")}>
                    {String(i).padStart(2, "0")}
                  </option>
                ))}
              </select>
            </div>
          </fieldset>
          <label className="text-sm sm:col-span-2">
            Client email addresses · up to 5
            <input
              aria-label="Automation recipients"
              className={field}
              value={recipients}
              disabled={saving}
              placeholder="client@example.com"
              onChange={(e) => {
                setRecipients(e.target.value);
                setReviewedReport(null);
              }}
            />
          </label>
        </div>
      ) : null}
      <p className="mt-4 text-sm font-medium">
        {summary}{" "}
        <span className="font-normal text-dash-ink-secondary">
          ({w.clientTimezone})
        </span>
      </p>
      <p className="mt-2 text-xs leading-relaxed text-dash-ink-secondary">
        We notify you when each report is ready. You review it, then click Send.
        Saving this setup never sends a report to the client.
      </p>
      {initial && !saved && (
        <p className="mt-2 text-xs text-dash-ink-secondary">
          Your existing {monthly ? "monthly" : "weekly"} automation stays
          unchanged until you save this replacement. Review the campaign and
          metric choices again.
        </p>
      )}
      {ready && !saved && (
        <div className="mt-4 space-y-3 border-t border-dash-border pt-4">
          <Link
            href={`/clients/${w.clientId}/reports/${w.reportId}/copy?from=automation`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center text-sm font-medium text-dash-accent underline"
          >
            Review sample report ↗
          </Link>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={reviewedReport === w.reportId}
              disabled={saving}
              onChange={(e) =>
                setReviewedReport(e.target.checked ? w.reportId : null)
              }
            />
            I reviewed the sample report, schedule and recipients.
          </label>
          <button
            type="button"
            disabled={
              saving || reviewedReport !== w.reportId || !recipients.trim()
            }
            onClick={() => void save()}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-dash-accent px-5 py-3 text-sm font-semibold text-[#102033] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save automation"}
          </button>
        </div>
      )}
      {generated && !ready && !saved && (
        <p role="alert" className="mt-3 text-sm text-dash-error">
          Finish the campaign objective and metric review, and pass the source
          checks before saving automation. Go back to those steps and regenerate
          the sample.
        </p>
      )}
      {!generated && !saved && w.step === 4 && (
        <p className="mt-3 text-sm text-dash-ink-secondary">
          Finish reviewing objectives and metrics, then generate a sample report
          below. Review the sample and save automation here. The sample uses one
          report from your allowance; future report dates update automatically.
        </p>
      )}
      {saved && (
        <p role="status" className="mt-4 text-sm font-medium text-dash-success">
          Automation saved. Each scheduled report will wait for your review and
          Send.{" "}
          <Link href={`/clients/${w.clientId}/schedules`} className="underline">
            View automations →
          </Link>
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-dash-error">
          {error}
        </p>
      )}
    </section>
  );
}
