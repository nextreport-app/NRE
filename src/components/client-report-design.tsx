"use client";
import { useCallback, useEffect, useState } from "react";
interface View {
  client: { template: "DARK" | "LIGHT"; agencyTemplateId: string | null };
  templates: Array<{ id: string; name: string; baseVariant: string }>;
}
export function ClientReportDesign({ clientId }: { clientId: string }) {
  const [view, setView] = useState<View | null>(null),
    [selection, setSelection] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const url = `/api/clients/${clientId}/design`;
  const load = useCallback(async () => {
    const response = await fetch(url, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok)
      throw Error(data.error ?? "Report designs could not load.");
    setView(data);
    setSelection(
      data.client.agencyTemplateId ?? `builtin:${data.client.template}`,
    );
  }, [url]);
  useEffect(() => {
    const refresh = () => void load().catch((e) => setError(e.message));
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [load]);
  async function save() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const builtin = selection.startsWith("builtin:");
      const response = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agencyTemplateId: builtin ? null : selection,
          ...(builtin ? { variant: selection.slice(8) } : {}),
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw Error(data.error ?? "Could not save report design.");
      await load();
      setNotice(
        "Saved for future Meta reports. Existing reports keep their original design.",
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save report design.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      id="report-design"
      className="rounded-xl border border-dash-border bg-dash-card p-4 text-dash-ink"
    >
      <h2 className="text-lg font-semibold">Report design</h2>
      <p className="mt-1 text-sm text-dash-ink-secondary">
        Choose the PowerPoint and Google Slides design for new Meta reports.
      </p>
      {view && (
        <div className="mt-3 flex flex-wrap gap-3">
          <select
            aria-label="Report design"
            disabled={busy}
            className="min-w-0 flex-1 rounded-lg border border-dash-border bg-dash-bg px-3 py-2 text-sm"
            value={selection}
            onChange={(e) => setSelection(e.target.value)}
          >
            <option value="builtin:DARK">NextReport · Dark</option>
            <option value="builtin:LIGHT">NextReport · Light</option>
            {view.templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button
            disabled={busy}
            className="rounded-lg border border-dash-border px-3 py-2 text-sm disabled:opacity-50"
            onClick={() => void save()}
          >
            {busy ? "Saving…" : "Save design"}
          </button>
        </div>
      )}
      <a
        href="/account#report-designs"
        className="mt-3 inline-block text-sm text-dash-accent hover:underline"
      >
        Manage agency designs →
      </a>
      {notice && (
        <p role="status" className="mt-2 text-sm text-dash-ink-secondary">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-amber-400">
          {error}
        </p>
      )}
    </section>
  );
}
