import type { Metadata } from "next";

// Internal design preview only — NOT part of the live (dark) site and
// deliberately unlinked from anywhere in the app. This page hardcodes its
// own light palette directly (rather than reusing the dark homepage's
// section components) since those components are built entirely on the
// app-wide dark CSS variables (bg-navy, text-white, etc. — see
// globals.css's "NextReport is a dark-only app" note), not a swappable
// theme; duplicating the homepage's structure here with light colors was
// simpler and lower-risk than trying to retrofit real theming into a
// one-off internal preview.
export const metadata: Metadata = {
  title: "Light Theme Preview (Internal) — NextReport",
  robots: { index: false, follow: false },
};

const NAVY = "#0d1b2e";
const ORANGE = "#f6ad55";
const ORANGE_HOVER = "#ed8936";
const PAGE_BG = "#f8fafc";
const CARD_BG = "#ffffff";
const BORDER = "#e2e8f0";
const MUTED = "#64748b";

const FEATURES = [
  { icon: "📊", title: "Auto-detects any CSV", description: "Works with any column layout from Meta or Google Ads exports." },
  { icon: "🎯", title: "Smart objective detection", description: "Automatically identifies leads, purchases, traffic, reach and more." },
  { icon: "🤖", title: "AI-written insights", description: "Campaign summaries and key insights written by AI for every slide." },
  { icon: "☁️", title: "Google Drive sync", description: "Reports save directly to your Drive folder with a shareable link." },
  { icon: "📱", title: "Meta and Google Ads", description: "Full support for both platforms in one tool." },
  { icon: "⚡", title: "Under 2 minutes", description: "From CSV upload to downloaded report in minutes not hours." },
];

const STEPS = [
  { number: "1", title: "Upload your CSV", description: "Download from Meta Ads Manager or Google Ads. Upload any format — CSV, Excel, or Google Sheets export." },
  { number: "2", title: "Select campaigns and dates", description: "Filter to only the campaigns you manage. Choose your reporting period." },
  { number: "3", title: "Download or share", description: "Get a branded PowerPoint or save directly to Google Drive with a shareable link." },
];

const PLANS = [
  {
    name: "Starter",
    price: "$12",
    bestFor: "Freelancers and small agencies",
    highlighted: false,
    features: ["Up to 10 client accounts", "Meta Ads reporting", "Google Ads reporting", "Unlimited report generation", "Email support"],
  },
  {
    name: "Professional",
    price: "$29",
    bestFor: "Growing agencies managing multiple clients",
    highlighted: true,
    features: ["Unlimited client accounts", "Meta Ads reporting", "Google Ads reporting", "AI-written campaign summaries", "Google Drive auto-save", "Priority email support"],
  },
];

