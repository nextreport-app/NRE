import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { PublicNav } from "@/components/public-nav";
import { BetaBanner } from "@/components/beta-banner";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "About",
  description:
    "NextReport automates Meta and Google Ads reporting for digital agencies — built to turn CSV exports and API sync into client-ready decks in minutes.",
  path: "/about",
});

const STORY_PARAGRAPHS = [
  "This started from a simple frustration — the kind every performance marketer knows well.",
  "Every week, hours disappeared into the same repetitive task: downloading campaign CSVs, copying numbers into PowerPoint slides, writing the same campaign summaries, formatting the same tables. Not strategy. Data entry.",
  "The tools that existed were built for other markets — dollar pricing, enterprise features, complex setup. Nothing was built for how Indian agencies actually work, or for the reality of managing US client accounts from India.",
  "So NextReport was built.",
  "It reads your Meta Ads and Google Ads CSV exports, detects what each campaign was trying to achieve, selects the right metrics automatically, and generates a branded PowerPoint report with AI-written insights — in under 2 minutes.",
  "The goal is simple: less time on formatting, more time on strategy.",
];

const STATS = [
  "Under 2 minutes per report",
  "Meta Ads and Google Ads supported",
  "Weekly, monthly and comparison reports",
];

export default async function AboutPage() {
  const session = await auth();
  const loggedIn = !!session?.user;

  return (
    <>
      <BetaBanner />
      <PublicNav loggedIn={loggedIn} />
      <main className="flex-1">
        {/* Hero */}
        <section className="bg-navy px-6 py-20 text-center">
          <div className="mx-auto max-w-2xl">
            <h1 className="text-3xl font-bold text-white sm:text-4xl">
              Built by an agency person, for agency people
            </h1>
          </div>
        </section>

        {/* Founder story */}
        <section className="mx-auto max-w-3xl px-6 py-16">
          <h2 className="text-2xl font-semibold text-accent-orange">The Story</h2>
          <div className="mt-4 space-y-4 text-sm leading-relaxed text-ink-secondary">
            {STORY_PARAGRAPHS.map((p) => (
              <p key={p}>{p}</p>
            ))}
            <p className="pt-2 font-medium text-white">— Built with Indian agencies and US client reporting in mind</p>
          </div>
        </section>

        {/* Mission */}
        <section className="px-6 py-8">
          <div className="mx-auto max-w-5xl rounded-2xl border border-navy-border bg-navy-panel p-8 sm:p-10">
            <h2 className="text-2xl font-semibold text-accent-orange">Our Mission</h2>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-ink-secondary">
              To give every digital agency in India the same reporting power that large agencies have — fast,
              professional, branded reports that let you focus on strategy instead of spreadsheets.
            </p>
          </div>
        </section>

        {/* Stats */}
        <section className="px-6 py-16">
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-3">
            {STATS.map((s) => (
              <div key={s} className="rounded-xl border border-navy-border bg-navy-panel p-6 text-center">
                <p className="text-base font-semibold text-white">{s}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="bg-navy-panel px-6 py-16 text-center">
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">Ready to save time on reporting?</h2>
          <div className="mt-6">
            <Link
              href={loggedIn ? "/clients" : "/signup"}
              className="inline-block rounded-md bg-accent-orange px-6 py-3 text-sm font-semibold text-navy hover:bg-accent-orange-hover"
            >
              {loggedIn ? "Go to Dashboard" : "Start free trial"}
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
