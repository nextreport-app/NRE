import Link from "next/link";
const platforms = [
  {
    key: "meta",
    href: "/performance/meta-ads",
    label: "Meta Ads",
  },
  {
    key: "website",
    href: "/performance/google-analytics",
    label: "Website Traffic (GA4)",
  },
  {
    key: "seo",
    href: "/performance/search-console",
    label: "Google Search Console",
  },
] as const;

function PlatformIcon({ platform }: { platform: "meta" | "website" | "seo" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {platform === "meta" ? (
        <>
          <path d="M4 10h4l11-5v14L8 15H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1Z" />
          <path d="m5 15 2 6h3l-2-6M15 7v10M22 10v4" />
        </>
      ) : platform === "website" ? (
        <>
          <path d="M4 19V5M4 19h16" />
          <path d="M8 15v-3m5 3V8m5 7V4" />
        </>
      ) : (
        <>
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m16 16 5 5M7 12l3-3 2 2 2-3" />
        </>
      )}
    </svg>
  );
}

export function OverviewNavigation({
  current,
  clientId,
}: {
  current: "meta" | "website" | "seo";
  clientId?: string;
}) {
  return (
    <nav aria-label="Performance type" className="nre-platform-navigation">
      {platforms.map(({ key, href, label }) => (
        <Link
          key={key}
          href={
            clientId ? `${href}?client=${encodeURIComponent(clientId)}` : href
          }
          aria-label={label}
          aria-current={current === key ? "page" : undefined}
          className="nre-dashboard-entry"
        >
          <span className="nre-dashboard-entry-top">
            <span className="nre-platform-icon" aria-hidden="true">
              <PlatformIcon platform={key} />
            </span>
            <span className="nre-dashboard-entry-title">{label}</span>
          </span>
        </Link>
      ))}
    </nav>
  );
}