export default function LightPreviewPage() {
  return (
    <div id="light-preview-page" style={{ background: PAGE_BG, color: NAVY }} className="min-h-screen font-sans">
      <div className="border-b border-amber-300 bg-amber-100 px-6 py-2 text-center text-xs font-medium text-amber-900">
        This is a light theme preview — not the live site. Live site is at nextreport.in
      </div>

      <header className="sticky top-0 z-40 border-b" style={{ background: CARD_BG, borderColor: BORDER }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-base font-bold" style={{ color: NAVY }}>
            NextReport
          </span>
          <nav className="hidden items-center gap-6 text-sm sm:flex" style={{ color: NAVY }}>
            <span className="cursor-default opacity-80">Home</span>
            <span className="cursor-default opacity-80">Pricing</span>
            <span className="cursor-default opacity-80">How It Works</span>
            <span className="cursor-default opacity-80">Login</span>
            <span
              className="rounded-md px-4 py-2 text-sm font-semibold text-white"
              style={{ background: ORANGE }}
            >
              Get Started
            </span>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="px-6 py-20 sm:py-28">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-12 lg:flex-row lg:items-center lg:justify-between lg:gap-16">
            <div className="max-w-xl text-center lg:text-left">
              <span
                className="inline-block rounded-full border px-3 py-1 text-xs font-medium tracking-wide"
                style={{ borderColor: BORDER, background: CARD_BG, color: NAVY }}
              >
                Meta Ads + Google Ads Reporting
              </span>

              <h1 className="mt-5 text-[2.25rem] font-bold leading-tight sm:text-[3rem]" style={{ color: NAVY }}>
                The next report you send will be fast, smooth, and done before you know it.
              </h1>

              <p className="mt-5 text-lg" style={{ color: MUTED }}>
                Upload your campaign CSV. NextReport reads every column, detects your campaign objective
                automatically, and generates a fully branded PowerPoint report — in under 2 minutes.
              </p>

              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
                <span
                  className="w-full rounded-md px-6 py-3 text-center text-sm font-semibold text-white sm:w-auto"
                  style={{ background: ORANGE }}
                >
                  Start free trial
                </span>
                <span
                  className="w-full rounded-md border px-6 py-3 text-center text-sm font-medium sm:w-auto"
                  style={{ borderColor: BORDER, color: NAVY }}
                >
                  View pricing
                </span>
              </div>

              <p className="mt-4 text-xs" style={{ color: MUTED }}>
                Free 7-day trial. No credit card required.
              </p>
            </div>

            <div className="flex w-full justify-center lg:w-auto">
              <div
                className="w-full max-w-sm rounded-xl border p-6 shadow-[0_20px_60px_-15px_rgba(15,23,42,0.15)] sm:max-w-md"
                style={{ background: CARD_BG, borderColor: BORDER }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wide" style={{ color: MUTED }}>
                    Weekly Performance
                  </span>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                    On Track
                  </span>
                </div>

                <div className="mt-5 flex items-center gap-4">
                  <div
                    className="h-20 w-20 flex-none rounded-full"
                    style={{ background: `conic-gradient(${ORANGE} 0% 42%, #63b3ed 42% 74%, ${BORDER} 74% 100%)` }}
                    aria-hidden="true"
                  >
                    <div className="flex h-full w-full items-center justify-center">
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-full text-[10px] font-semibold"
                        style={{ background: CARD_BG, color: NAVY }}
                      >
                        847
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 text-xs" style={{ color: NAVY }}>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 flex-none rounded-full" style={{ background: ORANGE }} /> Leads
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 flex-none rounded-full bg-[#63b3ed]" /> Purchases
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 flex-none rounded-full" style={{ background: BORDER }} /> Reach only
                    </span>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  {[
                    ["Spend", "₹45,230"],
                    ["Reach", "1,24,000"],
                    ["Leads", "847"],
                    ["CTR", "4.2%"],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border p-3" style={{ background: PAGE_BG, borderColor: BORDER }}>
                      <p className="text-[11px]" style={{ color: MUTED }}>{label}</p>
                      <p className="mt-0.5 text-lg font-semibold" style={{ color: NAVY }}>{value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-[11px]" style={{ color: MUTED }}>
                    <span>Budget utilised</span>
                    <span>75%</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full" style={{ background: BORDER }}>
                    <div className="h-full w-3/4 rounded-full" style={{ background: ORANGE }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-2xl font-semibold sm:text-3xl" style={{ color: NAVY }}>
              Three steps to your weekly report
            </h2>

            <div className="mt-12 grid gap-10 sm:grid-cols-3 sm:gap-8">
              {STEPS.map((step) => (
                <div key={step.number} className="text-center">
                  <div
                    className="mx-auto flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold text-white"
                    style={{ background: ORANGE }}
                  >
                    {step.number}
                  </div>
                  <h3 className="mt-4 text-lg font-medium" style={{ color: NAVY }}>{step.title}</h3>
                  <p className="mt-2 text-sm" style={{ color: MUTED }}>{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-2xl font-semibold sm:text-3xl" style={{ color: NAVY }}>
              Everything your agency needs for client reporting
            </h2>

            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => (
                <div key={feature.title} className="rounded-xl border p-6" style={{ background: CARD_BG, borderColor: BORDER }}>
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-xl"
                    style={{ background: PAGE_BG }}
                    aria-hidden="true"
                  >
                    {feature.icon}
                  </span>
                  <h3 className="mt-4 text-base font-semibold" style={{ color: NAVY }}>{feature.title}</h3>
                  <p className="mt-1.5 text-sm" style={{ color: MUTED }}>{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pain point */}
        <section className="border-t-4 px-6 py-20" style={{ borderColor: ORANGE }}>
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-[2rem] font-bold" style={{ color: NAVY }}>Stop spending hours on reporting every week</h2>
            <p className="mt-5 text-base leading-relaxed" style={{ color: MUTED }}>
              The average digital agency spends 25 minutes per client per week manually downloading data,
              formatting slides, and writing campaign summaries. With 10 clients that is 4+ hours every
              week on work that adds zero strategic value. NextReport does it in 3 minutes.
            </p>

            <div className="mt-10 grid gap-6 sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-4">
              <div className="rounded-xl border p-6" style={{ background: CARD_BG, borderColor: BORDER }}>
                <p className="text-xs uppercase tracking-wide" style={{ color: MUTED }}>Without NextReport</p>
                <p className="mt-2 text-xl font-semibold" style={{ color: NAVY }}>10 clients × 25 minutes</p>
                <p className="mt-1 text-sm font-medium text-red-600">= 4+ hours/week</p>
              </div>

              <div className="hidden text-2xl font-bold sm:block" style={{ color: ORANGE }} aria-hidden="true">→</div>
              <div className="text-xl font-bold sm:hidden" style={{ color: ORANGE }} aria-hidden="true">↓</div>

              <div className="rounded-xl border p-6" style={{ background: CARD_BG, borderColor: ORANGE }}>
                <p className="text-xs uppercase tracking-wide" style={{ color: MUTED }}>With NextReport</p>
                <p className="mt-2 text-xl font-semibold" style={{ color: NAVY }}>10 clients × 3 minutes</p>
                <p className="mt-1 text-sm font-medium" style={{ color: ORANGE_HOVER }}>= 30 minutes/week</p>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing CTA (static preview only — no working Subscribe flow on this page) */}
        <section className="px-6 py-20">
          <div className="mx-auto max-w-5xl text-center">
            <h2 className="text-2xl font-semibold sm:text-3xl" style={{ color: NAVY }}>Simple pricing for growing agencies</h2>
            <p className="mt-3 text-base" style={{ color: MUTED }}>Start free for 7 days. No credit card required.</p>

            <div className="mt-12 grid gap-8 sm:grid-cols-2">
              {PLANS.map((plan) => (
                <div
                  key={plan.name}
                  className="relative flex flex-col rounded-xl border p-8 text-left"
                  style={{
                    background: CARD_BG,
                    borderColor: plan.highlighted ? ORANGE : BORDER,
                    boxShadow: plan.highlighted ? `0 0 0 1px ${ORANGE}` : undefined,
                  }}
                >
                  {plan.highlighted && (
                    <span
                      className="absolute -top-3 left-8 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white"
                      style={{ background: ORANGE }}
                    >
                      Most Popular
                    </span>
                  )}
                  <h3 className="text-lg font-semibold" style={{ color: NAVY }}>{plan.name}</h3>
                  <p className="mt-1 text-sm" style={{ color: MUTED }}>{plan.bestFor}</p>
                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="text-4xl font-semibold" style={{ color: NAVY }}>{plan.price}</span>
                    <span className="text-sm" style={{ color: MUTED }}>/month</span>
                  </div>
                  <ul className="mt-8 space-y-3 text-sm" style={{ color: NAVY }}>
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <span style={{ color: ORANGE }}>✓</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <span
                    className="mt-8 rounded-md px-5 py-2.5 text-center text-sm font-medium text-white"
                    style={{ background: plan.highlighted ? ORANGE : NAVY }}
                  >
                    Subscribe
                  </span>
                </div>
              ))}
            </div>

            <p className="mt-10 text-sm" style={{ color: MUTED }}>
              Need a demo? Email us at hello@nextreport.in
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t px-6 py-6" style={{ borderColor: BORDER, background: CARD_BG }}>
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <span className="text-sm font-semibold" style={{ color: NAVY }}>NextReport</span>
          <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs" style={{ color: MUTED }}>
            <span>Home</span>
            <span>Pricing</span>
            <span>How It Works</span>
            <span>Privacy</span>
            <span>Terms</span>
            <span>Contact</span>
          </nav>
          <span className="text-xs" style={{ color: MUTED }}>© 2026 NextReport. All rights reserved.</span>
        </div>
        <p className="mt-3 text-center text-[11px]" style={{ color: MUTED }}>
          Made for digital agencies. Automate your ad reporting.
        </p>
      </footer>
    </div>
  );
}
