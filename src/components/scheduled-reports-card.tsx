"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { MetaClientAccountSelector } from "./meta-client-account-selector";
import {
  cadenceLabel,
  SCHEDULE_CADENCES,
  type ScheduleCadence,
} from "@/lib/report-schedules/cadence";
import { nextScheduledAt, localDate } from "@/lib/report-schedules/calendar";
import type { ScheduleSettings } from "@/lib/report-schedules/calendar";
import { extractDriveFolderIdFromLink } from "@/lib/drive-link";
import { WizardDatePicker } from "./report-upload-wizard/ui/wizard-date-picker";
interface Run {
  id: string;
  status: string;
  dueAt: string;
  error: string | null;
  sourceSessionId: string | null;
  settings: ScheduleSettings;
  report: null | {
    id: string;
    status: string;
    displayName: string | null;
    approvedAt: string | null;
    slidesUrl: string | null;
    shareToken: string | null;
    digest: string | null;
  };
}
interface Schedule {
  id: string;
  enabled: boolean;
  nextRunAt: string;
  settings: ScheduleSettings;
  runs: Run[];
}
interface View {
  linked: boolean;
  timezone: string;
  folderId: string | null;
  health: { configured: boolean; healthy: boolean; lastTickAt: string | null };
  schedules: Schedule[];
}
const input =
  "mt-1 block min-h-11 w-full rounded-xl border border-dash-border bg-dash-bg px-3 py-2.5 text-sm text-dash-ink focus-visible:outline-2 focus-visible:outline-dash-accent";
