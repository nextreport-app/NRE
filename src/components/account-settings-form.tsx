"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ACCEPTED_LOGO_TYPES = "image/png,image/jpeg,image/webp,image/svg+xml";
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export function AccountSettingsForm({
  initialAgencyName,
  hasAgencyLogo,
}: {
  initialAgencyName: string | null;
  hasAgencyLogo: boolean;
}) {
  const router = useRouter();
  const [agencyName, setAgencyName] = useState(initialAgencyName ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    setLogoError(null);
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError("Logo file must be 2MB or smaller.");
      e.target.value = "";
      return;
    }
    setLogoFile(file);
    setRemoveLogo(false);
    setLogoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }

  function handleRemoveLogo() {
    setLogoFile(null);
    setLogoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setRemoveLogo(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setLoading(true);

    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agencyName }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLoading(false);
      setError(data.error || "Something went wrong.");
      return;
    }

    if (logoFile) {
      const logoFormData = new FormData();
      logoFormData.append("logo", logoFile);
      const logoRes = await fetch("/api/account/agency-logo", { method: "POST", body: logoFormData });
      if (!logoRes.ok) {
        const logoData = await logoRes.json().catch(() => ({}));
        setLoading(false);
        setError(logoData.error || "Settings saved, but the logo upload failed.");
        return;
      }
    } else if (removeLogo) {
      await fetch("/api/account/agency-logo", { method: "DELETE" });
    }

    setLoading(false);
    setLogoFile(null);
    setRemoveLogo(false);
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="mb-1 block text-sm text-ink-secondary">Agency name</label>
        <input
          value={agencyName}
          onChange={(e) => setAgencyName(e.target.value)}
          placeholder="e.g. Bright Path Marketing"
          maxLength={150}
          className="w-full rounded-md border border-navy-border bg-navy-panel px-3 py-2 text-sm text-white outline-none focus:border-accent"
        />
        <p className="mt-1 text-xs text-ink-muted">
          Shown as &quot;Prepared by {agencyName || "..."}&quot; on every report&apos;s cover slide. Leave blank to omit it.
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm text-ink-secondary">Agency logo — optional</label>
        <div className="flex items-center gap-3">
          {logoPreviewUrl ? (
            <img src={logoPreviewUrl} alt="Logo preview" className="h-10 w-20 rounded border border-navy-border bg-navy object-contain" />
          ) : hasAgencyLogo && !removeLogo ? (
            <img src="/api/account/agency-logo" alt="Current logo" className="h-10 w-20 rounded border border-navy-border bg-navy object-contain" />
          ) : null}
          <input
            type="file"
            accept={ACCEPTED_LOGO_TYPES}
            onChange={handleLogoChange}
            className="flex-1 text-sm text-ink-secondary file:mr-3 file:rounded-md file:border-0 file:bg-navy-border file:px-3 file:py-2 file:text-sm file:text-white hover:file:bg-navy-panel"
          />
          {((hasAgencyLogo && !removeLogo) || logoFile) && (
            <button
              type="button"
              onClick={handleRemoveLogo}
              className="rounded-md border border-navy-border px-3 py-2 text-sm text-ink-secondary hover:bg-navy-border"
            >
              Remove
            </button>
          )}
        </div>
        {logoError && <p className="mt-1 text-sm text-red-400">{logoError}</p>}
        <p className="mt-1 text-xs text-ink-muted">
          PNG, JPG, WebP, or SVG, up to 2MB. Shown small in the footer of every report slide.
        </p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {saved && !error && <p className="text-sm text-green-400">Saved.</p>}

      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60"
      >
        {loading ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
