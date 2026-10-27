"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { GOOGLE_LOGIN_AUTHORIZATION_PARAMS } from "@/lib/auth-google-sign-in";
import { isGoogleSignInEnabled } from "@/lib/google-sign-in-enabled";

type GoogleSignInButtonProps = {
  callbackUrl: string;
  disabled?: boolean;
  loading?: boolean;
  onStart?: () => void;
  onError?: (message: string) => void;
  className?: string;
};

export function GoogleSignInButton({
  callbackUrl,
  disabled = false,
  loading = false,
  onStart,
  onError,
  className = "w-full rounded-md border border-navy-border bg-navy px-3 py-2.5 text-sm font-medium text-ink hover:bg-navy-border disabled:opacity-60",
}: GoogleSignInButtonProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enabled = isGoogleSignInEnabled();

  if (!enabled) {
    return (
      <button
        type="button"
        disabled
        title="Google sign-in will be available after Google approves our OAuth app"
        className={`${className} cursor-not-allowed opacity-60`}
      >
        Google sign-in coming soon
      </button>
    );
  }

  return (
    <>
    <button
      type="button"
      disabled={disabled || loading || pending}
      aria-busy={loading || pending}
      onClick={async () => {
        setError(null);
        setPending(true);
        try {
          onStart?.();
          await signIn("google", { callbackUrl }, GOOGLE_LOGIN_AUTHORIZATION_PARAMS);
        } catch {
          const message = "Could not reach Google sign-in. Check your connection and try again.";
          setPending(false);
          if (onError) onError(message); else setError(message);
        }
      }}
      className={className}
    >
      {loading || pending ? "Redirecting to Google…" : "Continue with Google"}
    </button>
    {error && <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}
    </>
  );
}
