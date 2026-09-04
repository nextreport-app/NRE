"use client";

import { useState } from "react";
import { SUPPORT_TICKET_CATEGORIES } from "@/lib/validators/support-ticket";

type Status = "idle" | "loading" | "done" | "error";

type ClientOption = { id: string; accountName: string };
type ReportOption = { id: string; label: string };

const inputClassName =
  "w-full rounded-md border border-dash-border bg-dash-card px-3 py-2 text-sm text-dash-ink outline-none focus:border-dash-accent";

export function SupportTicketForm({
  defaultName,
  defaultEmail,
  clients = [],
  reports = [],
  defaultClientId,
  defaultReportId,
}: {
  defaultName?: string | null;
  defaultEmail?: string | null;
  clients?: ClientOption[];
  reports?: ReportOption[];
  defaultClientId?: string;
  defaultReportId?: string;
}) {
  const [name, setName] = useState(defaultName ?? "");
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [phone, setPhone] = useState("");
  const [category, setCategory] = useState<string>(SUPPORT_TICKET_CATEGORIES[0]);
  const [message, setMessage] = useState("");
  const [clientId, setClientId] = useState(defaultClientId ?? "");
  const [reportId, setReportId] = useState(defaultReportId ?? "");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    const formData = new FormData();
    formData.set("name", name.trim());
    formData.set("email", email.trim());
    if (phone.trim()) formData.set("phone", phone.trim());
    formData.set("category", category);
    formData.set("message", message.trim());
    if (clientId) formData.set("clientId", clientId);
    if (reportId) formData.set("reportId", reportId);
    if (attachment) formData.set("attachment", attachment);

    try {
      const res = await fetch("/api/support", { method: "POST", body: formData });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setErrorMessage(data?.error ?? "Something went wrong. Email hello@nextreport.in directly.");
        setStatus("error");
        return;
      }
      setMessage("");
      setAttachment(null);
      setStatus("done");
    } catch {
      setErrorMessage("Something went wrong. Email hello@nextreport.in directly.");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="rounded-lg border border-emerald-800 bg-emerald-950/30 p-5 text-sm text-emerald-300">
        Support ticket submitted. We&apos;ll review your account details and get back to you at{" "}
        <span className="font-medium text-emerald-200">{email}</span> as soon as possible — usually within one
        business day.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="support-name" className="mb-1 block text-sm text-dash-ink-secondary">
            Full name
          </label>
          <input
            id="support-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClassName}
          />
        </div>
        <div>
          <label htmlFor="support-email" className="mb-1 block text-sm text-dash-ink-secondary">
            Email
          </label>
          <input
            id="support-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClassName}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="support-phone" className="mb-1 block text-sm text-dash-ink-secondary">
            Phone / WhatsApp <span className="text-dash-ink-muted">(optional)</span>
          </label>
          <input
            id="support-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 …"
            className={inputClassName}
          />
        </div>
        <div>
          <label htmlFor="support-category" className="mb-1 block text-sm text-dash-ink-secondary">
            Issue type
          </label>
          <select
            id="support-category"
            required
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={inputClassName}
          >
            {SUPPORT_TICKET_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {clients.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="support-client" className="mb-1 block text-sm text-dash-ink-secondary">
              Client account <span className="text-dash-ink-muted">(optional)</span>
            </label>
            <select
              id="support-client"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className={inputClassName}
            >
              <option value="">— Select client —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.accountName}
                </option>
              ))}
            </select>
          </div>
          {reports.length > 0 && (
            <div>
              <label htmlFor="support-report" className="mb-1 block text-sm text-dash-ink-secondary">
                Report <span className="text-dash-ink-muted">(optional)</span>
              </label>
              <select
                id="support-report"
                value={reportId}
                onChange={(e) => setReportId(e.target.value)}
                className={inputClassName}
              >
                <option value="">— Select report —</option>
                {reports.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      <div>
        <label htmlFor="support-message" className="mb-1 block text-sm text-dash-ink-secondary">
          What went wrong or what do you need?
        </label>
        <textarea
          id="support-message"
          required
          minLength={10}
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Describe the step you were on, what you expected, and what happened instead…"
          className={inputClassName}
        />
      </div>

      <div>
        <label htmlFor="support-attachment" className="mb-1 block text-sm text-dash-ink-secondary">
          Attach CSV or screenshot <span className="text-dash-ink-muted">(optional, max 10 MB)</span>
        </label>
        <input
          id="support-attachment"
          type="file"
          accept=".csv,.xlsx,.xls,.tsv,.txt,image/*,.pdf"
          onChange={(e) => setAttachment(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-dash-ink-secondary file:mr-3 file:rounded-md file:border-0 file:bg-dash-accent file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-dash-ink hover:file:bg-dash-accent-hover"
        />
      </div>

      {status === "error" && errorMessage && (
        <div className="rounded-md border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">{errorMessage}</div>
      )}

      <button
        type="submit"
        disabled={status === "loading"}
        className="rounded-md bg-dash-accent px-5 py-2.5 text-sm font-semibold text-dash-ink hover:bg-dash-accent-hover disabled:opacity-60"
      >
        {status === "loading" ? "Submitting…" : "Submit support ticket"}
      </button>
    </form>
  );
}
