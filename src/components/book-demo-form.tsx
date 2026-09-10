"use client";

import { useState } from "react";
import { BOOK_DEMO_TEAM_SIZES } from "@/lib/validators/book-demo";

type Status = "idle" | "loading" | "done" | "error";

const inputClassName =
  "w-full rounded-md border border-navy-border bg-navy px-3 py-2 text-sm text-white outline-none focus:border-accent";

const ERROR_MESSAGE = "Something went wrong. Please email us directly at hello@nextreport.in";

export function BookDemoForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [company, setCompany] = useState("");
  const [teamSize, setTeamSize] = useState<string>(BOOK_DEMO_TEAM_SIZES[0]);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [sentEmail, setSentEmail] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");

    try {
      const res = await fetch("/api/book-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, whatsapp, company, teamSize, message }),
      });
      if (!res.ok) {
        setStatus("error");
        return;
      }

      setSentEmail(email);
      setName("");
      setEmail("");
      setWhatsapp("");
      setCompany("");
      setTeamSize(BOOK_DEMO_TEAM_SIZES[0]);
      setMessage("");
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="rounded-lg border border-emerald-800 bg-emerald-950/30 p-5 text-sm text-emerald-300">
        Demo request sent! We&apos;ll reach out at {sentEmail} within one business day to schedule your walkthrough.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="demo-name" className="mb-1 block text-sm text-ink-secondary">
          Full Name
        </label>
        <input
          id="demo-name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className={inputClassName}
        />
      </div>

      <div>
        <label htmlFor="demo-email" className="mb-1 block text-sm text-ink-secondary">
          Work Email
        </label>
        <input
          id="demo-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@agency.com"
          className={inputClassName}
        />
      </div>

      <div>
        <label htmlFor="demo-whatsapp" className="mb-1 block text-sm text-ink-secondary">
          WhatsApp Number
        </label>
        <input
          id="demo-whatsapp"
          type="tel"
          required
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          placeholder="+91 …, +1 …, or +44 …"
          autoComplete="tel"
          className={inputClassName}
        />
        <p className="mt-1 text-xs text-ink-muted">
          Include country code (India +91, US +1, UK +44). We&apos;ll use this to confirm your demo — usually faster than email.
        </p>
      </div>

      <div>
        <label htmlFor="demo-company" className="mb-1 block text-sm text-ink-secondary">
          Agency or Company
        </label>
        <input
          id="demo-company"
          type="text"
          required
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="Your agency name"
          className={inputClassName}
        />
      </div>

      <div>
        <label htmlFor="demo-team-size" className="mb-1 block text-sm text-ink-secondary">
          Team Size
        </label>
        <select
          id="demo-team-size"
          required
          value={teamSize}
          onChange={(e) => setTeamSize(e.target.value)}
          className={inputClassName}
        >
          {BOOK_DEMO_TEAM_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="demo-message" className="mb-1 block text-sm text-ink-secondary">
          What would you like to see?
        </label>
        <textarea
          id="demo-message"
          required
          minLength={10}
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="e.g. Meta weekly reports for 8 clients, GA4 website decks, API sync vs CSV..."
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
        {status === "loading" ? "Sending…" : "Request a Demo"}
      </button>
    </form>
  );
}
