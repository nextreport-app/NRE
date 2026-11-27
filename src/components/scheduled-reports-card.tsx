"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { MetaClientAccountSelector } from "./meta-client-account-selector";
import { cadenceLabel } from "@/lib/report-schedules/cadence";
import type { ScheduleSettings } from "@/lib/report-schedules/calendar";
import { extractDriveFolderIdFromLink } from "@/lib/drive-link";
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
  const [view, setView] = useState<View | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [reviewed, setReviewed] = useState<Record<string, string>>({});
  const [folder, setFolder] = useState("");
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
      else if (body.action === "toggle")
        setNotice(
          body.enabled
            ? "Automation resumed. Each report will wait for your review and Send."
            : "Automation paused.",
        );
      else if (body.action === "prepare")
        setNotice(
          "Your report is being generated. We’ll notify you when it’s ready to review.",
        );
      else if (body.action === "sendReviewed" || body.action === "send")
        setNotice("Report sent.");
      await load();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Schedule update failed.");
      return false;
    } finally {
      setBusy(false);
    }
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
        <h2 className="text-lg font-semibold">
          Set it up once. Review each report.
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-dash-ink-secondary">
          Choose the schedule, then select campaigns, confirm objectives and
          finalize metrics in the report wizard. We’ll generate fresh reports on
          that schedule and email you when they’re ready. You review each one,
          then click Send.
        </p>
        <p className="mt-3 text-xs font-medium text-dash-ink-secondary">
          Weekly and monthly reports can run together for the same client.
        </p>
        {view?.linked && !view.health.healthy && (
          <p className="mt-3 text-sm text-dash-error">
            Automatic reporting is temporarily unavailable. You can still review
            and send existing reports.{" "}
            <button
              type="button"
              disabled={busy}
              className="min-h-11 underline disabled:opacity-50"
              onClick={() => void load().catch((e) => setError(e.message))}
            >
              Check again
            </button>
          </p>
        )}
      </div>
      {!view && !error && (
        <p role="status" className="text-sm">
          Loading automations…
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
        <div className="grid gap-4 sm:grid-cols-2">
          {(["WEEKLY", "MONTHLY"] as const)
            .filter(
              (cadence) =>
                !view.schedules.some((s) => s.settings.cadence === cadence),
            )
            .map((cadence) => (
              <div
                key={cadence}
                className="rounded-2xl border border-dash-border bg-dash-card p-5"
              >
                <h3 className="font-semibold">
                  {cadence === "WEEKLY" ? "Weekly report" : "Monthly report"}
                </h3>
                <p className="mt-2 text-sm text-dash-ink-secondary">
                  {cadence === "WEEKLY"
                    ? "The last 7 days, on your chosen weekday."
                    : "Last month’s results, on your chosen day of the month."}
                </p>
                <Link
                  href={`/clients/${clientId}/reports/new?automate=${cadence}`}
                  className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-dash-accent px-4 py-2 text-sm font-semibold text-[#102033]"
                >
                  Set up {cadence === "WEEKLY" ? "weekly" : "monthly"} report →
                </Link>
              </div>
            ))}
        </div>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-dash-border bg-dash-card p-4 text-sm text-dash-error"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-xl border border-dash-border bg-dash-card p-4 text-sm"
        >
          {notice}
        </p>
      )}
      {!!view?.schedules.length && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">Your automations</h3>
          <button
            type="button"
            className={button}
            disabled={busy}
            onClick={() => {
              setError("");
              void load().catch((e) => setError(e.message));
            }}
          >
            Refresh reports
          </button>
        </div>
      )}
      {view?.schedules.map((s) => (
        <div
          key={s.id}
          className="rounded-2xl border border-dash-border bg-dash-card p-5 sm:p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">
                {cadenceLabel(s.settings.cadence)} report{" "}
                <span className="ml-2 rounded-full border border-dash-border px-2 py-1 text-xs font-medium text-dash-ink-secondary">
                  {s.enabled ? "On" : "Paused"}
                </span>
              </h3>
              <p className="mt-3 text-sm">
                {s.settings.cadence === "WEEKLY"
                  ? `Every ${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][s.settings.weekday]}`
                  : s.settings.cadence === "MONTHLY"
                    ? `Day ${s.settings.monthDay} of each month`
                    : cadenceLabel(s.settings.cadence)}{" "}
                at {s.settings.time}{" "}
                <span className="text-dash-ink-secondary">
                  ({s.settings.timezone})
                </span>
              </p>
              <p className="mt-2 break-words text-sm text-dash-ink-secondary">
                Send to: {s.settings.recipients.join(", ")}
              </p>
              <p className="mt-1 text-xs text-dash-ink-secondary">
                {s.settings.campaignNames.length
                  ? `${s.settings.campaignNames.length} selected campaigns`
                  : "All campaigns"}
                {s.settings.wizardOptions
                  ? " · Saved objectives and metrics"
                  : " · Default report settings"}
              </p>
              {s.settings.timezone !== view.timezone && (
                <p className="mt-2 text-sm text-dash-error">
                  This account’s time zone changed. Review and save the setup
                  again.
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {["WEEKLY", "MONTHLY"].includes(s.settings.cadence) && (
                <Link
                  href={`/clients/${clientId}/reports/new?automate=${s.settings.cadence}`}
                  className={button}
                >
                  Change setup
                </Link>
              )}
              <button
                disabled={busy}
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
                Generate report now
              </button>
            </div>
          </div>
          <details
            className="mt-5 border-t border-dash-border pt-4"
            open={s.runs.some((r) =>
              ["READY", "APPROVED", "SENDING", "FAILED", "REVIEW"].includes(
                r.status,
              ),
            )}
          >
            <summary className="cursor-pointer text-sm font-semibold">
              Reports to review & recent history ({s.runs.length})
            </summary>
            {!s.runs.length && (
              <p className="mt-3 text-sm text-dash-ink-secondary">
                Your scheduled reports will appear here. We’ll email you when a
                report is ready.
              </p>
            )}
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
                      href={`/clients/${clientId}/reports/${r.report.id}/copy?from=automation-report`}
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
                      className={`${button} mt-3 bg-dash-accent text-black`}
                      onClick={() =>
                        void action({
                          action: "sendReviewed",
                          runId: r.id,
                          digest: r.report!.digest,
                          reviewed: true,
                        })
                      }
                    >
                      Send report
                    </button>
                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs text-dash-ink-secondary">
                        Add Google Slides before sending (optional)
                      </summary>
                      <p className="mt-2 text-xs text-dash-ink-secondary">
                        Approve this reviewed version to create a Slides copy.
                        Nothing is sent until you click Send.
                      </p>
                      <button
                        type="button"
                        className={`${button} mt-2`}
                        disabled={busy || reviewed[r.id] !== r.report.digest}
                        onClick={() =>
                          void action({
                            action: "approve",
                            runId: r.id,
                            digest: r.report!.digest,
                            reviewed: true,
                          })
                        }
                      >
                        Approve for Google Slides
                      </button>
                    </details>
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
          </details>
        </div>
      ))}
    </section>
  );
}
