"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthFieldLabel, AuthPageShell } from "@/components/auth/auth-page-shell";
import { PasswordInput } from "@/components/auth/password-input";

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!token) {
      setError("Reset link is invalid. Request a new one from the login page.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Could not reset password.");
      return;
    }
    const loginEmail =
      typeof data.email === "string" && data.email.trim().length > 0
        ? `&email=${encodeURIComponent(data.email.trim())}`
        : "";
    router.push(`/login?reset=1${loginEmail}`);
  }

  if (!token) {
    return (
      <AuthPageShell
        title="Invalid reset link"
        subtitle="This link is missing or incomplete."
        footer={
          <p className="text-center text-sm text-ink-muted">
            <Link href="/forgot-password" className="font-medium text-accent hover:underline">
              Request a new reset link
            </Link>
          </p>
        }
      >
        <p className="text-sm text-ink-secondary">Open the link from your email, or request a fresh one.</p>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell
      title="Choose a new password"
      subtitle="At least 8 characters. You will log in with this password on all devices."
      footer={
        <p className="text-center text-sm text-ink-muted">
          <Link href="/login" className="font-medium text-accent hover:underline">
            Back to log in
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <AuthFieldLabel htmlFor="password">New password</AuthFieldLabel>
          <PasswordInput
            id="password"
            value={password}
            onChange={setPassword}
            minLength={8}
            autoComplete="new-password"
            placeholder="At least 8 characters"
          />
        </div>
        <div>
          <AuthFieldLabel htmlFor="confirm">Confirm password</AuthFieldLabel>
          <PasswordInput
            id="confirm"
            value={confirm}
            onChange={setConfirm}
            minLength={8}
            autoComplete="new-password"
            placeholder="Repeat password"
          />
        </div>
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-accent px-3 py-2.5 text-sm font-semibold text-navy hover:bg-accent-hover disabled:opacity-60"
        >
          {loading ? "Saving…" : "Update password"}
        </button>
      </form>
    </AuthPageShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
