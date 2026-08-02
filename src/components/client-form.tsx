"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CURRENCIES,
  SELECTABLE_CURRENCIES,
  SELECTABLE_TEMPLATES,
  TEMPLATES,
  TEMPLATE_LABELS,
  TIMEZONE_GROUPS,
} from "@/lib/validators/client";
import { CURRENCY_SYMBOLS } from "@/lib/nre/format";
import { useToast } from "@/components/toast";

export type ClientFormValues = {
  accountName: string;
  currency: (typeof CURRENCIES)[number];
  timezone: string;
  monthlyBudget: number | null;
  template: (typeof TEMPLATES)[number];
};

const CURRENCY_SYMBOL = CURRENCY_SYMBOLS;

const ACCEPTED_LOGO_TYPES = "image/png,image/jpeg,image/webp,image/svg+xml";
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export function ClientForm({
  clientId,
  initial,
  hasLogo = false,
}: {
  clientId?: string;
  initial?: Partial<ClientFormValues>;
  /** Whether this client already has a logo uploaded — drives the initial preview/remove-button state on edit. Irrelevant on create (no clientId yet). */
  hasLogo?: boolean;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [values, setValues] = useState<ClientFormValues>({
    accountName: initial?.accountName ?? "",
    currency: initial?.currency ?? "INR",
    timezone: initial?.timezone ?? "Asia/Kolkata",
    monthlyBudget: initial?.monthlyBudget ?? null,
    template: initial?.template ?? "DARK",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Logo: staged separately from the JSON client fields above and uploaded
  // via a second request after the client is saved (see handleSubmit) —
  // POST /api/clients doesn't have a client id to attach a logo to until
  // the client itself has been created.
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  // A newly-selected file's local preview takes priority; otherwise, on
  // edit, fall back to the already-saved logo (via the proxy route — Blob
  // storage here is private, see /api/clients/[id]/logo's GET handler).
  // Neither present (new client, no file chosen yet) — no preview at all.
  const logoPreviewSrc = logoPreviewUrl ?? (hasLogo && !removeLogo && clientId ? `/api/clients/${clientId}/logo` : null);

  function set<K extends keyof ClientFormValues>(key: K, value: ClientFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

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
    setLoading(true);

    const url = clientId ? `/api/clients/${clientId}` : "/api/clients";
    const method = clientId ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setLoading(false);
      const message = data.error || "Something went wrong.";
      setError(message);
      showToast(message, "error");
      return;
    }

    const savedClientId: string = data.client.id;

    if (logoFile) {
      const logoFormData = new FormData();
      logoFormData.append("logo", logoFile);
      const logoRes = await fetch(`/api/clients/${savedClientId}/logo`, { method: "POST", body: logoFormData });
      if (!logoRes.ok) {
        const logoData = await logoRes.json().catch(() => ({}));
        setLoading(false);
        const message = logoData.error || "Client saved, but the logo upload failed.";
        setError(message);
        showToast(message, "error");
        return;
      }
    } else if (removeLogo) {
      await fetch(`/api/clients/${savedClientId}/logo`, { method: "DELETE" });
    }

    setLoading(false);
    showToast(clientId ? "Client updated." : "Client created.");
    router.push(`/clients/${savedClientId}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="mb-1 block text-sm text-dash-ink-secondary">Account name</label>
        <input
          required
          value={values.accountName}
          onChange={(e) => set("accountName", e.target.value)}
          placeholder="e.g. Acme Retail — Meta Ads"
          className="w-full rounded-md border border-dash-border bg-dash-card px-3 py-2 text-sm text-dash-ink outline-none focus:border-dash-accent"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm text-dash-ink-secondary">Client logo — optional</label>
        <div className="flex items-center gap-3">
          <input
            type="file"
            accept={ACCEPTED_LOGO_TYPES}
            onChange={handleLogoChange}
            className="flex-1 text-sm text-dash-ink-secondary file:mr-3 file:rounded-md file:border-0 file:bg-dash-border file:px-3 file:py-2 file:text-sm file:text-dash-ink hover:file:bg-dash-card"
          />
          {((hasLogo && !removeLogo) || logoFile) && (
            <button
              type="button"
              onClick={handleRemoveLogo}
              className="rounded-md border border-dash-border px-3 py-2 text-sm text-dash-ink-secondary hover:bg-dash-border"
            >
              Remove
            </button>
          )}
        </div>
        {logoPreviewSrc && (
          <img
            src={logoPreviewSrc}
            alt="Logo preview"
            className="mt-2 h-[60px] w-[120px] rounded border border-dash-border bg-dash-bg object-contain"
          />
        )}
        {logoError && <p className="mt-1 text-sm text-dash-error">{logoError}</p>}
        <p className="mt-1 text-[13px] text-dash-ink-secondary">
          Upload PNG or SVG with transparent background. Minimum 200px wide recommended. Max 2MB.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm text-dash-ink-secondary">Currency</label>
          <select
            value={values.currency}
            onChange={(e) => set("currency", e.target.value as ClientFormValues["currency"])}
            className="w-full rounded-md border border-dash-border bg-dash-card px-3 py-2 text-sm text-dash-ink outline-none focus:border-dash-accent"
          >
            {SELECTABLE_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {CURRENCY_SYMBOL[c]} {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm text-dash-ink-secondary">Timezone</label>
          <select
            value={values.timezone}
            onChange={(e) => set("timezone", e.target.value)}
            className="w-full rounded-md border border-dash-border bg-dash-card px-3 py-2 text-sm text-dash-ink outline-none focus:border-dash-accent"
          >
            {TIMEZONE_GROUPS.map((group) => (
              <optgroup key={group.region} label={`${group.flag} ${group.region}`}>
                {group.zones.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm text-dash-ink-secondary">
          Monthly budget ({CURRENCY_SYMBOL[values.currency]}) — optional
        </label>
        <input
          type="number"
          min={0}
          step="0.01"
          value={values.monthlyBudget ?? ""}
          onChange={(e) => set("monthlyBudget", e.target.value ? Number(e.target.value) : null)}
          placeholder="e.g. 50000"
          className="w-full rounded-md border border-dash-border bg-dash-card px-3 py-2 text-sm text-dash-ink outline-none focus:border-dash-accent"
        />
        <p className="mt-1 text-[13px] text-dash-ink-secondary">
          Used to show budget utilisation on the cover slide.
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm text-dash-ink-secondary">Report template</label>
        <select
          value={values.template}
          onChange={(e) => set("template", e.target.value as ClientFormValues["template"])}
          className="w-full rounded-md border border-dash-border bg-dash-card px-3 py-2 text-sm text-dash-ink outline-none focus:border-dash-accent"
        >
          {SELECTABLE_TEMPLATES.map((t) => (
            <option key={t} value={t}>
              {TEMPLATE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-dash-error">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-dash-accent px-4 py-2 text-sm font-medium text-dash-ink hover:bg-dash-accent-hover disabled:opacity-60"
      >
        {loading ? "Saving…" : clientId ? "Save changes" : "Create client"}
      </button>
    </form>
  );
}
