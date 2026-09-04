import Link from "next/link";
import type { Metadata } from "next";
import { PublicNav } from "@/components/public-nav";
import { BetaBanner } from "@/components/beta-banner";
import { auth } from "@/lib/auth";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Refer an Agency",
  description: "Refer another agency to NextReport and both of you get a discount.",
  path: "/refer",
});

export default async function ReferPage() {
  const session = await auth();

  return (
    <>
      <BetaBanner />
      <PublicNav loggedIn={!!session?.user} />
      <main className="mx-auto max-w-2xl flex-1 px-6 py-16">
        <Link href="/" className="text-sm text-accent hover:underline">
          ← Back to NextReport
        </Link>
        <h1 className="mt-6 text-3xl font-semibold text-white">Refer an agency</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
          Know another agency or freelancer drowning in manual reporting? Refer them to NextReport. When they subscribe,
          both of you get <span className="text-white">one month free</span> on your next renewal.
        </p>

        <div className="mt-8 space-y-4 rounded-xl border border-navy-border bg-navy-panel p-6 text-sm text-ink-secondary">
          <h2 className="text-lg font-medium text-white">How it works</h2>
          <ol className="list-inside list-decimal space-y-2">
            <li>Email us your referral&apos;s name and agency email.</li>
            <li>They sign up and mention your NextReport account email at checkout.</li>
            <li>After their first paid month, we apply your reward manually.</li>
          </ol>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href="mailto:hello@nextreport.in?subject=Agency%20referral"
            className="rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-hover"
          >
            Refer by email
          </a>
          <Link
            href="/pricing"
            className="rounded-md border border-navy-border px-5 py-2.5 text-sm text-ink-secondary hover:bg-navy"
          >
            View pricing
          </Link>
        </div>

        <p className="mt-8 text-xs text-ink-muted">
          Managing 50+ client accounts? Ask about bulk agency pricing:{" "}
          <a href="mailto:hello@nextreport.in?subject=Bulk%20agency%20pricing" className="text-accent hover:underline">
            hello@nextreport.in
          </a>
        </p>
      </main>
    </>
  );
}
