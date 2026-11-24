"use client";
import { useCallback, useEffect, useState } from "react";
import {
  BUDGET_LEVEL_LABELS,
  type BudgetSnapshot,
} from "@/lib/budget-monitor-facts";
interface BudgetView {
  budget: number | null;
  currency: string;
  timezone: string;
  enabled: boolean;
  emailEnabled: boolean;
  tolerance: number;
  linked: boolean;
  snapshot: BudgetSnapshot | null;
  asOf: number;
}
const button =
  "rounded-xl border border-dash-border px-4 py-2 text-sm font-medium disabled:opacity-50";
export function MetaBudgetPanel({
  clientId,
  disabled,
  onUpdated,
}: {
  clientId: string;
  disabled: boolean;
  onUpdated: () => Promise<void>;
}) {
  const [view, setView] = useState<BudgetView | null>(null),
    [budgetDraft, setBudgetDraft] = useState<string | null>(null),
    [toleranceDraft, setToleranceDraft] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const url = `/api/clients/${encodeURIComponent(clientId)}/budget-monitor`;
  const load = useCallback(async () => {
    const r = await fetch(url, { cache: "no-store" });
    const data = await r.json();
    if (!r.ok) throw Error(data.error ?? "Budget settings could not load.");
    return data as BudgetView;
  }, [url]);
  useEffect(() => {
    let mounted = true;
    const refresh = () =>
      void load()
        .then((data) => {
          if (mounted) {
            setView(data);
            setError("");
          }
        })
        .catch(() => {
          if (mounted) setError("Budget settings could not load. Try again.");
        });
    refresh();
    window.addEventListener("focus", refresh);
    return () => {
      mounted = false;
      window.removeEventListener("focus", refresh);
    };
  }, [load]);
  async function save(body: object, method: "POST" | "PATCH" = "POST") {
    const previousView = view;
    const settingsChange = "enabled" in body && "emailEnabled" in body;
    if ("enabled" in body && "emailEnabled" in body)
      setView((current) =>
        current
          ? {
              ...current,
              enabled: !!body.enabled,
              emailEnabled: !!body.emailEnabled,
            }
          : current,
      );
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await fetch(
        method === "PATCH"
          ? `/api/clients/${encodeURIComponent(clientId)}`
          : url,
        {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = await r.json();
      if (!r.ok) throw Error(data.error ?? "Budget update failed.");
      setView(await load());
      await onUpdated();
      if (data.snapshot?.error) throw Error(data.snapshot.error);
      if (method === "PATCH") {
        setBudgetDraft(null);
        setToleranceDraft(null);
      } else if ("tolerance" in body) setToleranceDraft(null);
      setNotice(
        "action" in body && body.action === "check"
          ? "Spend check updated."
          : "Budget settings saved.",
      );
    } catch (e) {
      if (settingsChange) setView(await load().catch(() => previousView));
      setError(e instanceof Error ? e.message : "Budget update failed.");
    } finally {
      setBusy(false);
    }
  }
  const blocked = busy || disabled;
  const money = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: view?.currency ?? "USD",
    }).format(n);
  const snapshot = view?.snapshot,
    facts = snapshot?.facts;
  const stale =
    !!snapshot &&
    ((view?.asOf ?? 0) - Date.parse(snapshot.checkedAt) >= 26 * 3600000 ||
      Date.parse(snapshot.checkedAt) > (view?.asOf ?? 0));
  return (
    <section
      id={`meta-budget-${clientId}`}
      tabIndex={-1}
      aria-label="Budget alerts"
      className="mt-6 scroll-mt-6 rounded-2xl border border-blue-400/25 bg-blue-400/5 p-4 sm:p-5"
    >
      <h3 className="text-lg font-semibold text-blue-400">
        Monthly budget &amp; alerts
      </h3>
      <p className="mt-1 text-sm text-dash-ink-secondary">
        Approved account spend excluding tax. Alerts do not change campaign
        budgets in Meta.
      </p>
      {!view && !error && (
        <p role="status" className="mt-3 text-sm">
          Loading budget settings…
        </p>
      )}
      {view && (
        <>
          <form
            className="mt-4 flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const amount = Number(budgetDraft ?? view.budget);
              if (!Number.isFinite(amount) || amount <= 0) {
                setError("Enter a positive monthly budget.");
                return;
              }
              void save({ monthlyBudget: amount }, "PATCH");
            }}
          >
            <label className="text-sm">
              Approved monthly budget ({view.currency})
              <input
                aria-label="Approved monthly budget"
                type="number"
                min="0.01"
                step="0.01"
                required
                disabled={blocked}
                value={
                  budgetDraft ??
                  (view.budget == null ? "" : String(view.budget))
                }
                onChange={(e) => setBudgetDraft(e.target.value)}
                className="mt-2 block w-full rounded-xl border border-dash-border bg-dash-bg px-3 py-2 sm:w-56"
              />
            </label>
            <button
              className={button}
              disabled={blocked || budgetDraft === null}
            >
              Save budget
            </button>
          </form>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 accent-dash-accent"
                disabled={
                  blocked || (!view.enabled && (!view.linked || !view.budget))
                }
                checked={view.enabled}
                onChange={(e) =>
                  void save({
                    action: "settings",
                    enabled: e.target.checked,
                    emailEnabled: view.emailEnabled,
                  })
                }
              />
              Monitor monthly spend
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 accent-dash-accent"
                disabled={blocked}
                checked={view.emailEnabled}
                onChange={(e) =>
                  void save({
                    action: "settings",
                    enabled: view.enabled,
                    emailEnabled: e.target.checked,
                  })
                }
              />
              Email me about budget issues
            </label>
            {view.enabled && (
              <button
                type="button"
                className={button}
                disabled={blocked || !view.budget || !view.linked}
                onClick={() => void save({ action: "check" })}
              >
                {busy ? "Updating…" : "Check spend"}
              </button>
            )}
          </div>
          {!view.linked && (
            <p className="mt-3 text-sm text-dash-ink-secondary">
              Link a Meta account to monitor its spend.
            </p>
          )}
          {!view.budget && (
            <p className="mt-3 text-sm text-dash-ink-secondary">
              Save an approved budget above to enable monitoring.
            </p>
          )}
          {!!view.budget && (
            <details className="mt-4 border-t border-dash-border pt-3">
              <summary className="cursor-pointer text-sm">
                Alert tolerance · {money(view.tolerance)}
              </summary>
              <form
                className="mt-3 flex flex-wrap items-end gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const n = Number(toleranceDraft);
                  if (
                    !toleranceDraft?.trim() ||
                    !Number.isFinite(n) ||
                    n < 0 ||
                    n > view.budget!
                  ) {
                    setError(
                      "Enter a tolerance between zero and the approved budget.",
                    );
                    return;
                  }
                  void save({
                    action: "settings",
                    enabled: view.enabled,
                    emailEnabled: view.emailEnabled,
                    tolerance: n,
                  });
                }}
              >
                <label className="text-sm">
                  Allowed budget difference ({view.currency})
                  <input
                    aria-label="Budget alert tolerance"
                    type="number"
                    min="0"
                    max={view.budget}
                    step="0.01"
                    required
                    disabled={blocked}
                    value={toleranceDraft ?? String(view.tolerance)}
                    onChange={(e) => setToleranceDraft(e.target.value)}
                    className="mt-2 block w-40 rounded-xl border border-dash-border bg-dash-bg px-3 py-2"
                  />
                </label>
                <button
                  className={button}
                  disabled={blocked || toleranceDraft === null}
                >
                  Save tolerance
                </button>
              </form>
            </details>
          )}
          {view.enabled && (
            <div className="mt-4 rounded-xl border border-dash-border bg-dash-bg p-4">
              <p className="text-sm font-semibold">
                {snapshot?.error
                  ? "Spend check needs attention"
                  : stale
                    ? "Refresh to review current spend"
                    : facts
                      ? BUDGET_LEVEL_LABELS[facts.level]
                      : "Check spend to load the first budget comparison"}
              </p>
              {facts && (
                <dl className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
                  {[
                    ["Approved budget", money(view.budget!)],
                    ["Spent this month", money(facts.spent)],
                    ["Remaining", money(facts.remaining)],
                    [
                      "Projected month-end",
                      facts.projected == null
                        ? "Not enough data"
                        : money(facts.projected),
                    ],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-xs text-dash-ink-secondary">
                        {label}
                      </dt>
                      <dd className="mt-1 text-lg font-semibold">{value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {facts && facts.over > view.tolerance && (
                <p className="mt-3 text-sm">
                  Spend is {money(facts.over)} above the approved budget.
                </p>
              )}
              {facts?.level === "underspend" && (
                <p className="mt-3 text-sm">
                  Projected shortfall: {money(facts.projectedShortfall ?? 0)}.
                </p>
              )}
              {snapshot && (
                <p className="mt-3 text-xs text-dash-ink-secondary">
                  {snapshot.error || stale ? "Saved check" : "Last checked"}:{" "}
                  {new Intl.DateTimeFormat("en-US", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: view.timezone,
                  }).format(new Date(snapshot.checkedAt))}
                </p>
              )}
              {snapshot?.error && snapshot.error !== error && (
                <p role="alert" className="mt-3 text-sm text-red-400">
                  {snapshot.error}
                </p>
              )}
              {snapshot?.emailError && (
                <p role="alert" className="mt-3 text-sm text-red-400">
                  {snapshot.emailError}
                </p>
              )}
            </div>
          )}
        </>
      )}
      {!view && error && (
        <button
          type="button"
          disabled={blocked}
          className={`${button} mt-3`}
          onClick={() =>
            void load()
              .then((data) => {
                setView(data);
                setError("");
              })
              .catch(() =>
                setError("Budget settings could not load. Try again."),
              )
          }
        >
          Retry budget settings
        </button>
      )}
      {notice && (
        <p role="status" className="mt-3 text-sm">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {error}
        </p>
      )}
    </section>
  );
}
