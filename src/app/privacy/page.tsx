import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { PublicNav } from "@/components/public-nav";
import { BetaBanner } from "@/components/beta-banner";

export const metadata: Metadata = {
  title: "Privacy Policy — NextReport",
};

export default async function PrivacyPage() {
  const session = await auth();
  const loggedIn = !!session?.user;

  return (
    <>
      <BetaBanner />
      <PublicNav loggedIn={loggedIn} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
      <Link href="/" className="text-sm text-accent hover:underline">
        ← Back to NextReport
      </Link>

      <h1 className="mt-6 text-3xl font-semibold text-white">Privacy Policy</h1>
      <p className="mt-2 text-sm text-ink-muted">Effective date: July 24, 2026</p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-ink-secondary">
        <p>
          NextReport (&ldquo;NextReport,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or
          &ldquo;our&rdquo;) operates the NextReport web application at{" "}
          <span className="text-white">nextreport.in</span>. This Privacy Policy
          explains what information we collect, how we use it, and the choices you
          have.
        </p>

        <section>
          <h2 className="mb-2 text-lg font-medium text-white">1. Information we collect</h2>
          <ul className="list-inside list-disc space-y-1.5">
            <li>
              <span className="text-white">Account information</span> — your name,
              email address, and a securely hashed password, or your Google profile
              information if you sign in with Google.
            </li>
            <li>
              <span className="text-white">Client workspace data</span> — the
              client and ad account details you add to organise your reports (account
              names, currency, timezone, monthly ad spend budget).
            </li>
            <li>
              <span className="text-white">Uploaded report files</span> — the CSV,
              TSV, or Excel exports you upload to generate a report, and the
              PowerPoint reports we generate from them.
            </li>
            <li>
              <span className="text-white">Optional third-party API keys</span> —
              if you choose to enable AI-written insights, the Anthropic and/or Gemini API
              keys you provide, stored against your client workspace.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-medium text-white">2. How we use your information</h2>
          <p>We use the information above solely to operate NextReport, specifically to:</p>
          <ul className="mt-2 list-inside list-disc space-y-1.5">
            <li>authenticate you and keep your account secure;</li>
            <li>generate the PowerPoint reports you request from your uploaded data;</li>
            <li>
              call the AI provider(s) you&apos;ve configured, using your own API keys,
              to write report insights on your behalf; and
            </li>
            <li>maintain and improve the reliability of the service.</li>
          </ul>
          <p className="mt-2">We do not sell your data, and we do not use your uploaded ad data to train any models.</p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-medium text-white">3. Where your data is stored</h2>
          <p>
            Account and workspace data is stored in a PostgreSQL database hosted by
            Supabase. Generated report files are stored using Vercel Blob storage,
            accessible only to your authenticated account. The application itself is
            hosted on Vercel.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-medium text-white">4. Cookies</h2>
          <p>
            We use a single session cookie, set by our authentication provider
            (NextAuth), to keep you signed in. We do not use advertising or tracking
            cookies.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-medium text-white">5. Data retention and deletion</h2>
          <p>
            We retain your account data and generated reports for as long as your
            account is active. You may request deletion of your account and all
            associated data at any time by emailing us at{" "}
            <a href="mailto:hello@nextreport.in" className="text-accent hover:underline">
              hello@nextreport.in
            </a>
            , or by following the instructions on our{" "}
            <Link href="/data-deletion" className="text-accent hover:underline">
              User Data Deletion
            </Link>{" "}
            page.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-medium text-white">6. Your rights</h2>
          <p>
            You may access, correct, export, or delete your personal data at any time.
            Contact us using the details below and we will respond promptly.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-medium text-white">7. Changes to this policy</h2>
          <p>
            We may update this Privacy Policy from time to time. If we make material
            changes, we will update the effective date above.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-medium text-white">8. Contact us</h2>
          <p>
            Questions about this Privacy Policy? Email us at{" "}
            <a href="mailto:hello@nextreport.in" className="text-accent hover:underline">
              hello@nextreport.in
            </a>
            .
          </p>
        </section>
      </div>
      </main>
    </>
  );
}
