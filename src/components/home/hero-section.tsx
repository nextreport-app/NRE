import Link from "next/link";

/** A CSS-only "mock report preview" card — no image asset, matches the PPTX report's own dark/metric-tile look without rendering a real slide. */
function ReportPreviewCard() {
  return (
    <div className="w-full max-w-sm rounded-xl border border-navy-border bg-navy-panel p-6 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6)] sm:max-w-md">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">Weekly Performance</span>
        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
          On Track
        </span>
      </div>

      <div className="mt-5 flex items-center gap-4">
        <div
          className="h-20 w-20 flex-none rounded-full"
          style={{
            background: "conic-gradient(#f6ad55 0% 42%, #63b3ed 42% 74%, #1e3a5f 74% 100%)",
          }}
          aria-hidden="true"
        >
          <div className="flex h-full w-full items-center justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-navy-panel text-[10px] font-semibold text-white">
              847
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-1.5 text-xs">
          <span className="flex items-center gap-1.5 text-ink-secondary">
            <span className="h-2 w-2 flex-none rounded-full bg-[#f6ad55]" /> Leads
          </span>
          <span className="flex items-center gap-1.5 text-ink-secondary">
            <span className="h-2 w-2 flex-none rounded-full bg-[#63b3ed]" /> Purchases
          </span>
          <span className="flex items-center gap-1.5 text-ink-secondary">
            <span className="h-2 w-2 flex-none rounded-full bg-navy-border" /> Reach only
          </span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-navy-border bg-navy p-3">
          <p className="text-[11px] text-ink-muted">Spend</p>
          <p className="mt-0.5 text-lg font-semibold text-white">₹45,230</p>
        </div>
        <div className="rounded-lg border border-navy-border bg-navy p-3">
          <p className="text-[11px] text-ink-muted">Reach</p>
          <p className="mt-0.5 text-lg font-semibold text-white">1,24,000</p>
        </div>
        <div className="rounded-lg border border-navy-border bg-navy p-3">
          <p className="text-[11px] text-ink-muted">Leads</p>
          <p className="mt-0.5 text-lg font-semibold text-white">847</p>
        </div>
        <div className="rounded-lg border border-navy-border bg-navy p-3">
          <p className="text-[11px] text-ink-muted">CTR</p>
          <p className="mt-0.5 text-lg font-semibold text-white">4.2%</p>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-[11px] text-ink-muted">
          <span>Budget utilised</span>
          <span>75%</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-navy">
          <div className="h-full w-3/4 rounded-full bg-accent-orange" />
        </div>
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
            Meta Ads + Google Ads Reporting
          </span>

          <h1 className="mt-5 text-[2.25rem] font-bold leading-tight text-white sm:text-[3rem]">
            The next report you send will be fast, smooth, and done before you know it.
          </h1>

          <p className="mt-5 text-lg text-ink-muted">
            Upload your campaign CSV. NextReport reads every column, detects your campaign objective
            automatically, and generates a fully branded PowerPoint report — in under 2 minutes.
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
                <Link
                  href="/pricing"
                  className="w-full rounded-md border border-navy-border px-6 py-3 text-center text-sm font-medium text-white hover:bg-navy-panel sm:w-auto"
                >
                  View pricing
                </Link>
              </>
            )}
          </div>

          {!loggedIn && (
            <p className="mt-4 text-xs text-ink-muted">Free 7-day trial. No credit card required.</p>
          )}
        </div>

        <div className="flex w-full justify-center lg:w-auto">
          <ReportPreviewCard />
        </div>
      </div>
    </section>
  );
}
