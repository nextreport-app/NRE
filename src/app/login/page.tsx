"use client";

import { useEffect, useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { messageForAuthSignInError } from "@/lib/auth-sign-in-errors";
import { GOOGLE_LOGIN_AUTHORIZATION_PARAMS } from "@/lib/auth-google-sign-in";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/clients";
  const authErrorCode = params.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    const fromUrl = messageForAuthSignInError(authErrorCode);
    if (fromUrl) setError(fromUrl);
  }, [authErrorCode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Invalid email or password.");
      return;
    }
    router.push(callbackUrl);
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-4">
      <div className="mb-8 text-center">
        <Link href="/" className="inline-flex items-center justify-center gap-2">
          <img src="/logo.png" alt="NextReport logo" style={{ height: "36px", width: "36px", display: "block" }} />
          <span
            style={{
              fontWeight: 700,
              fontSize: "22px",
              color: "white",
              letterSpacing: "-0.3px",
              fontFamily: "var(--font-inter), sans-serif",
            }}
          >
            NextReport
          </span>
        </Link>
        <p className="mt-2 text-sm text-ink-muted">Log in to your workspace</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm text-ink-secondary">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-navy-border bg-navy-panel px-3 py-2 text-sm text-white outline-none focus:border-accent"
            placeholder="you@agency.com"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-ink-secondary">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-navy-border bg-navy-panel px-3 py-2 text-sm text-white outline-none focus:border-accent"
            placeholder="••••••••"
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60"
        >
          {loading ? "Logging in…" : "Log in"}
        </button>
      </form>

      <div className="my-4 flex items-center gap-3 text-xs text-ink-muted">
        <div className="h-px flex-1 bg-navy-border" />
        or
        <div className="h-px flex-1 bg-navy-border" />
      </div>

      <button
        type="button"
        disabled={googleLoading || loading}
        onClick={() => {
          setError(null);
          setGoogleLoading(true);
          void signIn("google", { callbackUrl }, GOOGLE_LOGIN_AUTHORIZATION_PARAMS);
        }}
        className="w-full rounded-md border border-navy-border bg-navy-panel px-3 py-2 text-sm font-medium text-white hover:bg-navy-border disabled:opacity-60"
      >
        {googleLoading ? "Redirecting to Google…" : "Continue with Google"}
      </button>

      <p className="mt-6 text-center text-sm text-ink-muted">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-accent hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
