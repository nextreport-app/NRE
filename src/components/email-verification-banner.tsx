"use client";
import { useState } from "react";
export function EmailVerificationBanner() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function resend() {
    setBusy(true);
    try {
      const res = await fetch("/api/auth/resend-verification", { method: "POST" });
      const body = await res.json();
      setMessage(res.ok ? "Verification email sent. Check your inbox and spam folder." : body.error || "Could not send email.");
    } catch { setMessage("Could not reach the server. Please try again."); }
    finally { setBusy(false); }
  }
  return <div id="verify-email" className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-sm text-dash-ink"><span>Verify your email before adding clients or generating reports. </span><button type="button" disabled={busy} className="font-semibold text-dash-accent underline disabled:opacity-50" onClick={() => void resend()}>{busy ? "Sending…" : "Send verification email"}</button>{message && <p role="status" className="mt-1">{message}</p>}</div>;
}
