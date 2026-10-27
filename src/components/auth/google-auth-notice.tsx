import Link from "next/link";

export function GoogleAuthNotice() {
  return <div className="mt-4 space-y-2 text-center text-xs leading-relaxed text-ink-muted">
    <p>Continue with Google to sign in or create an account. No separate password needed.</p>
    <p>By continuing, you agree to our <Link href="/terms" className="text-accent underline">Terms</Link> and <Link href="/privacy" className="text-accent underline">Privacy Policy</Link>.</p>
  </div>;
}
