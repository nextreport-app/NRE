"use client";

import { useState } from "react";
import { CONTACT_SUBJECTS } from "@/lib/validators/contact";

type Status = "idle" | "loading" | "done" | "error";

const inputClassName =
  "w-full rounded-md border border-navy-border bg-navy-panel px-3 py-2 text-sm text-white outline-none placeholder:text-ink-muted focus:border-accent";

/** Compact homepage lead form — posts to the same /api/contact endpoint as /contact. */
export function QuickEnquiryForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    const body = phone.trim()
      ? `Phone: ${phone.trim()}\n\n${message.trim()}`
      : message.trim();

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          subject: CONTACT_SUBJECTS[0],
          message: body,
        }),
      });
      if (!res.ok) {
        setStatus("error");
        return;
      }
      setName("");
      setEmail("");
      setPhone("");
      setMessage("");
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="rounded-lg border border-emerald-800/60 bg-emerald-950/30 p-5 text-sm text-emerald-300">
        Thanks — we&apos;ll reply within one business day.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          aria-label="Your name"
          className={inputClassName}
        />
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Work email"
          aria-label="Work email"
          className={inputClassName}
        />
      </div>
      <input
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="Phone (optional)"
        aria-label="Phone number"
        className={inputClassName}
      />
      <textarea
        required
        minLength={10}
        rows={3}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Tell us about your agency or ask a question…"
        aria-label="Message"
        className={inputClassName}
      />
      {status === "error" ? (
        <p className="text-xs text-red-400">Something went wrong — email hello@nextreport.in directly.</p>
      ) : null}
      <button
        type="submit"
        disabled={status === "loading"}
        className="w-full rounded-md bg-accent-orange px-4 py-2.5 text-sm font-semibold text-navy hover:bg-accent-orange-hover disabled:opacity-60"
      >
        {status === "loading" ? "Sending…" : "Send enquiry"}
      </button>
    </form>
  );
}
