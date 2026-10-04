import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { PublicNav } from "@/components/public-nav";
import { BetaBanner } from "@/components/beta-banner";
import { pageMetadata } from "@/lib/seo";
import { FOUNDER_CASE_STUDY, PRODUCT_DIFFERENTIATOR_LINE } from "@/lib/product-positioning";
import { WhatsAppChatLink } from "@/components/whatsapp-chat-link";

export const metadata: Metadata = pageMetadata({
  title: "About — Built for Agency Reporting",
  description:
    "NextReport automates Meta Ads client reporting — born from 2–3 hours/day of manual PowerPoint work at a US agency. Meta CSV upload live; Google, TikTok & GA4 launching soon.",
  path: "/about",
});

const STORY_SECTIONS: { heading: string; paragraphs: string[] }[] = [
  {
    heading: "The problem was personal",
    paragraphs: [
      "I work as a Meta ads campaign specialist — more than three years in performance marketing, most recently at a US-based agency while working remotely from India.",
      "The job came with 25–30 ad accounts and a weekly ritual every agency knows: download CSVs, open the agency PPT template, replace card after card with fresh numbers, rewrite campaign summaries, fix formatting, repeat.",
      "One report took 20–30 minutes. Five or six clients a day meant 2–3 hours daily on work that felt boring, tedious, and time-consuming — and added almost no strategic value.",
      "I kept asking: if AI can draft strategy and creative, why am I still the human copy-paste layer between Ads Manager and PowerPoint?",
    ],
  },
  {
    heading: "Why NextReport exists",
    paragraphs: [
      "I could not find a tool that matched how agencies actually deliver work — not another dashboard for clients to log into, but the same branded deck the account manager already sends.",
      PRODUCT_DIFFERENTIATOR_LINE,
      "We started with Google Apps Script, then rebuilt as NextReport.in — a web app that reads Meta Ads Manager CSV exports, detects campaign objectives, picks the right metrics, and generates PowerPoint, a live browser link, or Google Slides with AI-written insights, often in under two minutes.",
      "Today Meta CSV reporting is live. Google Ads, TikTok Ads, and GA4 are in the codebase but stay behind “launching soon” until we finish parity testing — the same bar we use for our own client work.",
    ],
  },
  {
    heading: "Built in public",
    paragraphs: [
      "We have not shouted from rooftops yet — most energy went into making the numbers trustworthy and the slides match real agency templates. That meant hundreds of small fixes, regression tests on real anonymized accounts, and learning where Meta exports are ambiguous.",
      "Now we are opening the doors: free trial, design partners who compare decks to Ads Manager, and founder-led support on email and WhatsApp.",
      "If you manage Meta for clients in India, the US, Europe, or anywhere else — and you still rebuild the same deck every week — this was built for you.",
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
        <section className="bg-navy px-6 py-20 text-center">
          <div className="mx-auto max-w-2xl">
            <h1 className="text-3xl font-bold text-white sm:text-4xl">
              Built by someone who still had to send the deck on Friday
            </h1>
            <p className="mt-4 text-sm text-ink-muted">
              Agency reporting automation — Meta first, more platforms as we earn trust.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-6 py-16">
          {STORY_SECTIONS.map((section) => (
            <div key={section.heading} className="mb-12 last:mb-0">
              <h2 className="text-2xl font-semibold text-accent-orange">{section.heading}</h2>
              <div className="mt-4 space-y-4 text-sm leading-relaxed text-ink-secondary">
                {section.paragraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </div>
          ))}
        </section>

        <section className="px-6 pb-16">
          <div className="mx-auto max-w-3xl rounded-2xl border border-navy-border bg-navy-panel p-8">
            <h2 className="text-xl font-semibold text-white">{FOUNDER_CASE_STUDY.headline}</h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-secondary">{FOUNDER_CASE_STUDY.body}</p>
            <ul className="mt-4 flex flex-wrap gap-3">
              {FOUNDER_CASE_STUDY.stats.map((stat) => (
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
          <div className="mx-auto max-w-5xl rounded-2xl border border-navy-border bg-navy-panel p-8 sm:p-10">
            <h2 className="text-2xl font-semibold text-accent-orange">Our mission</h2>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-ink-secondary">
              Give small and mid-size agencies the same reporting speed large shops buy with headcount — starting with
              Meta Ads CSV today, then Google, TikTok, and GA4 when each platform passes the same accuracy bar. Less
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
            Start a free trial, or join the{" "}
            <Link href="/design-partners" className="text-accent hover:underline">
              design partner program
            </Link>{" "}
            if you want to shape v1 with us. Questions?{" "}
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
