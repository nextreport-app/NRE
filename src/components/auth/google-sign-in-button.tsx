"use client";

import { signIn } from "next-auth/react";
import { GOOGLE_LOGIN_AUTHORIZATION_PARAMS } from "@/lib/auth-google-sign-in";
import { isGoogleSignInEnabled } from "@/lib/google-sign-in-enabled";

type GoogleSignInButtonProps = {
  callbackUrl: string;
  disabled?: boolean;
  loading?: boolean;
  onStart?: () => void;
  className?: string;
};

export function GoogleSignInButton({
  callbackUrl,
  disabled = false,
  loading = false,
  onStart,
  className = "w-full rounded-md border border-navy-border bg-navy px-3 py-2.5 text-sm font-medium text-ink hover:bg-navy-border disabled:opacity-60",
}: GoogleSignInButtonProps) {
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
    <button
      type="button"
      disabled={disabled || loading}
      onClick={() => {
        onStart?.();
        void signIn("google", { callbackUrl }, GOOGLE_LOGIN_AUTHORIZATION_PARAMS);
      }}
      className={className}
    >
      {loading ? "Redirecting to Google…" : "Continue with Google"}
    </button>
  );
}
