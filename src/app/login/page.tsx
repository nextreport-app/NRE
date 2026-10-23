"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { messageForAuthSignInError } from "@/lib/auth-sign-in-errors";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { isGoogleSignInEnabled } from "@/lib/google-sign-in-enabled";
import { AuthFieldLabel, AuthPageShell, authInputClassName } from "@/components/auth/auth-page-shell";
import { PasswordInput } from "@/components/auth/password-input";
import { normalizeAuthEmail } from "@/lib/normalize-auth-email";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/clients";
  const authErrorCode = params.get("error");
  const authErrorCodeDetail = params.get("code");
  const passwordResetOk = params.get("reset") === "1";
  const prefilledEmail = params.get("email")?.trim() ?? "";

  const [email, setEmail] = useState(prefilledEmail);
  const [password, setPassword] = useState("");
  const urlError =
    messageForAuthSignInError(authErrorCodeDetail) ?? messageForAuthSignInError(authErrorCode);
  const [formError, setFormError] = useState<string | null>(null);
  const error = formError ?? urlError;
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setLoading(true);
    const normalizedEmail = normalizeAuthEmail(email);
    const res = await signIn("credentials", {
      email: normalizedEmail,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      const hintRes = await fetch("/api/auth/account-login-hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const hintJson = (await hintRes.json().catch(() => ({}))) as { hint?: string };

      if (hintJson.hint === "oauth_only") {
        setFormError(
          "This account was created with Google and has no password yet. Use Forgot password to set one — same account and data, no Google approval needed.",
        );
        return;
      }

      setFormError(
        isGoogleSignInEnabled()
          ? "Invalid email or password. If you signed up with Google, use Continue with Google — or reset your password below."
          : "Invalid email or password. Use forgot password below, or contact support if you need help.",
      );
      return;
    }
    router.push(callbackUrl);
  }

  const forgotHref =
    email.trim().length > 0
      ? `/forgot-password?email=${encodeURIComponent(email.trim())}`
      : "/forgot-password";

  return (
    <AuthPageShell
      title="Log in"
      subtitle="Access your agency workspace and client reports."
      footer={
        <p className="text-center text-sm text-ink-muted">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium text-accent hover:underline">
            Sign up free
          </Link>
        </p>
      }
    >
      {passwordResetOk ? (
        <p className="mb-4 rounded-md border border-emerald-800/50 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-200">
          Password updated. Log in with your new password.
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <AuthFieldLabel htmlFor="email">Email</AuthFieldLabel>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={authInputClassName}
            placeholder="you@agency.com"
          />
        </div>
        <div>
          <AuthFieldLabel
            htmlFor="password"
            action={
              <Link href={forgotHref} className="text-xs font-medium text-accent hover:underline">
                Forgot password?
              </Link>
            }
          >
            Password
          </AuthFieldLabel>
          <PasswordInput
            id="password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            placeholder="Your password"
          />
        </div>
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        <button
          type="submit"
          disabled={loading || googleLoading}
          className="w-full rounded-md bg-accent px-3 py-2.5 text-sm font-semibold text-navy hover:bg-accent-hover disabled:opacity-60"
        >
          {loading ? "Logging in…" : "Log in"}
        </button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs text-ink-muted">
        <div className="h-px flex-1 bg-navy-border" />
        or
        <div className="h-px flex-1 bg-navy-border" />
      </div>

      <GoogleSignInButton
        callbackUrl={callbackUrl}
        disabled={loading}
        loading={googleLoading}
        onStart={() => {
          setFormError(null);
          setGoogleLoading(true);
        }}
      />

      {isGoogleSignInEnabled() ? (
        <p className="mt-4 text-center text-xs leading-relaxed text-ink-muted">
          Use Google if you signed up that way — no separate password needed.
        </p>
      ) : null}
    </AuthPageShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
