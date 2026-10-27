"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GoogleAuthNotice } from "@/components/auth/google-auth-notice";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { AuthFieldLabel, AuthPageShell, authInputClassName } from "@/components/auth/auth-page-shell";
import { PasswordInput } from "@/components/auth/password-input";
export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(false);
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(null); setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, password }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || "Could not create your account."); return; }
      const result = await signIn("credentials", { email, password, redirect: false });
      router.push(result?.error ? "/login" : "/clients");
    } catch { setError("Could not reach the server. Try again; if your account was created, log in instead."); }
    finally { setLoading(false); }
  }
  return <AuthPageShell title="Create your workspace" subtitle="Try NextReport for 7 days: 3 clients and 10 reports. No card required." footer={<p>Already have an account? <Link href="/login" className="text-accent hover:underline">Log in</Link></p>}>
    <form onSubmit={handleSubmit} className="space-y-4">
      <div><AuthFieldLabel htmlFor="signup-name">Name</AuthFieldLabel><input id="signup-name" autoComplete="name" required maxLength={100} value={name} onChange={e => setName(e.target.value)} className={authInputClassName} placeholder="Your name" /></div>
      <div><AuthFieldLabel htmlFor="signup-email">Email</AuthFieldLabel><input id="signup-email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} className={authInputClassName} placeholder="you@agency.com" /></div>
      <div><AuthFieldLabel htmlFor="signup-password">Password</AuthFieldLabel><PasswordInput id="signup-password" autoComplete="new-password" required minLength={8} maxLength={72} value={password} onChange={setPassword} placeholder="At least 8 characters" /></div>
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      <p className="text-xs leading-relaxed text-ink-muted">Email/password signups receive an email verification link. Google verifies your email when you continue with Google.</p>
      <button type="submit" disabled={loading || googleLoading} className="w-full rounded-md bg-accent px-4 py-3 font-medium text-[#0d1b2e] disabled:opacity-60">{loading ? "Creating account…" : "Start free trial"}</button>
    </form>
    <div className="my-5 flex items-center gap-3 text-xs text-ink-muted"><span className="h-px flex-1 bg-navy-border" />or<span className="h-px flex-1 bg-navy-border" /></div>
    <GoogleSignInButton callbackUrl="/clients" disabled={loading} loading={googleLoading} onStart={() => { setError(null); setGoogleLoading(true); }} onError={message => { setGoogleLoading(false); setError(message); }} />
    <GoogleAuthNotice />
  </AuthPageShell>;
}
