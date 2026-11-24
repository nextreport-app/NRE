"use client";
import { useState } from "react";
import { WizardDatePicker } from "./report-upload-wizard/ui/wizard-date-picker";
import { reportCalendarYesterday } from "@/lib/nre/report-period-selection";
import type { OverviewRow } from "@/lib/agency-overview";
import type { CampaignPerformance } from "@/lib/performance-monitor/facts";
import type { Verdict } from "@/lib/performance-monitor/decision";
const button =
  "rounded-lg border border-dash-border px-3 py-2 text-sm disabled:opacity-50";
const input =
  "w-full min-w-0 rounded-lg border border-dash-border bg-dash-card p-2 text-sm";
export function VerdictBadge({
  verdict,
  fallback = "No strong signal",
}: {
  verdict: Verdict;
  fallback?: string;
}) {
  const colors = {
    critical: "border-red-400 text-red-400",
    review: "border-amber-400 text-amber-400",
    improving: "border-emerald-400 text-emerald-400",
    neutral: "border-dash-border text-dash-ink-secondary",
  };
  return (
    <span
      className={`inline-block rounded-full border px-2 py-1 text-xs ${colors[verdict]}`}
    >
      {verdict === "critical"
        ? "Critical"
        : verdict === "review"
          ? "Review"
          : verdict === "improving"
            ? "Improving"
            : fallback}
    </span>
  );
}
export function DecisionSettingsPanel({
  client: c,
  busy,
  save,
}: {
  client: OverviewRow;
  busy: boolean;
  save: (body: object) => Promise<boolean>;
}) {
  const [mode, setMode] = useState(
      c.comparison.customStart ? "custom" : String(c.comparison.days),
    ),
    [start, setStart] = useState(c.comparison.customStart),
    [end, setEnd] = useState(c.comparison.customEnd),
    [notice, setNotice] = useState("");
  return (
    <section
      aria-label="Comparison controls"
      className="rounded-xl border border-dash-border bg-dash-bg p-4"
    >
      <h3 className="text-sm font-semibold">Compare periods</h3>
      <form
        className="mt-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const saved = await save({
            action: "comparison",
            days: mode === "custom" ? 7 : Number(mode),
            ...(mode === "custom"
              ? { customStart: start, customEnd: end }
              : {}),
          });
          setNotice(
            saved
              ? c.performanceEnabled
                ? "Comparison refreshed."
                : "Comparison saved. Enable performance to load data."
              : "Could not complete. See the error above.",
          );
        }}
      >
        <div className="flex flex-wrap gap-2">
          {["7", "15", "30", "custom"].map((v) => (
            <button
              key={v}
              type="button"
              disabled={busy}
              aria-pressed={mode === v}
              className={`${button} ${mode === v ? "border-dash-accent bg-dash-accent text-[#102033]" : ""}`}
              onClick={() => {
                setMode(v);
                setNotice("");
              }}
            >
              {v === "custom" ? "Custom dates" : `Last ${v} days`}
            </button>
          ))}
        </div>
        {mode === "custom" && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <WizardDatePicker
              showYear
              label="From"
              value={start}
              disabled={busy}
              maxIso={reportCalendarYesterday(new Date(), c.timezone)}
              onChange={setStart}
            />
            <WizardDatePicker
              showYear
              label="To"
              value={end}
              disabled={busy}
              maxIso={reportCalendarYesterday(new Date(), c.timezone)}
              onChange={setEnd}
            />
          </div>
        )}
        <p className="mt-2 text-xs text-dash-ink-secondary">
          Each period is compared with the preceding equal-length period.
        </p>
        <button disabled={busy || !c.linked} className={`${button} mt-3`}>
          {busy
            ? "Updating…"
            : c.performanceEnabled
              ? "Compare periods"
              : "Save comparison"}
        </button>
        {notice && (
          <p role="status" className="mt-2 text-xs">
            {notice}
          </p>
        )}
      </form>
    </section>
  );
}
export function CampaignTargetForm({
  client: c,
  campaign,
  busy,
  save,
}: {
  client: OverviewRow;
  campaign: CampaignPerformance;
  busy: boolean;
  save: (body: object) => Promise<boolean>;
}) {
  const current = campaign.id ? c.targets[campaign.id] : undefined;
  const [cost, setCost] = useState(current?.maxCpr?.toString() ?? ""),
    [roas, setRoas] = useState(current?.minRoas?.toString() ?? ""),
    [notice, setNotice] = useState("");
  if (!campaign.id || campaign.objective === "RESULTS") return null;
  const purchase = /purchase/i.test(campaign.objective);
  return (
    <details className="mt-4 border-t border-dash-border pt-3">
      <summary className="cursor-pointer text-sm">
        Campaign targets (optional){current ? " · Saved" : ""}
      </summary>
      <form
        className="mt-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const rules = { ...c.targets };
          if (!cost && !roas) delete rules[campaign.id!];
          else
            rules[campaign.id!] = {
              objective: campaign.objective,
              ...(cost ? { maxCpr: Number(cost) } : {}),
              ...(purchase && roas ? { minRoas: Number(roas) } : {}),
            };
          const saved = await save({ action: "targets", rules });
          setNotice(
            saved
              ? "Targets saved. Check Meta to assess them."
              : "Could not complete. See the error above.",
          );
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs">
            Maximum {campaign.costLabel.toLowerCase()} ({c.currency})
            <input
              className={input}
              type="number"
              min="0.01"
              step="any"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
            />
          </label>
          {purchase && (
            <label className="text-xs">
              Minimum purchase ROAS (×)
              <input
                className={input}
                type="number"
                min="0.01"
                max="10000"
                step="any"
                value={roas}
                onChange={(e) => setRoas(e.target.value)}
              />
            </label>
          )}
        </div>
        <p className="mt-2 text-xs text-dash-ink-secondary">
          Use your own agreed efficiency goals. Targets apply to this campaign,
          objective and currency. Clear both fields to remove.
        </p>
        <button disabled={busy} className={`${button} mt-3`}>
          Save targets
        </button>
        {notice && (
          <p role="status" className="mt-2 text-xs">
            {notice}
          </p>
        )}
      </form>
    </details>
  );
}
