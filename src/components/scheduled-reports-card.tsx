"use client";
import { useCallback, useEffect, useState } from "react";
import {
  cadenceLabel,
  SCHEDULE_CADENCES,
  type ScheduleCadence,
} from "@/lib/report-schedules/cadence";
import { nextScheduledAt, localDate } from "@/lib/report-schedules/calendar";
import type { ScheduleSettings } from "@/lib/report-schedules/calendar";
import { extractDriveFolderIdFromLink } from "@/lib/drive-link";
import { ApiSourceDownload } from "./report-upload-wizard/ui/api-source-download";
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
  "mt-1 block w-full rounded border border-dash-border bg-dash-bg px-3 py-2 text-dash-ink";
const button =
  "rounded border border-dash-border px-3 py-2 text-sm disabled:opacity-50";
export function ScheduledReportsCard({ clientId }: { clientId: string }) {
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
  async function action(body: object) {
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
  const date = (value: string) =>
    new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: view?.timezone ?? "UTC",
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
    <section
      id="scheduled-reports"
      className="rounded-xl border border-dash-border bg-dash-surface p-5 text-dash-ink"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            Scheduled reports{" "}
            <span className="text-xs text-dash-ink-secondary">Beta</span>
          </h2>
          <p className="mt-1 text-sm text-dash-ink-secondary">
            Prepare → review → approve → send. You control client delivery.
          </p>
        </div>
        {view?.linked && (
          <button className={button} disabled={busy} onClick={() => edit()}>
            Set up schedule
          </button>
        )}
      </div>
      {!view && !error && <p className="mt-3 text-sm">Loading schedules…</p>}
      {view && !view.linked && (
        <p className="mt-3 text-sm">
          Link this client&apos;s Meta ad account in Client settings to prepare
          scheduled drafts.
        </p>
      )}
      {view?.linked && !view.health.healthy && (
        <p className="mt-3 text-sm text-dash-ink-secondary">
          Automatic preparation is{" "}
          {view.health.configured
            ? "temporarily unavailable"
            : "not connected yet"}
          . Save paused schedules and use Prepare now.
        </p>
      )}
      {editing && view && (
        <form
          className="mt-5 grid gap-4 border-t border-dash-border pt-4 sm:grid-cols-2"
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
          <label className="text-sm">
            Report
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
          {cadence === "FORTNIGHTLY" ? (
            <label className="text-sm">
              First preparation date
              <input
                aria-label="First preparation date"
                type="date"
                required
                className={input}
                value={anchorDate}
                onChange={(e) => setAnchorDate(e.target.value)}
              />
              <span className="mt-1 block text-xs text-dash-ink-secondary">
                Repeats every 14 days from this date, including across months.
              </span>
            </label>
          ) : cadence === "DAILY" ? (
            <p className="self-center text-sm text-dash-ink-secondary">
              Every day, using yesterday&apos;s account-local data.
            </p>
          ) : (
            <label className="text-sm">
              {cadence === "WEEKLY" ? "Start on" : "Day of month"}
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
                  <option key={label} value={cadence === "WEEKLY" ? i : i + 1}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="text-sm">
            Start preparing at ({view.timezone})
            <input
              required
              className={input}
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </label>
          <label className="text-sm">
            Client emails (up to 5)
            <input
              required
              className={input}
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
              placeholder="client@example.com, colleague@example.com"
            />
          </label>
          <details className="sm:col-span-2">
            <summary className="cursor-pointer text-sm">
              Report settings
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
          <p className="text-xs text-dash-ink-secondary sm:col-span-2">
            {["DAILY", "FORTNIGHTLY"].includes(cadence)
              ? "Day-by-day performance table; monthly cover budget pacing is not included. "
              : ""}
            Each prepared draft uses your report allowance. Approval never sends
            an email.
          </p>
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
                <p className="text-xs text-dash-ink-secondary sm:col-span-2">
                  Next occurrence if enabled: {date(next.toISOString())} (
                  {view.timezone})
                </p>
              );
            } catch {
              return null;
            }
          })()}
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={enabled}
              disabled={!view.health.healthy && !enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            Enable automatic preparation
          </label>
          <p className="text-xs text-dash-ink-secondary sm:col-span-2">
            Saving replaces this client&apos;s {cadence.toLowerCase()} schedule.
            Existing drafts keep their recipients and settings. Preparation may
            take a few minutes; you receive a review notification when ready.
          </p>
          <div className="flex gap-2 sm:col-span-2">
            <button
              disabled={busy}
              className={`${button} bg-dash-accent text-black`}
            >
              Save schedule
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
      {view?.schedules.map((s) => (
        <div key={s.id} className="mt-5 border-t border-dash-border pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">
                {cadenceLabel(s.settings.cadence)} ·{" "}
                {s.enabled ? "Active" : "Paused"}
              </h3>
              <p className="text-xs text-dash-ink-secondary">
                {s.enabled
                  ? `Next preparation: ${date(s.nextRunAt)} (${view.timezone})`
                  : `Saved time: ${s.settings.time} (${view.timezone})`}
              </p>
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
                disabled={busy || (!s.enabled && !view.health.healthy)}
                className={button}
                onClick={() =>
                  void action({
                    action: "toggle",
                    scheduleId: s.id,
                    enabled: !s.enabled,
                  })
                }
              >
                {s.enabled ? "Pause" : "Resume"}
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
              className="mt-4 rounded-lg border border-dash-border p-4"
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
                {date(r.dueAt)} · To: {r.settings.recipients.join(", ")}
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
              {r.sourceSessionId && (
                <ApiSourceDownload
                  clientId={clientId}
                  uploadSessionId={r.sourceSessionId}
                />
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
                    onClick={() => void action({ action: "send", runId: r.id })}
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
              {!["SENDING", "SENT", "REVIEW", "SKIPPED"].includes(r.status) && (
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
