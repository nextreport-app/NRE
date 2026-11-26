import Link from "next/link";

export function OverviewNavigation({ current, clientId }: { current: "meta" | "website" | "seo"; clientId?: string }) {
  return (
    <nav aria-label="Performance type" className="mt-5 inline-flex max-w-full flex-wrap gap-1 rounded-2xl border border-dash-border bg-dash-card p-1.5 shadow-sm">
      {([
        ["meta", "/performance/meta-ads", "Meta Ads"],
        ["website", "/performance/google-analytics", "Website traffic (GA4)"],
        ["seo", "/performance/search-console", "Google Search Console"],
      ] as const).map(([key, href, label]) => (
        <Link key={key} href={clientId ? `${href}?client=${encodeURIComponent(clientId)}` : href} aria-current={current === key ? "page" : undefined}
          className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dash-accent sm:px-5 sm:text-sm ${current === key ? "bg-dash-accent text-[#102033] shadow-sm" : "text-dash-ink-secondary hover:bg-dash-bg hover:text-dash-ink"}`}>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="shrink-0">
            {key === "meta" ? <><path d="M4 19V5M4 19h16"/><path d="m7 14 4-4 4 2 5-7"/></> : key === "seo" ? <><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/></> : <><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/></>}
          </svg>
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
