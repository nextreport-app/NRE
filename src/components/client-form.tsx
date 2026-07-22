"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CURRENCIES,
  TEMPLATES,
  TEMPLATE_LABELS,
  TIMEZONES,
} from "@/lib/validators/client";
import { CURRENCY_SYMBOLS } from "@/lib/nre/format";

export type ClientFormValues = {
  accountName: string;
  currency: (typeof CURRENCIES)[number];
  timezone: string;
  monthlyBudget: number | null;
  template: (typeof TEMPLATES)[number];
  groqApiKey: string | null;
  geminiApiKey: string | null;
};

const CURRENCY_SYMBOL = CURRENCY_SYMBOLS;

export function ClientForm({
  clientId,
  initial,
}: {
  clientId?: string;
  initial?: Partial<ClientFormValues>;
}) {
  const router = useRouter();
  const [values, setValues] = useState<ClientFormValues>({
    accountName: initial?.accountName ?? "",
    currency: initial?.currency ?? "INR",
    timezone: initial?.timezone ?? "Asia/Kolkata",
    monthlyBudget: initial?.monthlyBudget ?? null,
    template: initial?.template ?? "DARK",
    groqApiKey: initial?.groqApiKey ?? "",
    geminiApiKey: initial?.geminiApiKey ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function set<K extends keyof ClientFormValues>(key: K, value: ClientFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
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
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Something went wrong.");
      return;
    }

    router.push(`/clients/${data.client.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="mb-1 block text-sm text-slate-300">Account name</label>
        <input
          required
          value={values.accountName}
          onChange={(e) => set("accountName", e.target.value)}
          placeholder="e.g. Acme Retail — Meta Ads"
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm text-slate-300">Currency</label>
          <select
            value={values.currency}
            onChange={(e) => set("currency", e.target.value as ClientFormValues["currency"])}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {CURRENCY_SYMBOL[c]} {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-300">Timezone</label>
          <select
            value={values.timezone}
            onChange={(e) => set("timezone", e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm text-slate-300">
          Monthly budget ({CURRENCY_SYMBOL[values.currency]}) — optional
        </label>
        <input
          type="number"
          min={0}
          step="0.01"
          value={values.monthlyBudget ?? ""}
          onChange={(e) => set("monthlyBudget", e.target.value ? Number(e.target.value) : null)}
          placeholder="e.g. 50000"
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
        />
        <p className="mt-1 text-xs text-slate-500">
          Used to show budget utilisation on the cover slide.
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm text-slate-300">Report template</label>
        <select
          value={values.template}
          onChange={(e) => set("template", e.target.value as ClientFormValues["template"])}
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
        >
          {TEMPLATES.map((t) => (
            <option key={t} value={t}>
              {TEMPLATE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="rounded-md border border-slate-800 p-4">
        <legend className="px-1 text-sm text-slate-300">
          AI insight writing (optional — your own API keys)
        </legend>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm text-slate-400">
              Groq API key (primary — llama-3.3-70b-versatile)
            </label>
            <input
              type="password"
              value={values.groqApiKey ?? ""}
              onChange={(e) => set("groqApiKey", e.target.value)}
              placeholder="gsk_..."
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-400">
              Gemini API key (fallback — gemini-2.5-flash)
            </label>
            <input
              type="password"
              value={values.geminiApiKey ?? ""}
              onChange={(e) => set("geminiApiKey", e.target.value)}
              placeholder="AIza..."
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      </fieldset>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
      >
        {loading ? "Saving…" : clientId ? "Save changes" : "Create client"}
      </button>
    </form>
  );
}
