import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { PublicNav } from "@/components/public-nav";
import { BetaBanner } from "@/components/beta-banner";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Privacy Policy",
  description: "NextReport privacy policy — how we handle your account data, CSV uploads, and Meta, Google Ads, and GA4 API connections.",
  path: "/privacy",
});

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
      <p className="mt-2 text-sm text-ink-muted">Effective date: October 22, 2026</p>

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
              names, currency, timezone).
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
          <h2 className="mb-2 text-lg font-medium text-white">3. Google user data</h2>
          <p>
            If you choose <span className="text-white">Sign in with Google</span> or{" "}
            <span className="text-white">Connect Google Drive</span>, we receive Google user
            data only as described below and only to provide NextReport features you request.
            Our use of information received from Google APIs adheres to the{" "}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              className="text-accent hover:underline"
              rel="noopener noreferrer"
              target="_blank"
            >
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements.
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1.5">
            <li>
              <span className="text-white">Sign in with Google</span> — we receive your Google
              account ID, name, email address, and profile picture. We use this solely to create
              and secure your NextReport account and to identify you when you sign in.
            </li>
            <li>
              <span className="text-white">Connect Google Drive</span> — with your consent we
              request the Google Drive <span className="text-white">drive.file</span> scope. We
              use it only to upload a report file you have just generated into a Google Drive
              folder you designate (by pasting a folder link). We do not browse, list, or read
              other files in your Drive except the files this app creates for that upload.
            </li>
          </ul>
          <p className="mt-2">
            OAuth access and refresh tokens for Google are stored in our database and are used
            only to perform the actions above on your behalf until you disconnect Google or
            revoke access in your{" "}
            <a
              href="https://myaccount.google.com/permissions"
              className="text-accent hover:underline"
              rel="noopener noreferrer"
              target="_blank"
            >
              Google Account permissions
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-medium text-white">
            4. Sharing, transfer, and disclosure of data
          </h2>
          <p>
            We do not sell your personal information or Google user data. We do not share Google
            user data with third parties for their independent advertising, marketing, or
            analytics.
          </p>
          <p className="mt-2">
            We disclose or transfer data only in these circumstances:
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1.5">
            <li>
              <span className="text-white">Service providers (processors)</span> — companies that
              host and operate NextReport on our behalf, including Vercel (application hosting),
              Supabase (PostgreSQL database), and Vercel Blob (generated report file storage).
              They process data only under our instructions to provide the service.
            </li>
            <li>
              <span className="text-white">AI providers (optional)</span> — if you enter your own
              Anthropic and/or Google Gemini API keys, report text you choose to send for insights
              is transmitted directly to those providers using your keys; we do not use Google
              sign-in data for that purpose.
            </li>
            <li>
              <span className="text-white">Legal and safety</span> — when required by applicable
              law, regulation, legal process, or to protect the rights, safety, and security of
              NextReport, our users, or others.
            </li>
            <li>
              <span className="text-white">Business transfer</span> — if we are involved in a
              merger, acquisition, or sale of assets, user data may transfer as part of that
              transaction, subject to this policy.
            </li>
          </ul>
          <p className="mt-2">
            Some service providers may process data in the United States or other countries. Where
            required, we rely on appropriate safeguards for international transfers.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-medium text-white">5. Data protection and security</h2>
          <p>
            We treat account credentials, OAuth tokens, and uploaded advertising data as
            sensitive and apply technical and organizational measures to protect them, including:
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1.5">
            <li>
              <span className="text-white">Encryption in transit</span> — all communication with
              NextReport uses HTTPS (TLS).
            </li>
            <li>
              <span className="text-white">Encryption at rest</span> — data stored with our
              infrastructure providers (Supabase, Vercel Blob) is encrypted at rest by those
              platforms.
            </li>
            <li>
              <span className="text-white">Access controls</span> — passwords are stored using
              one-way hashing; Google OAuth tokens are accessible only in connection with your
              authenticated account and the features you enable.
            </li>
            <li>
              <span className="text-white">Least privilege</span> — we request the minimum Google
              OAuth scopes needed (profile/email for sign-in; drive.file for optional Drive
              uploads only).
            </li>
            <li>
              <span className="text-white">Monitoring and updates</span> — we maintain the
              application and dependencies with security patches as part of normal operations.
            </li>
          </ul>
          <p className="mt-2">
            No method of transmission or storage is 100% secure. If you believe your account has
            been compromised, contact us immediately at{" "}
            <a href="mailto:hello@nextreport.in" className="text-accent hover:underline">
              hello@nextreport.in
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-medium text-white">6. Where your data is stored</h2>
          <p>
            Account and workspace data is stored in a PostgreSQL database hosted by
            Supabase. Generated report files are stored using Vercel Blob storage,
            accessible only to your authenticated account. The application itself is
            hosted on Vercel.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-medium text-white">7. Cookies</h2>
          <p>
            We use a single session cookie, set by our authentication provider
            (NextAuth), to keep you signed in. We do not use advertising or tracking
            cookies.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-medium text-white">8. Data retention and deletion</h2>
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
          <h2 className="mb-2 text-lg font-medium text-white">9. Your rights</h2>
          <p>
            You may access, correct, export, or delete your personal data at any time.
            Contact us using the details below and we will respond promptly.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-medium text-white">10. Changes to this policy</h2>
          <p>
            We may update this Privacy Policy from time to time. If we make material
            changes, we will update the effective date above.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-medium text-white">11. Contact us</h2>
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
