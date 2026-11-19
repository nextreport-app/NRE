"use client";
import { useEffect, useRef, useState } from "react";
import {
  metaReportOptions,
  metaReportTitle,
  type MetaReportSelection,
} from "@/lib/nre/meta-report-content/selection";
import type { MetaContentOptions } from "@/lib/nre/meta-report-content/types";
import type { DateSelection } from "@/lib/validators/report-wizard";
type Summary = {
  selection?: MetaReportSelection;
  options: MetaContentOptions;
  campaigns?: string[];
  sources: Array<{ coverage: { startIso: string; endIso: string } }>;
  ads: Array<{ id: string; name: string; hasImage: boolean }>;
};
export function MetaReportContentPanel({
  clientId,
  uploadSessionId,
  source,
  selection,
  dateSelection,
  selectedCampaigns,
  onSessionReady,
  onWorking,
  onBack,
  disabled = false,
}: {
  clientId: string;
  uploadSessionId: string;
  source: "api" | "csv";
  selection: MetaReportSelection;
  dateSelection: DateSelection;
  selectedCampaigns: string[];
  onSessionReady: (id: string) => void;
  onWorking: (busy: boolean) => void;
  onBack: () => void;
  disabled?: boolean;
}) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [options, setOptions] = useState<MetaContentOptions>(() =>
    metaReportOptions(selection),
  );
  const [images, setImages] = useState<Record<string, File>>({});
  const [status, setStatus] = useState<
    "loading" | "fetching" | "ready" | "error"
  >("loading");
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState("");
  const alive = useRef(true),
    applyAbort = useRef<AbortController | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      applyAbort.current?.abort();
    };
  }, []);
  const resolvedIdentity = useRef<string | null>(null);
  const callbacks = useRef({ onSessionReady, onWorking });
  useEffect(() => {
    callbacks.current = { onSessionReady, onWorking };
  }, [onSessionReady, onWorking]);
  const selectionKey = JSON.stringify(selection),
    datesKey = JSON.stringify(dateSelection),
    campaignKey = JSON.stringify([...selectedCampaigns].sort());
  const busy = status === "loading" || status === "fetching";
  const dirty =
    !!summary &&
    (JSON.stringify(options) !== JSON.stringify(summary.options) ||
      Object.keys(images).length > 0);
  useEffect(() => {
    callbacks.current.onWorking(busy || dirty || status === "error");
    return () => callbacks.current.onWorking(false);
  }, [busy, dirty, status]);
  async function post(
    id: string,
    next: MetaContentOptions,
    reuse: boolean,
    signal?: AbortSignal,
    media: Record<string, File> = {},
  ) {
    const form = new FormData();
    form.set(
      "settings",
      JSON.stringify({
        uploadSessionId: id,
        source,
        options: next,
        reportType: "WEEKLY",
        dateSelection,
        selectedCampaigns,
        reuse,
      }),
    );
    Object.entries(media).forEach(([id, file]) =>
      form.append(`media:${id}`, file),
    );
    const response = await fetch(`/api/clients/${clientId}/reports/content`, {
      method: "POST",
      body: form,
      signal,
    });
    const json = await response.json();
    if (!response.ok)
      throw Error(json.error || "Could not prepare this report.");
    return json as { uploadSessionId: string; content: Summary };
  }
  useEffect(() => {
    const identity = JSON.stringify([
      clientId,
      uploadSessionId,
      source,
      selectionKey,
      datesKey,
      campaignKey,
    ]);
    // A successful preparation already returned this immutable session. Do not
    // reload it and overwrite edits made while the parent adopts its new ID.
    if (resolvedIdentity.current === identity) return;
    const controller = new AbortController();
    let live = true;
    void (async () => {
      try {
        const response = await fetch(
          `/api/clients/${clientId}/reports/content?uploadSessionId=${encodeURIComponent(uploadSessionId)}`,
          { cache: "no-store", signal: controller.signal },
        );
        const json = await response.json();
        if (!response.ok)
          throw Error(
            json.error || "Your import could not be loaded. Return to Import.",
          );
        let current = json.content as Summary | null;
        let id = uploadSessionId;
        const scopeMatches =
          JSON.stringify([...(current?.campaigns ?? [])].sort()) ===
          campaignKey;
        const rangeMatches = !!current?.sources.every(
          (source) =>
            source.coverage.startIso <= (dateSelection.customStart ?? "") &&
            source.coverage.endIso >= (dateSelection.customEnd ?? ""),
        );
        if (source === "api" && (!current || !scopeMatches || !rangeMatches)) {
          if (!live) return;
          setStatus("fetching");
          const loaded = await post(
            id,
            metaReportOptions(selection),
            false,
            controller.signal,
          );
          current = loaded.content;
          id = loaded.uploadSessionId;
        }
        if (!current)
          throw Error(
            "Upload the selected report CSV on Import before continuing.",
          );
        if (JSON.stringify(current.selection) !== selectionKey)
          throw Error(
            "This import belongs to another report choice. Return to Import and import the selected report data.",
          );
        if (live) {
          resolvedIdentity.current = JSON.stringify([
            clientId,
            id,
            source,
            selectionKey,
            datesKey,
            campaignKey,
          ]);
          setSummary(current);
          setOptions(current.options);
          setStatus("ready");
          setError(null);
          callbacks.current.onSessionReady(id);
        }
      } catch (error) {
        if (live) {
          setStatus("error");
          setError(
            error instanceof Error
              ? error.message
              : "Could not prepare this report.",
          );
        }
      }
    })();
    return () => {
      live = false;
      controller.abort();
    };
    // The serialized request identity excludes callback identity and transient editing state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    clientId,
    uploadSessionId,
    source,
    selectionKey,
    datesKey,
    campaignKey,
    retry,
  ]);
  async function apply() {
    setStatus("fetching");
    setError(null);
    applyAbort.current = new AbortController();
    try {
      const loaded = await post(
        uploadSessionId,
        options,
        true,
        applyAbort.current.signal,
        images,
      );
      if (!alive.current) return;
      resolvedIdentity.current = JSON.stringify([
        clientId,
        loaded.uploadSessionId,
        source,
        selectionKey,
        datesKey,
        campaignKey,
      ]);
      setSummary(loaded.content);
      setOptions(loaded.content.options);
      setImages({});
      setStatus("ready");
      callbacks.current.onSessionReady(loaded.uploadSessionId);
    } catch (error) {
      if (alive.current) {
        setStatus("error");
        setError(
          error instanceof Error ? error.message : "Could not apply changes.",
        );
      }
    }
  }
  const ads = (summary?.ads ?? []).filter((ad) =>
    `${ad.id} ${ad.name}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <section
      className="rounded-xl border border-dash-border bg-dash-card p-4"
      aria-label="Selected report data"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-dash-ink">
          {metaReportTitle(selection)}
        </h3>
        <button
          type="button"
          onClick={onBack}
          disabled={busy || disabled}
          className="text-xs text-dash-accent hover:underline"
        >
          Change on Import
        </button>
      </div>
      <p role="status" className="mt-2 text-sm text-dash-ink-secondary">
        {busy
          ? source === "api"
            ? "Fetching the selected report data from Meta…"
            : "Checking your report data…"
          : status === "ready"
            ? `${selectedCampaigns.length} campaign${selectedCampaigns.length === 1 ? "" : "s"} · ${dateSelection.customStart} – ${dateSelection.customEnd}`
            : "Report data needs attention."}
      </p>
      {error && (
        <div className="mt-3">
          <p role="alert" className="text-sm text-dash-error">
            {error}
          </p>
          <button
            type="button"
            onClick={() => {
              if (summary && dirty) {
                void apply();
                return;
              }
              setStatus("loading");
              setRetry((value) => value + 1);
            }}
            className="mt-2 rounded border border-dash-border px-3 py-2 text-sm text-dash-ink"
          >
            Retry
          </button>
        </div>
      )}
      {selection.kind === "CREATIVE" && summary && (
        <details className="mt-3 border-t border-dash-border pt-3">
          <summary className="cursor-pointer text-sm font-medium text-dash-ink">
            Ranking, ads &amp; images{" "}
            <span className="font-normal text-dash-ink-secondary">
              · Optional
            </span>
          </summary>
          <fieldset
            disabled={busy || disabled}
            className="mt-3 space-y-3 disabled:opacity-60"
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-xs text-dash-ink-secondary">
                Rank by
                <select
                  value={options.ranking}
                  onChange={(event) =>
                    setOptions({
                      ...options,
                      ranking: event.target
                        .value as MetaContentOptions["ranking"],
                    })
                  }
                  className="mt-1 w-full rounded border border-dash-border bg-dash-bg p-2 text-dash-ink"
                >
                  <option value="cpr">Cost per result</option>
                  <option value="roas">Purchase ROAS</option>
                  <option value="ctr">CTR (all)</option>
                  <option value="spend">Spend</option>
                </select>
              </label>
              <label className="text-xs text-dash-ink-secondary">
                Minimum spend
                <input
                  type="number"
                  min="0"
                  value={options.minSpend}
                  onChange={(event) =>
                    setOptions({
                      ...options,
                      minSpend: Number(event.target.value),
                    })
                  }
                  className="mt-1 w-full rounded border border-dash-border bg-dash-bg p-2 text-dash-ink"
                />
              </label>
              <label className="text-xs text-dash-ink-secondary">
                Minimum results
                <input
                  type="number"
                  min="0"
                  value={options.minResults}
                  onChange={(event) =>
                    setOptions({
                      ...options,
                      minResults: Number(event.target.value),
                    })
                  }
                  className="mt-1 w-full rounded border border-dash-border bg-dash-bg p-2 text-dash-ink"
                />
              </label>
            </div>
            <p className="text-xs text-dash-ink-secondary">
              Ranks stay within each objective. Ads below the thresholds stay in
              the tables without a rank. ROAS needs purchase value; website
              conversion rate needs landing-page views.
            </p>
            <input
              aria-label="Search ads"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search ads"
              className="w-full rounded border border-dash-border bg-dash-bg p-2 text-sm text-dash-ink"
            />
            {ads.length > 100 && (
              <p className="text-xs text-dash-ink-secondary">
                Showing 100 matches. Search by name or Ad ID to find others; all
                selected ads remain in the report.
              </p>
            )}
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {ads.slice(0, 100).map((ad) => (
                <div
                  key={ad.id}
                  className="rounded border border-dash-border p-2"
                >
                  <label className="flex items-start gap-2 text-sm text-dash-ink">
                    <input
                      type="checkbox"
                      checked={
                        !options.selectedAdIds ||
                        options.selectedAdIds.includes(ad.id)
                      }
                      onChange={(event) => {
                        const ids = new Set(
                          options.selectedAdIds ??
                            summary.ads.map((ad) => ad.id),
                        );
                        if (event.target.checked) ids.add(ad.id);
                        else ids.delete(ad.id);
                        setOptions({ ...options, selectedAdIds: [...ids] });
                      }}
                      className="mt-1 accent-accent"
                    />
                    <span className="min-w-0 break-words">
                      {ad.name}
                      <span className="block text-xs text-dash-ink-secondary">
                        Ad ID: {ad.id} ·{" "}
                        {ad.hasImage ? "Preview ready" : "Metrics only"}
                      </span>
                    </span>
                  </label>
                  <label className="mt-2 block text-xs text-dash-ink-secondary">
                    {ad.hasImage
                      ? "Replace image (optional)"
                      : "Add image (optional)"}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) setImages({ ...images, [ad.id]: file });
                      }}
                      className="mt-1 block w-full text-xs"
                    />
                  </label>
                </div>
              ))}
            </div>
            <p className="text-xs text-dash-ink-secondary">
              PNG/JPEG/WebP below 2MB. API previews use available images or
              video posters; carousel/dynamic previews represent the ad.
            </p>
            {dirty && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void apply()}
                  className="rounded border border-dash-border px-3 py-2 text-sm text-dash-ink"
                >
                  Apply changes
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOptions(summary.options);
                    setImages({});
                  }}
                  className="px-3 py-2 text-sm text-dash-ink-secondary"
                >
                  Discard changes
                </button>
              </div>
            )}
          </fieldset>
        </details>
      )}
    </section>
  );
}
