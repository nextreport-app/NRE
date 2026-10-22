"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthFieldLabel, AuthPageShell, authInputClassName } from "@/components/auth/auth-page-shell";

function ForgotPasswordForm() {
  const params = useSearchParams();
  const queryEmail = params.get("email")?.trim() ?? "";
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const address = email.trim() || queryEmail;
    setLoading(true);
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: address }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Something went wrong. Try again.");
      return;
    }
    setSubmittedEmail(address);
    setSent(true);
  }

  return (
    <AuthPageShell
      title="Reset your password"
      subtitle="We will email you a secure link if this address is registered."
      footer={
        <p className="text-center text-sm text-ink-muted">
          Remember your password?{" "}
          <Link href="/login" className="font-medium text-accent hover:underline">
            Log in
          </Link>
        </p>
      }
    >
      {sent ? (
        <div className="space-y-3 text-sm leading-relaxed text-ink-secondary">
          <p>
            If an account exists with <strong className="text-ink">{submittedEmail}</strong>, check your inbox for a reset link
            (expires in 1 hour). You can set or change your password even if you originally signed up with Google.
          </p>
          <p className="text-ink-muted">
            Prefer Google sign-in when it&apos;s enabled? Use{" "}
            <strong className="text-ink-secondary">Continue with Google</strong> on the login page — your
            password is optional in that case.
          </p>
          <Link href="/login" className="inline-block text-sm font-medium text-accent hover:underline">
            Return to log in →
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <AuthFieldLabel htmlFor="email">Email</AuthFieldLabel>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email || queryEmail}
              onChange={(e) => setEmail(e.target.value)}
              className={authInputClassName}
              placeholder="you@agency.com"
            />
          </div>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-accent px-3 py-2.5 text-sm font-semibold text-navy hover:bg-accent-hover disabled:opacity-60"
          >
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
    </AuthPageShell>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordForm />
    </Suspense>
  );
}
