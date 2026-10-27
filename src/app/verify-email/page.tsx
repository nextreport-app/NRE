"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
function VerifyForm() {
  const token = useSearchParams().get("token");
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  async function verify() {
    setBusy(true);
    try {
      const res = await fetch("/api/auth/verify-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
      const body = await res.json();
      if (res.ok) { setDone(true); setMessage("Email verified. Your workspace is ready."); }
      else setMessage(body.error || "Could not verify your email.");
    } catch { setMessage("Could not reach the server. Try again."); }
    finally { setBusy(false); }
  }
  return <AuthPageShell title="Verify your email" subtitle="Confirm your email to start creating client reports." footer={<Link href="/clients" className="text-accent">Continue to your workspace →</Link>}>
    <p role="status" className="mb-4 text-sm text-ink-secondary">{message}</p>
    {!done && <button type="button" disabled={busy || !token} onClick={() => void verify()} className="w-full rounded-md bg-accent px-4 py-3 font-medium text-[#0d1b2e] disabled:opacity-50">{busy ? "Verifying…" : "Verify email"}</button>}
  </AuthPageShell>;
}
export default function VerifyEmailPage() { return <Suspense><VerifyForm /></Suspense>; }
