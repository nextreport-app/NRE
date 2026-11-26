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
    label: "Website traffic (GA4)",
  },
  {
    key: "seo",
    href: "/performance/search-console",
    label: "Google Search Console",
  },
] as const;

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
          className="nre-platform-tab"
        >
          <span
            className={`nre-platform-icon nre-platform-icon--${key}`}
            aria-hidden="true"
          >
            {key === "meta" ? (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 10v5h4l12 5V5L8 10H4Z" />
                <path d="M8 15l2 6H6l-2-6M16 7v11M1 11v3" />
              </svg>
            ) : key === "website" ? (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 20V4M4 20h16" />
                <path d="M8 16v-4m5 4V8m5 8V4" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="10" cy="10" r="7" />
                <path d="m15 15 6 6M6 11l3-3 3 2 2-3" />
              </svg>
            )}
          </span>
          <span className="nre-platform-label">{label}</span>
        </Link>
      ))}
    </nav>
  );
}
