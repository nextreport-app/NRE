"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ReportDownloadLink } from "./report-download-link";
interface Asset {
  id: string;
  name: string;
  baseVariant: "DARK" | "LIGHT";
  status: string;
  digest: string | null;
  approvedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  _count: { clients: number; reports: number };
}
const button =
  "rounded-lg border border-dash-border px-3 py-2 text-sm disabled:opacity-50";
export function AgencyTemplateLibrary() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [asOf, setAsOf] = useState(0);
  const [assets, setAssets] = useState<Asset[] | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [name, setName] = useState(""),
    [variant, setVariant] = useState<"DARK" | "LIGHT">("DARK"),
    [file, setFile] = useState<File | null>(null),
    [reviewed, setReviewed] = useState<Record<string, boolean>>({});
  const load = useCallback(async () => {
    const response = await fetch("/api/account/templates", {
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok) throw Error(data.error ?? "Designs could not load.");
    setAssets(data.templates);
    setAsOf(Date.now());
  }, []);
  useEffect(() => {
    const refresh = () => void load().catch((e) => setError(e.message));
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [load]);
  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      setError("Keep the PowerPoint file under 4 MB.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("name", name);
      form.set("variant", variant);
      const response = await fetch("/api/account/templates/upload", {
        method: "POST",
        body: form,
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error ?? "Upload failed.");
      setName("");
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      setNotice(
        "Design checked. Download its sample, review it, then approve it for client use.",
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }
  async function action(asset: Asset, method: "PATCH" | "DELETE") {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/account/templates/${asset.id}`, {
        method,
        headers: { "Content-Type": "application/json" },
        ...(method === "PATCH"
          ? { body: JSON.stringify({ reviewed: true, digest: asset.digest }) }
          : {}),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error ?? "Design update failed.");
      setNotice(
        method === "PATCH"
          ? "Approved. Choose this design on a client's Manage page → Report design."
          : data.archived
            ? "Archived for new reports. Existing reports keep their saved design."
            : "Unused design removed.",
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Design update failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="rounded-xl border border-dash-border bg-dash-card p-4 text-dash-ink">
      <p className="text-sm">
        Download a starter, restyle it, then upload and check a sample.{" "}
        <span className="text-xs text-dash-ink-secondary">
          Beta · Meta PPTX &amp; Google Slides
        </span>
      </p>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-dash-ink-secondary">
          What can I customize?
        </summary>
        <p className="mt-2 text-dash-ink-secondary">
          Use your artwork, fills and borders. Keep the starter&apos;s four
          slides, text, placeholders, data-box positions and table sizes. Data
          fonts and generated report sections use the standard readable layout.
        </p>
        <p className="mt-2 text-dash-ink-secondary">
          Existing agency decks need adaptation to this starter. Browser reports
          keep their responsive layout and your account branding. Uploads are
          limited to 4 MB.
        </p>
      </details>
      <div className="mt-4 flex flex-wrap gap-2">
        <a
          className={button}
          href="/api/account/templates/starter?variant=DARK"
          download
        >
          Download dark starter
        </a>
        <a
          className={button}
          href="/api/account/templates/starter?variant=LIGHT"
          download
        >
          Download light starter
        </a>
      </div>
      <form
        onSubmit={(e) => void upload(e)}
        className="mt-4 grid gap-3 sm:grid-cols-2"
      >
        <label className="text-sm">
          Design name
          <input
            required
            maxLength={80}
            className="mt-1 block w-full rounded-lg border border-dash-border bg-dash-bg px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Agency navy design"
          />
        </label>
        <label className="text-sm">
          Starter used
          <select
            className="mt-1 block w-full rounded-lg border border-dash-border bg-dash-bg px-3 py-2"
            value={variant}
            onChange={(e) => setVariant(e.target.value as typeof variant)}
          >
            <option value="DARK">Dark</option>
            <option value="LIGHT">Light</option>
          </select>
        </label>
        <label className="text-sm sm:col-span-2">
          Restyled PowerPoint
          <input
            ref={fileInput}
            required
            type="file"
            accept=".pptx"
            className="mt-1 block w-full max-w-full text-sm"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <button
          disabled={busy || !file || !name.trim()}
          className={`${button} sm:justify-self-start`}
        >
          {busy ? "Checking design…" : "Upload & check"}
        </button>
      </form>
      {notice && (
        <p role="status" className="mt-3 text-sm text-dash-ink-secondary">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-amber-400">
          {error}
        </p>
      )}
      {assets === null && !error && (
        <p className="mt-4 text-sm text-dash-ink-secondary">
          Loading saved designs…
        </p>
      )}
      {assets?.map((asset) => (
        <section
          key={asset.id}
          className="mt-4 min-w-0 rounded-lg border border-dash-border p-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="min-w-0 max-w-full break-words font-medium">
              {asset.name}
            </h3>
            <span className="text-xs text-dash-ink-secondary">
              {asset.archivedAt
                ? "Archived"
                : asset.status !== "READY"
                  ? "Uploading"
                  : asset.approvedAt
                    ? "Approved"
                    : "Review sample"}{" "}
              · {asset.baseVariant.toLowerCase()}
            </span>
          </div>
          <p className="mt-1 text-xs text-dash-ink-secondary">
            {asset._count.clients} clients · {asset._count.reports} saved
            reports
          </p>
          {asset.status === "READY" && (
            <div className="mt-3 flex flex-wrap gap-3">
              <ReportDownloadLink
                href={`/api/account/templates/${asset.id}/download?preview=1`}
                className="text-sm text-dash-accent hover:underline"
              >
                Download sample report
              </ReportDownloadLink>
              <a
                className="text-sm text-dash-ink-secondary hover:underline"
                href={`/api/account/templates/${asset.id}/download`}
              >
                Download design
              </a>
            </div>
          )}
          {asset.status === "READY" &&
            !asset.approvedAt &&
            !asset.archivedAt && (
              <div className="mt-3">
                <label className="flex gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!reviewed[asset.id]}
                    onChange={(e) =>
                      setReviewed({ ...reviewed, [asset.id]: e.target.checked })
                    }
                  />
                  I checked the sample and its text is readable.
                </label>
                <button
                  disabled={busy || !reviewed[asset.id]}
                  className={`${button} mt-2`}
                  onClick={() => void action(asset, "PATCH")}
                >
                  Approve for client use
                </button>
              </div>
            )}
          {asset.archivedAt && (
            <p className="mt-2 text-xs text-dash-ink-secondary">
              Retained while saved reports use this design. Remove it after
              those reports expire.
            </p>
          )}
          <button
            className="mt-3 text-xs text-dash-ink-secondary hover:underline disabled:opacity-50"
            disabled={
              busy ||
              (asset.status === "UPLOADING" &&
                asOf - Date.parse(asset.createdAt) < 15 * 60000)
            }
            onClick={() => void action(asset, "DELETE")}
          >
            {asset._count.reports
              ? "Archive for new reports"
              : "Remove unused design"}
          </button>
        </section>
      ))}
    </div>
  );
}
