import Link from "next/link";
import { BETA_HIDE_PRICING } from "@/lib/beta";

/** One of the 8 metric cards in the hero's slide mockup — amber uppercase label, bold white value, matching the real PPTX campaign slide's own card style. */
function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#1e3a5f] bg-[#111f35] px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#f5b45a]">{label}</p>
      <p className="mt-1 text-base font-bold text-white sm:text-lg">{value}</p>
    </div>
  );
}

const METRICS = [
  { label: "Ad Spend", value: "$2,847" },
  { label: "Reach", value: "45,231" },
  { label: "Impressions", value: "89,456" },
  { label: "Instant Form Leads", value: "34" },
  { label: "Cost per Lead", value: "$8.42" },
  { label: "CTR (All)", value: "2.4%" },
  { label: "Link Clicks", value: "1,847" },
  { label: "Cost per Click", value: "$1.54" },
];

/**
 * A miniature mock of a real NextReport campaign slide — 8 metric cards in
 * a 4x2 grid, dark navy background, amber labels, white bold values — so a
 * visitor sees exactly what the PPTX output looks like before they ever
 * upload a CSV. Static placeholder numbers, deliberately realistic-looking
 * rather than obviously fake round numbers.
 */
function SlideMockup() {
  return (
    <div className="w-full max-w-sm rounded-xl border border-[#1e3a5f] bg-[#0d1b2e] p-5 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6)] sm:max-w-md">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">Coastal Skin Co. — Lead Gen</span>
        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
          Weekly
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:gap-3">
        {METRICS.map((m) => (
          <MetricCard key={m.label} label={m.label} value={m.value} />
        ))}
      </div>
    </div>
  );
}

export function HeroSection({ loggedIn }: { loggedIn: boolean }) {
  return (
    <section className="bg-navy px-6 py-20 sm:py-28">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-12 lg:flex-row lg:items-center lg:justify-between lg:gap-16">
        <div className="max-w-xl text-center lg:text-left">
          <span className="inline-block rounded-full border border-navy-border bg-navy-panel px-3 py-1 text-xs font-medium tracking-wide text-ink-secondary">
            Meta + Google Ads API sync
          </span>

          <h1 className="mt-5 text-[2.25rem] font-bold leading-tight text-white sm:text-[3rem]">
            Client-ready Meta and Google Ads reports in under 2 minutes.
          </h1>

          <p className="mt-5 text-lg text-ink-muted">
            Connect via official API — or upload a CSV. Either way you get the same PowerPoint your clients expect,
            with accurate data and AI-written insights. Share a live browser link or PDF — no templates to configure.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
            {loggedIn ? (
              <Link
                href="/clients"
                className="w-full rounded-md bg-accent-orange px-6 py-3 text-center text-sm font-semibold text-navy hover:bg-accent-orange-hover sm:w-auto"
              >
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/signup"
                  className="w-full rounded-md bg-accent-orange px-6 py-3 text-center text-sm font-semibold text-navy hover:bg-accent-orange-hover sm:w-auto"
                >
                  Start free trial
                </Link>
                {/* BETA: hidden during beta period — restore before public launch (see lib/beta.ts's BETA_HIDE_PRICING) */}
                {!BETA_HIDE_PRICING && (
                  <Link
                    href="/pricing"
                    className="w-full rounded-md border border-navy-border px-6 py-3 text-center text-sm font-medium text-white hover:bg-navy-panel sm:w-auto"
                  >
                    View pricing
                  </Link>
                )}
              </>
            )}
          </div>

          {!loggedIn && (
            <p className="mt-4 text-xs text-ink-muted">No credit card required.</p>
          )}
        </div>

        <div className="flex w-full justify-center lg:w-auto">
          <SlideMockup />
        </div>
      </div>
    </section>
  );
}
