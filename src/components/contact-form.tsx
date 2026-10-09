"use client";

import { useState } from "react";
import { CONTACT_SUBJECTS, contactSchema } from "@/lib/validators/contact";

type Status = "idle" | "loading" | "done" | "error";

const inputClassName =
  "w-full rounded-md border border-navy-border bg-navy px-3 py-2 text-sm text-white outline-none focus:border-accent";

// Fixed wording per spec — shown for any failure (network error or a
// non-2xx response) rather than surfacing the server's own validation
// message, since the form's own required/type/minLength attributes already
// catch the common cases before a request is even sent.
const ERROR_MESSAGE = "Something went wrong. Please email us directly at hello@nextreport.in";

export function ContactForm({
  defaultSubject = CONTACT_SUBJECTS[0],
  messagePlaceholder = "Tell us how we can help...",
}: {
  defaultSubject?: (typeof CONTACT_SUBJECTS)[number];
  messagePlaceholder?: string;
} = {}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [subject, setSubject] = useState<string>(defaultSubject);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [whatsappError, setWhatsappError] = useState<string | null>(null);
  // Captured at submit time, not read back from state after clearing the
  // form — the success message below still needs to show the address the
  // message was sent about, even after the fields themselves are reset.
  const [sentEmail, setSentEmail] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setWhatsappError(null);

    const parsed = contactSchema.safeParse({ name, email, whatsapp, subject, message });
    if (!parsed.success) {
      const issues = parsed.error.issues;
      const whatsappIssue = issues.find((i) => i.path[0] === "whatsapp");
      if (whatsappIssue) setWhatsappError(whatsappIssue.message);
      setErrorMessage(issues[0]?.message ?? ERROR_MESSAGE);
      setStatus("error");
      return;
    }

    setStatus("loading");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        const apiMsg = typeof data?.error === "string" ? data.error : null;
        if (apiMsg && apiMsg.toLowerCase().includes("country code")) {
          setWhatsappError(apiMsg);
        }
        setErrorMessage(apiMsg ?? ERROR_MESSAGE);
        setStatus("error");
        return;
      }

      setSentEmail(email);
      setName("");
      setEmail("");
      setWhatsapp("");
      setSubject(defaultSubject);
      setMessage("");
      setStatus("done");
    } catch {
      setErrorMessage(ERROR_MESSAGE);
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="rounded-lg border border-emerald-800 bg-emerald-950/30 p-5 text-sm text-emerald-300">
        Message sent! We&apos;ll get back to you at {sentEmail} within one business day.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="contact-name" className="mb-1 block text-sm text-ink-secondary">
          Full Name
        </label>
        <input
          id="contact-name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className={inputClassName}
        />
      </div>

      <div>
        <label htmlFor="contact-email" className="mb-1 block text-sm text-ink-secondary">
          Email Address
        </label>
        <input
          id="contact-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          className={inputClassName}
        />
      </div>

      <div>
        <label htmlFor="contact-whatsapp" className="mb-1 block text-sm text-ink-secondary">
          WhatsApp Number
        </label>
        <input
          id="contact-whatsapp"
          type="tel"
          required
          value={whatsapp}
          onChange={(e) => {
            setWhatsapp(e.target.value);
            if (whatsappError) setWhatsappError(null);
            if (errorMessage) setErrorMessage(null);
            if (status === "error") setStatus("idle");
          }}
          placeholder="+91 …, +1 …, or +44 …"
          autoComplete="tel"
          aria-invalid={whatsappError ? true : undefined}
          aria-describedby={whatsappError ? "contact-whatsapp-error" : "contact-whatsapp-hint"}
          className={`${inputClassName}${whatsappError ? " border-red-800 focus:border-red-500" : ""}`}
        />
        {whatsappError ? (
          <p id="contact-whatsapp-error" className="mt-1 text-xs text-red-400">
            {whatsappError}
          </p>
        ) : (
          <p id="contact-whatsapp-hint" className="mt-1 text-xs text-ink-muted">
            Include country code (India +91, US +1, UK +44). We often reply faster on WhatsApp than email.
          </p>
        )}
      </div>

      <div>
        <label htmlFor="contact-subject" className="mb-1 block text-sm text-ink-secondary">
          Subject
        </label>
        <select
          id="contact-subject"
          required
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className={inputClassName}
        >
          {CONTACT_SUBJECTS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="contact-message" className="mb-1 block text-sm text-ink-secondary">
          Message
        </label>
        <textarea
          id="contact-message"
          required
          minLength={10}
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={messagePlaceholder}
          className={inputClassName}
        />
      </div>

      {status === "error" && errorMessage && !whatsappError && (
        <div className="rounded-md border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">{errorMessage}</div>
      )}

      <button
        type="submit"
        disabled={status === "loading"}
        className="w-full rounded-md bg-accent-orange px-4 py-2.5 text-sm font-semibold text-navy hover:bg-accent-orange-hover disabled:opacity-60"
      >
        {status === "loading" ? "Sending…" : "Send Message"}
      </button>
    </form>
  );
}
