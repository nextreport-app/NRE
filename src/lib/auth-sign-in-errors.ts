/** User-facing copy for Auth.js `error` query params on /login. */
export function messageForAuthSignInError(code: string | null | undefined): string | null {
  if (!code?.trim()) return null;
  switch (code) {
    case "OAuthAccountNotLinked":
      return "This email is already registered with a password. Log in with email and password below, or try Continue with Google again to link Google to the same account.";
    case "OAuthSignin":
    case "OAuthCallbackError":
      return "Google sign-in failed. Try again, or log in with email and password.";
    case "Configuration":
      return "Sign-in is temporarily unavailable. Please try email and password or try again later.";
    case "AccessDenied":
      return "Google sign-in was cancelled or denied.";
    case "CredentialsSignin":
      return "Invalid email or password.";
    default:
      return "Sign-in failed. Try again or use email and password.";
  }
}
