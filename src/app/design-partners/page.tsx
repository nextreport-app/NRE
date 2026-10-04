import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { PublicNav } from "@/components/public-nav";
import { BetaBanner } from "@/components/beta-banner";
import { pageMetadata } from "@/lib/seo";
import { DESIGN_PARTNER_PROGRAM } from "@/lib/product-positioning";
import { MetaV1PromisePanel } from "@/components/meta-v1-promise-panel";

export const metadata: Metadata = pageMetadata({
  title: "Design Partner Program",
  description:
    "Partner with NextReport early: validate Meta CSV reports against real Ads Manager accounts. 3 months at 50% off or free while participating.",
  path: "/design-partners",
});

export default async function DesignPartnersPage() {
  const session = await auth();
  const loggedIn = !!session?.user;
  const mailHref = `mailto:hello@nextreport.in?subject=${encodeURIComponent(DESIGN_PARTNER_PROGRAM.mailSubject)}&body=${encodeURIComponent(
    "Agency name:\nWebsite:\nMeta clients per week:\nWhy I want to join:\n",
  )}`;

  return (
    <>
      <BetaBanner />
      <PublicNav loggedIn={loggedIn} />
      <main className="mx-auto max-w-3xl flex-1 px-6 py-16">
        <Link href="/" className="text-sm text-accent hover:underline">
          ← Home
        </Link>
        <h1 className="mt-6 text-3xl font-bold text-white">{DESIGN_PARTNER_PROGRAM.headline}</h1>
        <p className="mt-4 text-sm leading-relaxed text-ink-secondary">{DESIGN_PARTNER_PROGRAM.subhead}</p>

        <h2 className="mt-10 text-lg font-semibold text-white">What we ask</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-ink-secondary">
          {DESIGN_PARTNER_PROGRAM.commitments.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <p className="mt-8 text-sm text-ink-muted">{DESIGN_PARTNER_PROGRAM.successNote}</p>

        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href={mailHref}
            className="rounded-md bg-accent-orange px-5 py-2.5 text-sm font-semibold text-navy hover:bg-accent-orange-hover"
          >
            {DESIGN_PARTNER_PROGRAM.ctaLabel}
          </a>
          <Link
            href={loggedIn ? "/clients" : "/signup"}
            className="rounded-md border border-navy-border px-5 py-2.5 text-sm text-white hover:bg-navy-panel"
          >
            {loggedIn ? "Open dashboard" : "Start free trial"}
          </Link>
        </div>

        <div className="mt-12">
          <MetaV1PromisePanel variant="marketing" />
        </div>
      </main>
    </>
  );
}
