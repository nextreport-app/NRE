import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { PublicNav } from "@/components/public-nav";
import { BetaBanner } from "@/components/beta-banner";

export const metadata: Metadata = {
  title: "About — NextReport",
};

const STATS = [
  { stat: "Under 2 minutes", label: "Average time to generate a report" },
  { stat: "25+ hours", label: "Saved per agency per month" },
  { stat: "2 platforms", label: "Meta Ads and Google Ads supported" },
];

const DIFFERENTIATORS = [
  {
    icon: "🇮🇳",
    title: "Built for Indian agencies",
    description: "INR pricing from day one — not an expensive USD subscription built for Western markets.",
  },
  {
    icon: "⚡",
    title: "Minutes, not hours",
    description: "What used to take 30 minutes of copy-pasting now takes under 2 minutes, start to finish.",
  },
  {
    icon: "🤖",
    title: "AI-written insights",
    description: "Campaign summaries and key insights are generated automatically, every single time.",
  },
  {
    icon: "🎯",
    title: "Built by an agency person",
    description: "Designed around how agency teams actually work day to day, not enterprise assumptions.",
  },
];

/**
 * The founder-story visual — the favicon mark shown large. Points at
 * favicon-large.png rather than the shipped favicon.png: that file's a
 * 1048x1048 canvas with the visible mark in a small corner (sized for a
 * browser tab, not a 200px hero image), so displaying it directly here
 * would render as a mostly-blank white rounded square with a tiny icon in
 * the corner. favicon-large.png is the same artwork tightly cropped to
 * the mark itself — see public/favicon-large.png.
 */
function StoryIllustration() {
  return (
    <img
      src="/favicon-large.png"
      alt="NextReport"
      style={{ width: "200px", height: "200px", borderRadius: "24px", display: "block", margin: "0 auto" }}
    />
  );
}

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
            <p className="mt-5 text-lg text-ink-muted">
              NextReport was born out of frustration — the same frustration every digital agency feels every
              Monday morning.
            </p>
          </div>
        </section>

        {/* Founder story */}
        <section className="mx-auto max-w-5xl px-6 py-16">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="text-2xl font-semibold text-accent-orange">The Story</h2>
              <div className="mt-4 space-y-4 text-sm leading-relaxed text-ink-secondary">
                <p>
                  My name is Mohit Sharma, and I spent years managing Meta Ads campaigns for clients across
                  India and the US. Every week, without fail, I would spend hours doing the same thing —
                  downloading CSVs, copying numbers into PowerPoint, writing the same campaign summaries,
                  formatting the same slides.
                </p>
                <p>It was not strategy. It was data entry.</p>
                <p>
                  I knew there had to be a better way. I looked at the tools available — most were expensive,
                  built for Western markets, priced in dollars, and designed for enterprise teams. None of them
                  understood how Indian agencies actually work.
                </p>
                <p>
                  So I built NextReport — and today we are helping digital agencies across India save hours
                  every week on reporting, so they can spend more time on what actually matters: growing their
                  clients results.
                </p>
                <p>What used to take hours now takes minutes.</p>
                <p className="pt-2 font-medium text-white">— Mohit Sharma, Founder, NextReport</p>
              </div>
            </div>
            <StoryIllustration />
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

        {/* Numbers */}
        <section className="px-6 py-16">
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-3">
            {STATS.map((s) => (
              <div key={s.stat} className="rounded-xl border border-navy-border bg-navy-panel p-6 text-center">
                <p className="text-3xl font-bold text-accent-orange">{s.stat}</p>
                <p className="mt-1.5 text-sm text-ink-muted">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* What makes us different */}
        <section className="bg-navy px-6 py-16">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-2xl font-semibold text-white sm:text-3xl">What makes us different</h2>
            <div className="mt-12 grid gap-6 sm:grid-cols-2">
              {DIFFERENTIATORS.map((d) => (
                <div key={d.title} className="rounded-xl border border-navy-border bg-navy-panel p-6">
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy text-xl"
                    aria-hidden="true"
                  >
                    {d.icon}
                  </span>
                  <h3 className="mt-4 text-base font-semibold text-white">{d.title}</h3>
                  <p className="mt-1.5 text-sm text-ink-muted">{d.description}</p>
                </div>
              ))}
            </div>
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
