import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { PublicNav } from "@/components/public-nav";
import { BetaBanner } from "@/components/beta-banner";

export const metadata: Metadata = {
  title: "User Data Deletion — NextReport",
  description:
    "How to request deletion of your personal data and Meta/Facebook data from NextReport.",
};

export default async function DataDeletionPage() {
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

        <h1 className="mt-6 text-3xl font-semibold text-white">User Data Deletion Instructions</h1>
        <p className="mt-2 text-sm text-ink-muted">Effective date: August 28, 2026</p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-ink-secondary">
          <p>
            NextReport (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) operates the web
            application at <span className="text-white">nextreport.in</span>. If you have connected
            your Facebook or Meta account to NextReport, or if we otherwise hold personal data about
            you, you can request that we delete it using the instructions below.
          </p>

          <section>
            <h2 className="mb-2 text-lg font-medium text-white">What data may be stored</h2>
            <p>Depending on how you use NextReport, we may store:</p>
            <ul className="mt-2 list-inside list-disc space-y-1.5">
              <li>
                <span className="text-white">Account information</span> — your name, email address,
                and login details (email/password or Google sign-in).
              </li>
              <li>
                <span className="text-white">Meta Marketing API data</span> — identifiers and
                metadata for Meta ad accounts you authorise (such as ad account IDs, account names,
                and campaign performance metrics we retrieve on your behalf).
              </li>
              <li>
                <span className="text-white">Workspace and report data</span> — client workspaces,
                uploaded exports, generated PowerPoint reports, and optional share links you create.
              </li>
              <li>
                <span className="text-white">Access tokens</span> — encrypted credentials used to
                fetch data from Meta on your behalf while your account remains connected.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-medium text-white">How to delete your data</h2>
            <p>You can remove your data from NextReport in either of the following ways:</p>

            <h3 className="mb-2 mt-4 font-medium text-white">Option 1 — Disconnect in NextReport or Facebook</h3>
            <p className="mb-2">
              In NextReport, open <span className="text-white">Account settings → Meta Ads → Disconnect</span>{" "}
              to revoke our access tokens immediately.
            </p>
            <p className="mb-2">You can also remove NextReport from Facebook directly:</p>
            <ol className="list-inside list-decimal space-y-1.5">
              <li>Go to your Facebook account and open Settings &amp; privacy → Settings.</li>
              <li>Open Business integrations (or Apps and websites, depending on your Facebook view).</li>
              <li>Find <span className="text-white">NextReport</span> in the list of connected apps.</li>
              <li>Select Remove or Disconnect, and confirm.</li>
            </ol>
            <p className="mt-2">
              Disconnecting revokes our access to your Meta data. To also delete data we have already
              stored, follow Option 2 below.
            </p>

            <h3 className="mb-2 mt-4 font-medium text-white">Option 2 — Request deletion by email</h3>
            <p>
              Email us at{" "}
              <a href="mailto:hello@nextreport.in" className="text-accent hover:underline">
                hello@nextreport.in
              </a>{" "}
              with the subject line <span className="text-white">Data Deletion Request</span> and
              include:
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1.5">
              <li>the email address associated with your NextReport account;</li>
              <li>your connected Meta user name or ID, if applicable; and</li>
              <li>any Meta ad account names or IDs you connected, if known.</li>
            </ul>
            <p className="mt-2">
              We will verify that you own the account and process your request. If you are logged in,
              you may also contact us through our{" "}
              <Link href="/contact" className="text-accent hover:underline">
                contact page
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-medium text-white">What we delete</h2>
            <p>When we approve a deletion request, we delete or anonymise, where applicable:</p>
            <ul className="mt-2 list-inside list-disc space-y-1.5">
              <li>your NextReport account and profile information;</li>
              <li>Meta/Facebook access tokens and cached Marketing API data tied to your account;</li>
              <li>client workspaces, uploaded files, generated reports, and share links you created; and</li>
              <li>billing records only where we are not required by law to retain them.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-medium text-white">How long deletion takes</h2>
            <p>
              We aim to complete verified deletion requests within{" "}
              <span className="text-white">30 days</span>. You will receive a confirmation email once
              your data has been deleted. Backups may take up to an additional 30 days to be fully
              purged from our systems.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-medium text-white">Questions</h2>
            <p>
              For questions about this process or your privacy rights, email{" "}
              <a href="mailto:hello@nextreport.in" className="text-accent hover:underline">
                hello@nextreport.in
              </a>{" "}
              or read our{" "}
              <Link href="/privacy" className="text-accent hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
          </section>
        </div>
      </main>
    </>
  );
}
