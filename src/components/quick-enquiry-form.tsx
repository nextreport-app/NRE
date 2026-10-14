"use client";

import { useState } from "react";
import { useSiteCopy } from "@/hooks/use-site-copy";
import { CONTACT_SUBJECTS } from "@/lib/validators/contact";

type Status = "idle" | "loading" | "done" | "error";

const inputClassName =
  "w-full rounded-md border border-navy-border bg-navy-panel px-3 py-2 text-sm text-white outline-none placeholder:text-ink-muted focus:border-accent";

/** Compact homepage lead form — posts to the same /api/contact endpoint as /contact. */
export function QuickEnquiryForm() {
  const { home } = useSiteCopy();
  const e = home.enquiry;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setStatus("loading");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          whatsapp: whatsapp.trim(),
          subject: CONTACT_SUBJECTS[0],
          message: message.trim(),
        }),
      });
      if (!res.ok) {
        setStatus("error");
        return;
      }
      setName("");
      setEmail("");
      setWhatsapp("");
      setMessage("");
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="rounded-lg border border-emerald-800/60 bg-emerald-950/30 p-5 text-sm text-emerald-300">
        {e.success}
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
          onChange={(ev) => setName(ev.target.value)}
          placeholder={e.namePlaceholder}
          aria-label={e.namePlaceholder}
          className={inputClassName}
        />
        <input
          type="email"
          required
          value={email}
          onChange={(ev) => setEmail(ev.target.value)}
          placeholder={e.emailPlaceholder}
          aria-label={e.emailPlaceholder}
          className={inputClassName}
        />
      </div>
      <input
        type="tel"
        value={whatsapp}
        onChange={(ev) => setWhatsapp(ev.target.value)}
        placeholder={e.whatsappPlaceholder}
        aria-label={e.whatsappPlaceholder}
        autoComplete="tel"
        className={inputClassName}
      />
      <textarea
        required
        rows={3}
        value={message}
        onChange={(ev) => setMessage(ev.target.value)}
        placeholder={e.messagePlaceholder}
        aria-label={e.messagePlaceholder}
        className={inputClassName}
      />
      {status === "error" ? <p className="text-xs text-red-400">{e.error}</p> : null}
      <button
        type="submit"
        disabled={status === "loading"}
        className="w-full rounded-md bg-accent-orange px-4 py-2.5 text-sm font-semibold text-navy hover:bg-accent-orange-hover disabled:opacity-60"
      >
        {status === "loading" ? e.sending : e.send}
      </button>
    </form>
  );
}
