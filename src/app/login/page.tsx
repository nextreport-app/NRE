"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { messageForAuthSignInError } from "@/lib/auth-sign-in-errors";
import { GOOGLE_LOGIN_AUTHORIZATION_PARAMS } from "@/lib/auth-google-sign-in";
import { AuthFieldLabel, AuthPageShell, authInputClassName } from "@/components/auth/auth-page-shell";
import { PasswordInput } from "@/components/auth/password-input";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/clients";
  const authErrorCode = params.get("error");
  const passwordResetOk = params.get("reset") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const urlError = messageForAuthSignInError(authErrorCode);
  const [formError, setFormError] = useState<string | null>(null);
  const error = formError ?? urlError;
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setLoading(true);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setFormError("Invalid email or password.");
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

      <button
        type="button"
        disabled={googleLoading || loading}
        onClick={() => {
          setFormError(null);
          setGoogleLoading(true);
          void signIn("google", { callbackUrl }, GOOGLE_LOGIN_AUTHORIZATION_PARAMS);
        }}
        className="w-full rounded-md border border-navy-border bg-navy px-3 py-2.5 text-sm font-medium text-ink hover:bg-navy-border disabled:opacity-60"
      >
        {googleLoading ? "Redirecting to Google…" : "Continue with Google"}
      </button>

      <p className="mt-4 text-center text-xs leading-relaxed text-ink-muted">
        Use Google if you signed up that way — no separate password needed.
      </p>
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
