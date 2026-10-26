import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { PublicNav } from "@/components/public-nav";
import { BetaBanner } from "@/components/beta-banner";
import { pageMetadata } from "@/lib/seo";
import { ABOUT_OPERATIONS_PROOF, PRODUCT_DIFFERENTIATOR_LINE } from "@/lib/product-positioning";
import { WhatsAppChatLink } from "@/components/whatsapp-chat-link";
import { AboutHeroVisual } from "@/components/about/about-hero-visual";
import { AboutStoryDivider } from "@/components/about/about-story-divider";

export const metadata: Metadata = pageMetadata({
  title: "About — Built for Agency Reporting",
  description:
    "NextReport is a small team building Meta Ads reporting automation for agencies — branded decks from CSV exports in minutes. Meta live; Meta API sync launching soon.",
  path: "/about",
});

const STORY_SECTIONS: { heading: string; paragraphs: string[] }[] = [
  {
    heading: "The problem agencies kept repeating",
    paragraphs: [
      "Performance teams running multiple Meta ad accounts know the weekly ritual: export day-wise CSVs, open the agency template, update card after card, rewrite summaries, fix formatting, and send before the client meeting.",
      "A single client report often takes 20–30 minutes. Multiply that across a roster and reporting becomes hours of low-leverage work every week — work that rarely changes strategy but always has to look perfect.",
      "Dashboards help internally, but most clients still expect the same branded PowerPoint or Slides deck their account manager has always delivered. We built NextReport for that deliverable — not another login for the client.",
    ],
  },
  {
    heading: "Why NextReport exists",
    paragraphs: [
      "We looked for tooling that matched how agencies actually ship work: the export you already pull from Ads Manager, the template your team already uses, and a finished deck in minutes — not a generic dashboard.",
      PRODUCT_DIFFERENTIATOR_LINE,
      "NextReport reads Meta Ads Manager CSV exports, detects campaign objectives, selects the right metrics, and generates PowerPoint, a live browser link, or Google Slides with AI-written insights — often in under two minutes.",
      "Meta CSV reporting is live today. Meta API sync is available for testing while we verify it against manual exports.",
    ],
  },
  {
    heading: "How we work",
    paragraphs: [
      "We are a lean team — product, engineering, and agency workflow experience — not a venture-sized suite. Most of our time goes into trustworthy numbers and slides that match real agency templates: regression tests on anonymized exports, reconciliation checks in the wizard, and fixes where Meta exports are ambiguous.",
      "We are opening the product more broadly with a free trial and direct support on email and WhatsApp when you need a human.",
      "If your agency still rebuilds the same Meta deck every week — in any market — NextReport is built for that workflow.",
    ],
  },
];

const STATS = [
  "Under 2 minutes per report",
  "Meta Ads — CSV upload live",
  "White-label client decks",
];

export default async function AboutPage() {
  const session = await auth();
  const loggedIn = !!session?.user;

  return (
    <>
      <BetaBanner />
      <PublicNav loggedIn={loggedIn} />
      <main className="flex-1">
        <section className="relative overflow-hidden bg-navy px-6 py-16 sm:py-24">
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-accent-orange/[0.06] via-transparent to-transparent"
            aria-hidden
          />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div className="text-center lg:text-left">
              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
                A small team obsessed with agency reporting
              </h1>
              <p className="mt-5 text-base leading-relaxed text-ink-secondary sm:text-lg">
                We automate the branded Meta deck — so strategists spend time on strategy, not slide formatting.
              </p>
            </div>
            <AboutHeroVisual />
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-6 pb-4 pt-16">
          {STORY_SECTIONS.map((section, index) => (
            <div key={section.heading}>
              {index > 0 ? <AboutStoryDivider /> : null}
              <article className="border-l-2 border-accent-orange/25 pl-6 sm:pl-8">
                <h2 className="text-2xl font-semibold text-accent-orange">{section.heading}</h2>
                <div className="mt-4 space-y-4 text-sm leading-relaxed text-ink-secondary sm:text-[15px]">
                  {section.paragraphs.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              </article>
            </div>
          ))}
        </section>

        <section className="px-6 pb-16 pt-8">
          <div className="mx-auto max-w-3xl rounded-2xl border border-navy-border bg-navy-panel p-8 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.45)] sm:p-10">
            <h2 className="text-xl font-semibold text-white">{ABOUT_OPERATIONS_PROOF.headline}</h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-secondary">{ABOUT_OPERATIONS_PROOF.body}</p>
            <ul className="mt-4 flex flex-wrap gap-3">
              {ABOUT_OPERATIONS_PROOF.stats.map((stat) => (
                <li
                  key={stat}
                  className="rounded-full border border-navy-border bg-navy px-3 py-1 text-xs font-medium text-ink-secondary"
                >
                  {stat}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="px-6 py-8">
          <div className="mx-auto max-w-5xl overflow-hidden rounded-2xl border border-navy-border bg-navy-panel p-8 sm:p-10">
            <div
              className="pointer-events-none -mx-8 -mt-8 mb-6 h-1 bg-gradient-to-r from-accent-orange/80 via-accent-orange/30 to-transparent sm:-mx-10 sm:-mt-10"
              aria-hidden
            />
            <h2 className="text-2xl font-semibold text-accent-orange">Our mission</h2>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-ink-secondary">
              Give small and mid-size agencies the reporting speed larger shops buy with headcount — starting with Meta
              Ads CSV reporting. Less
              formatting, more strategy.
            </p>
          </div>
        </section>

        <section className="px-6 py-16">
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-3">
            {STATS.map((s) => (
              <div key={s} className="rounded-xl border border-navy-border bg-navy-panel p-6 text-center">
                <p className="text-base font-semibold text-white">{s}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-navy-panel px-6 py-16 text-center">
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">Ready to save time on reporting?</h2>
          <p className="mx-auto mt-3 max-w-lg text-sm text-ink-muted">
            Questions?{" "}
            <Link href="/contact" className="text-accent hover:underline">
              Contact us
            </Link>{" "}
            or{" "}
            <WhatsAppChatLink className="text-accent underline hover:no-underline" />.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href={loggedIn ? "/clients" : "/signup"}
              className="inline-block rounded-md bg-accent-orange px-6 py-3 text-sm font-semibold text-navy hover:bg-accent-orange-hover"
            >
              {loggedIn ? "Go to Dashboard" : "Start free trial"}
            </Link>
            <Link
              href="/help/download"
              className="inline-block rounded-md border border-navy-border px-6 py-3 text-sm font-medium text-white hover:bg-navy"
            >
              CSV export guide
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
