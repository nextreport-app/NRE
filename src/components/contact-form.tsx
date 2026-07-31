"use client";

import { useState } from "react";
import { CONTACT_SUBJECTS } from "@/lib/validators/contact";

type Status = "idle" | "loading" | "done" | "error";

const inputClassName =
  "w-full rounded-md border border-navy-border bg-navy px-3 py-2 text-sm text-white outline-none focus:border-accent";

// Fixed wording per spec — shown for any failure (network error or a
// non-2xx response) rather than surfacing the server's own validation
// message, since the form's own required/type/minLength attributes already
// catch the common cases before a request is even sent.
const ERROR_MESSAGE = "Something went wrong. Please email us directly at hello@nextreport.in";

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState<string>(CONTACT_SUBJECTS[0]);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  // Captured at submit time, not read back from state after clearing the
  // form — the success message below still needs to show the address the
  // message was sent about, even after the fields themselves are reset.
  const [sentEmail, setSentEmail] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, subject, message }),
      });
      if (!res.ok) {
        setStatus("error");
        return;
      }

      setSentEmail(email);
      setName("");
      setEmail("");
      setSubject(CONTACT_SUBJECTS[0]);
      setMessage("");
      setStatus("done");
    } catch {
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
          placeholder="Tell us how we can help..."
          className={inputClassName}
        />
      </div>

      {status === "error" && (
        <div className="rounded-md border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">{ERROR_MESSAGE}</div>
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