const button =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-dash-border px-4 py-2 text-sm font-medium hover:border-dash-accent focus-visible:outline-2 focus-visible:outline-dash-accent disabled:cursor-not-allowed disabled:opacity-50";
export function ScheduledReportsCard({
  clientId,
  clientName = "this client",
}: {
  clientId: string;
  clientName?: string;
}) {
  const editorHeading = useRef<HTMLHeadingElement>(null);
  const [view, setView] = useState<View | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [editing, setEditing] = useState(false),
    [cadence, setCadence] = useState<ScheduleCadence>("WEEKLY"),
    [day, setDay] = useState(1),
    [anchorDate, setAnchorDate] = useState(""),
    [time, setTime] = useState("09:00"),
    [recipients, setRecipients] = useState(""),
    [campaigns, setCampaigns] = useState(""),
    [budget, setBudget] = useState(false),
    [enabled, setEnabled] = useState(false),
    [reviewed, setReviewed] = useState<Record<string, string>>({}),
    [folder, setFolder] = useState("");
  const url = `/api/clients/${encodeURIComponent(clientId)}/report-schedules`;
  useEffect(() => {
    if (editing) editorHeading.current?.focus();
  }, [editing]);
  const load = useCallback(async () => {
    const r = await fetch(url, { cache: "no-store" });
    const data = await r.json();
    if (!r.ok) throw Error(data.error ?? "Schedules could not load.");
    setView(data as View);
  }, [url]);
  const pending = view?.schedules.some((s) =>
    s.runs.some((r) =>
      ["PENDING", "PREPARING", "GENERATING", "SENDING"].includes(r.status),
    ),
  );
  useEffect(() => {
    const refresh = () => void load().catch((e) => setError(e.message));
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [load]);
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(
      () => void load().catch(() => setError("Refresh to check draft status.")),
      8000,
    );
    return () => clearInterval(timer);
  }, [load, pending]);
  async function action(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error ?? "Schedule update failed.");
      if (data.pending)
        setNotice("Delivery is queued. Its status will update here.");
      else if (body.action === "save" || body.action === "toggle")
        setNotice(
          body.enabled
            ? "Automatic draft preparation is active. Review and approve each draft, then click Send approved report to email recipients."
            : "Saved paused. Nothing will run at the saved time. Use Prepare now to create a test draft.",
        );
      else if (body.action === "prepare")
        setNotice(
          "Draft preparation requested. Review it here or in Reports → Scheduled drafts when ready. No recipient email has been sent.",
        );
      await load();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Schedule update failed.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  function edit(schedule?: Schedule) {
    const s = schedule?.settings;
    setCadence(s?.cadence ?? "WEEKLY");
    setDay(s ? (s.cadence === "WEEKLY" ? s.weekday : s.monthDay) : 1);
    setTime(s?.time ?? "09:00");
    setAnchorDate(
      s?.anchorDate ??
        (view
          ? localDate(
              nextScheduledAt({
                cadence: "DAILY",
                weekday: 1,
                monthDay: 1,
                time: "09:00",
                timezone: view.timezone,
                campaignNames: [],
                showBudget: false,
                recipients: [],
              }),
              view.timezone,
            )
          : ""),
    );
    setRecipients(s?.recipients.join(", ") ?? "");
    setCampaigns(s?.campaignNames.join("\n") ?? "");
    setBudget(s?.showBudget ?? false);
    setEnabled(schedule?.enabled ?? false);
    setEditing(true);
  }
  const date = (value: string, timezone = view?.timezone ?? "UTC") =>
    new Intl.DateTimeFormat("en", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: timezone,
    }).format(new Date(value));
  async function slides(run: Run) {
    const folderId = extractDriveFolderIdFromLink(
      folder || view?.folderId || "",
    );
    if (!folderId) {
      setError("Paste a Google Drive folder link first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/reports/${run.report!.id}/save-to-drive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId }),
      });
      const data = await r.json();
      if (!r.ok)
        throw Error(data.message ?? data.error ?? "Slides export failed.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Slides export failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section id="scheduled-reports" className="space-y-5 text-dash-ink">
      <div className="rounded-2xl border border-dash-border bg-dash-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-dash-border bg-dash-bg">
              <svg
                aria-hidden="true"
                className="h-6 w-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
              >
                <rect x="3" y="5" width="18" height="16" rx="3" />
                <path d="M7 2v6M17 2v6M3 11h18m-12 4h3m-3 3h6" />
              </svg>
            </span>
            <div>
              <h2 className="text-lg font-semibold">
                Reports, ready on your schedule
              </h2>
              <p className="mt-1 max-w-md text-sm text-dash-ink-secondary">
                Choose when to prepare a report. You stay in control of sending
                it.
              </p>
            </div>
          </div>
          {view?.linked && !editing && (
            <button
              className={`${button} bg-dash-accent text-[#102033]`}
              disabled={busy}
              onClick={() => edit()}
            >
              Set up schedule
            </button>
          )}
        </div>
        <ol
          aria-label="How scheduled reports work"
          className="mt-5 grid gap-3 sm:grid-cols-3"
        >
          {[
            ["1", "We prepare", "Fresh Meta Ads data becomes a private draft."],
            ["2", "You review", "Check the report and approve it."],
            ["3", "You send", "Email the approved report when you’re ready."],
          ].map(([n, title, body]) => (
            <li
              key={n}
              className="rounded-xl border border-dash-border bg-dash-bg p-3"
            >
              <span
                className="mb-2 flex h-6 w-6 items-center justify-center rounded-full bg-dash-accent/15 text-xs font-semibold text-dash-accent"
                aria-hidden="true"
              >
                {n}
              </span>
              <p className="text-sm font-semibold">{title}</p>
              <p className="mt-1 text-xs leading-relaxed text-dash-ink-secondary">
                {body}
              </p>
            </li>
          ))}
        </ol>
      </div>
      {!view && !error && (
        <p role="status" className="text-sm">
          Loading schedules…
        </p>
      )}
      {view && !view.linked && (
        <div className="rounded-2xl border border-dash-border bg-dash-card p-5">
          <MetaClientAccountSelector
            clientId={clientId}
            clientName={clientName}
            busy={busy}
            onLinked={load}
            onActivity={setBusy}
          />
        </div>
      )}
      {view?.linked && (
        <div
          className={`rounded-xl border p-4 ${view.health.healthy ? "border-dash-border bg-dash-card" : "border-amber-400/40 bg-amber-400/5"}`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">
                {view.health.healthy
                  ? "Automatic preparation is available"
                  : "Automatic preparation needs attention"}
              </p>
              <p className="mt-1 text-sm text-dash-ink-secondary">
                {view.health.healthy
                  ? "You can turn on recurring preparation when you save a schedule."
                  : "For now, save a paused schedule and use Prepare now to create a draft manually."}
              </p>
            </div>
            <button
              type="button"
              className={button}
              disabled={busy}
              onClick={() => {
                setError("");
                void load().catch((e) => setError(e.message));
              }}
            >
              Refresh status
            </button>
          </div>
          <details className="mt-3 text-xs text-dash-ink-secondary">
            <summary className="cursor-pointer">Connection details</summary>
            <p className="mt-2">
              Reporting time zone: {view.timezone}. This follows the ad
              account’s calendar.
            </p>
            <p className="mt-1">
              {view.health.configured
                ? "The preparation service is configured."
                : "Automatic preparation is not connected yet."}
              {view.health.lastTickAt
                ? ` Last check: ${date(view.health.lastTickAt)}.`
                : " No preparation check recorded yet."}
            </p>
          </details>
        </div>
      )}
      {view?.linked && !editing && !view.schedules.length && (
        <div className="rounded-2xl border border-dashed border-dash-border p-6 text-center">
          <h3 className="font-semibold">No schedules yet</h3>
          <p className="mt-2 text-sm text-dash-ink-secondary">
            Use Set up schedule to choose your report and preparation time.
          </p>
        </div>
      )}
      {editing && view && (
        <form
          className="space-y-6 rounded-2xl border border-dash-border bg-dash-card p-5 sm:p-6"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await action({
              action: "save",
              enabled,
              settings: {
                cadence,
                ...(cadence === "FORTNIGHTLY" ? { anchorDate } : {}),
                weekday: cadence === "WEEKLY" ? day : 1,
                monthDay: cadence === "MONTHLY" ? day : 1,
                time,
                timezone: view.timezone,
                recipients: recipients
                  .split(/[,;\n]/)
                  .map((s) => s.trim())
                  .filter(Boolean),
                campaignNames: campaigns
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean),
                showBudget: ["DAILY", "FORTNIGHTLY"].includes(cadence)
                  ? false
                  : budget,
              },
            });
            if (ok) setEditing(false);
          }}
        >
          <div>
            <h3
              ref={editorHeading}
              tabIndex={-1}
              className="text-lg font-semibold outline-none"
            >
              Set up your report
            </h3>
            <p className="mt-1 text-sm text-dash-ink-secondary">
              Saved separately from your one-off reports and CSV uploads.
            </p>
          </div>
          <fieldset className="space-y-3">
            <legend className="mb-3 text-sm font-semibold">
              1. Choose the report
            </legend>
            <label className="text-sm">
              How often?
              <select
                aria-label="Report cadence"
                className={input}
                value={cadence}
                onChange={(e) => {
                  setCadence(e.target.value as typeof cadence);
                  setDay(1);
                  if (["DAILY", "FORTNIGHTLY"].includes(e.target.value))
                    setBudget(false);
                }}
              >
                {SCHEDULE_CADENCES.map((value) => (
                  <option key={value} value={value}>
                    {cadenceLabel(value)} ·{" "}
                    {value === "DAILY"
                      ? "yesterday"
                      : value === "WEEKLY"
                        ? "previous 7 days"
                        : value === "FORTNIGHTLY"
                          ? "previous 14 days"
                          : "previous calendar month"}
                  </option>
                ))}
              </select>
            </label>
          </fieldset>
          <fieldset>
            <legend className="mb-3 text-sm font-semibold">
              2. Choose when to prepare it
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              {cadence === "FORTNIGHTLY" ? (
                <div className="min-w-0 [&_[role=dialog]]:max-w-full">
                  <WizardDatePicker
                    label="First preparation date"
                    value={anchorDate}
                    onChange={setAnchorDate}
                    showYear
                  />
                  <p className="mt-2 text-xs text-dash-ink-secondary">
                    Repeats every 14 days from this date.
                  </p>
                </div>
              ) : cadence === "DAILY" ? (
                <p className="self-center text-sm text-dash-ink-secondary">
                  Every day, using yesterday&apos;s account-local data.
                </p>
              ) : (
                <label className="text-sm">
                  {cadence === "WEEKLY" ? "Every" : "Day of the month"}
                  <select
                    className={input}
                    value={day}
                    onChange={(e) => setDay(Number(e.target.value))}
                  >
                    {(cadence === "WEEKLY"
                      ? [
                          "Sunday",
                          "Monday",
                          "Tuesday",
                          "Wednesday",
                          "Thursday",
                          "Friday",
                          "Saturday",
                        ]
                      : Array.from({ length: 28 }, (_, i) => String(i + 1))
                    ).map((label, i) => (
                      <option
                        key={label}
                        value={cadence === "WEEKLY" ? i : i + 1}
                      >
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <fieldset>
                <legend className="text-sm">Time · 24-hour</legend>
                <div className="mt-1 flex min-h-11 items-center gap-2 rounded-xl border border-dash-border bg-dash-bg px-3 py-2">
                  <select
                    aria-label="Preparation hour"
                    className="min-h-8 min-w-0 flex-1 bg-dash-bg text-sm text-dash-ink"
                    value={Number(time.slice(0, 2))}
                    onChange={(e) =>
                      setTime(e.target.value.padStart(2, "0") + time.slice(2))
                    }
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>
                        {String(i).padStart(2, "0")}
                      </option>
                    ))}
                  </select>
                  <span aria-hidden="true">:</span>
                  <select
                    aria-label="Preparation minute"
                    className="min-h-8 min-w-0 flex-1 bg-dash-bg text-sm text-dash-ink"
                    value={time.slice(3)}
                    onChange={(e) => setTime(time.slice(0, 3) + e.target.value)}
                  >
                    {Array.from({ length: 60 }, (_, i) => (
                      <option key={i} value={String(i).padStart(2, "0")}>
                        {String(i).padStart(2, "0")}
                      </option>
                    ))}
                  </select>
                </div>
              </fieldset>
            </div>
            <p className="mt-2 text-xs text-dash-ink-secondary">
              All times use {view.timezone}, the ad account’s time zone.
            </p>
          </fieldset>
          <fieldset>
            <legend className="mb-3 text-sm font-semibold">
              3. Choose who receives the report
            </legend>
            <label className="text-sm">
              Client email addresses · up to 5
              <input
                required
                className={input}
                value={recipients}
                onChange={(e) => setRecipients(e.target.value)}
                placeholder="client@example.com, colleague@example.com"
              />
              <span className="mt-1 block text-xs text-dash-ink-secondary">
                We notify you when the draft is ready. These recipients are
                emailed only after you approve and click Send approved report.
              </span>
            </label>
          </fieldset>
          <details className="rounded-xl border border-dash-border p-4">
            <summary className="cursor-pointer text-sm">
              Customize report content
            </summary>
            <p className="mt-2 text-sm text-dash-ink-secondary">
              {["DAILY", "FORTNIGHTLY"].includes(cadence)
                ? "Account-level daily tables with each objective's results kept separate."
                : "Campaign-level reports with objective-based metrics."}{" "}
              Uses the current client template and agency branding.
            </p>
            <label className="mt-3 block text-sm">
              Campaign names · leave blank for all
              <textarea
                className={input}
                value={campaigns}
                onChange={(e) => setCampaigns(e.target.value)}
                placeholder="Exact names, one per line"
              />
            </label>
            {!["DAILY", "FORTNIGHTLY"].includes(cadence) && (
              <label className="mt-3 flex gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={budget}
                  onChange={(e) => setBudget(e.target.checked)}
                />
                Show monthly budget on cover
              </label>
            )}
          </details>
          {(() => {
            try {
              const next = nextScheduledAt({
                cadence,
                weekday: day,
                monthDay: day,
                time,
                timezone: view.timezone,
                anchorDate,
                campaignNames: [],
                showBudget: false,
                recipients: [],
              });
              return (
                <div className="rounded-xl border border-dash-border bg-dash-bg p-4 text-sm">
                  <p className="mb-1 text-xs text-dash-ink-secondary">
                    Next preparation time · if turned on
                  </p>
                  <p className="font-semibold">
                    {" "}
                    {date(next.toISOString())} ({view.timezone})
                  </p>
                </div>
              );
            } catch {
              return null;
            }
          })()}
          <label className="flex items-center gap-3 rounded-xl border border-dash-border p-4 text-sm font-medium">
            <input
              type="checkbox"
              checked={enabled}
              disabled={!view.health.healthy && !enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            Prepare automatically at the scheduled time
          </label>
          <p className="text-xs leading-relaxed text-dash-ink-secondary">
            {enabled
              ? "We’ll prepare drafts on this schedule and notify you to review them. Nothing is emailed to clients automatically."
              : "With automatic preparation off, nothing runs on its own. Use Prepare now after saving."}{" "}
            Each prepared draft uses your report allowance. Saving replaces this
            client’s {cadence.toLowerCase()} schedule; existing drafts stay
            unchanged.
          </p>
          <div className="flex flex-wrap gap-3 border-t border-dash-border pt-5">
            <button
              disabled={busy}
              className={`${button} bg-dash-accent text-black`}
            >
              {enabled ? "Save active schedule" : "Save paused schedule"}
            </button>
            <button
              type="button"
              className={button}
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {!editing && !!view?.schedules.length && (
        <h3 className="text-lg font-semibold">Your schedules</h3>
      )}
      {!editing &&
        view?.schedules.map((s) => (
          <div
            key={s.id}
            className="rounded-2xl border border-dash-border bg-dash-card p-5 sm:p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">
                  {cadenceLabel(s.settings.cadence)} ·{" "}
                  {s.enabled
                    ? view.health.healthy
                      ? "Active"
                      : "Needs attention"
                    : "Paused"}
                </h3>
                <p className="text-xs text-dash-ink-secondary">
                  {s.enabled
                    ? `Next draft: ${date(s.nextRunAt, s.settings.timezone)} (${s.settings.timezone})`
                    : `If enabled, next draft: ${date(nextScheduledAt(s.settings).toISOString(), s.settings.timezone)} (${s.settings.timezone})`}
                </p>
                {!s.enabled && (
                  <p className="mt-2 text-sm text-dash-ink-secondary">
                    Paused — nothing runs automatically. Use Prepare now to
                    test.
                  </p>
                )}

                {s.settings.timezone !== view.timezone && (
                  <p className="mt-2 text-sm text-amber-400">
                    Client timezone changed. Edit and save this schedule again
                    before preparing.
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  disabled={busy}
                  className={button}
                  onClick={() => edit(s)}
                >
                  Edit
                </button>
                <button
                  disabled={
                    busy ||
                    (!s.enabled &&
                      (!view.health.healthy ||
                        s.settings.timezone !== view.timezone))
                  }
                  title={
                    !s.enabled && !view.health.healthy
                      ? "Automatic preparation is unavailable until the scheduler check is healthy. Prepare now still works."
                      : undefined
                  }
                  className={button}
                  onClick={() =>
                    void action({
                      action: "toggle",
                      scheduleId: s.id,
                      enabled: !s.enabled,
                    })
                  }
                >
                  {s.enabled ? "Pause" : "Enable schedule"}
                </button>
                <button
                  disabled={
                    busy ||
                    s.runs.some((r) =>
                      ["PENDING", "PREPARING", "GENERATING"].includes(r.status),
                    )
                  }
                  className={button}
                  onClick={() =>
                    void action({ action: "prepare", scheduleId: s.id })
                  }
                >
                  Prepare now
                </button>
              </div>
            </div>
            {s.runs.map((r) => (
              <div
                key={r.id}
                className="mt-4 rounded-xl border border-dash-border bg-dash-bg p-4"
              >
                <p className="font-medium">
                  {r.report?.displayName ??
                    `${cadenceLabel(s.settings.cadence)} draft`}{" "}
                  ·{" "}
                  {r.status === "SENT"
                    ? "Email accepted"
                    : r.status.toLowerCase().replaceAll("_", " ")}
                </p>
                <p className="mt-1 break-words text-xs text-dash-ink-secondary">
                  {date(r.dueAt, r.settings.timezone)} ({r.settings.timezone}) ·
                  To: {r.settings.recipients.join(", ")}
                </p>
                {r.error && (
                  <p className="mt-2 text-sm text-amber-400">{r.error}</p>
                )}
                {r.report?.status === "COMPLETE" && (
                  <div className="mt-3 flex flex-wrap gap-3 text-sm">
                    <a
                      className="text-dash-accent hover:underline"
                      href={`/clients/${clientId}/reports/${r.report.id}/copy`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Review report ↗
                    </a>
                    <a
                      className="hover:underline"
                      href={`/api/reports/${r.report.id}/download`}
                    >
                      Download PPTX
                    </a>
                    {r.report.shareToken && (
                      <a
                        className="hover:underline"
                        target="_blank"
                        rel="noreferrer"
                        href={`/r/${r.report.shareToken}`}
                      >
                        Browser report ↗
                      </a>
                    )}
                    {r.report.slidesUrl && (
                      <a
                        className="hover:underline"
                        target="_blank"
                        rel="noreferrer"
                        href={r.report.slidesUrl}
                      >
                        Google Slides ↗
                      </a>
                    )}
                  </div>
                )}
                {r.status === "READY" && r.report?.digest && (
                  <div className="mt-3">
                    <label className="flex gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={reviewed[r.id] === r.report.digest}
                        onChange={(e) =>
                          setReviewed({
                            ...reviewed,
                            [r.id]: e.target.checked ? r.report!.digest! : "",
                          })
                        }
                      />
                      I reviewed the report and recipients.
                    </label>
                    <button
                      disabled={busy || reviewed[r.id] !== r.report.digest}
                      className={`${button} mt-3`}
                      onClick={() =>
                        void action({
                          action: "approve",
                          runId: r.id,
                          digest: r.report!.digest,
                          reviewed: true,
                        })
                      }
                    >
                      Approve report
                    </button>
                  </div>
                )}
                {r.status === "APPROVED" && (
                  <div className="mt-3">
                    <details>
                      <summary className="cursor-pointer text-sm">
                        Include Google Slides (optional)
                      </summary>
                      <label className="mt-2 block text-sm">
                        Drive folder link
                        <input
                          className={input}
                          value={folder}
                          placeholder={view.folderId ?? "Paste folder link"}
                          onChange={(e) => setFolder(e.target.value)}
                        />
                      </label>
                      <button
                        className={`${button} mt-2`}
                        disabled={busy}
                        onClick={() => void slides(r)}
                      >
                        Save approved copy to Drive
                      </button>
                    </details>
                    <p className="mt-3 text-xs text-dash-ink-secondary">
                      Email includes browser and PPTX links
                      {r.report?.slidesUrl ? ", plus Google Slides" : ""}.
                    </p>
                    <button
                      disabled={busy}
                      className={`${button} mt-2 bg-dash-accent text-black`}
                      onClick={() =>
                        void action({ action: "send", runId: r.id })
                      }
                    >
                      Send approved report
                    </button>
                  </div>
                )}
                {r.status === "SENDING" && (
                  <button
                    disabled={busy}
                    className={`${button} mt-3`}
                    onClick={() => void action({ action: "send", runId: r.id })}
                  >
                    Check / retry same delivery
                  </button>
                )}
                {!["SENDING", "SENT", "REVIEW", "SKIPPED"].includes(
                  r.status,
                ) && (
                  <button
                    disabled={busy}
                    className="mt-3 block text-xs text-dash-ink-secondary hover:underline"
                    onClick={() => void action({ action: "skip", runId: r.id })}
                  >
                    Skip this draft
                  </button>
                )}
              </div>
            ))}
          </div>
        ))}
      {error && (
        <p role="alert" className="mt-3 text-sm text-amber-400">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-3 text-sm">
          {notice}
        </p>
      )}
    </section>
  );
}
